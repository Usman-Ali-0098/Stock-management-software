'use strict';

const { getDb } = require('../database/init.cjs');
const { mmToMeters } = require('../repositories/productRepo.cjs');
const { generateOutwardSlipNumber } = require('./inwardService.cjs');

/**
 * Issue a single roll (complete roll issuance only — no partial rolls).
 *
 * Strict Business Rules Enforced in Trusted Service Layer:
 * 1. Roll must exist.
 * 2. Roll must belong to the selected godown (rejects cross-godown issuance).
 * 3. Roll must be status='available'.
 * 4. Roll remaining_length_mm must be > 0.
 * 5. All changes committed atomically inside SQLite transaction.
 * 6. Audit entry written to roll_history table.
 */
function createOutwardTransaction(params) {
  const db = getDb();

  const {
    rollId,
    rollIds,
    godownId,
    recipientReference = '',
    notes = '',
    transactionDate,
    ratePerMeter = 0,
    totalPrice = 0,
  } = params;

  const targetRollIds = Array.isArray(rollIds) && rollIds.length > 0
    ? rollIds
    : (rollId ? [rollId] : []);

  if (targetRollIds.length === 0) throw new Error('Roll selection is required.');

  const doIssue = db.transaction(() => {
    // ── Validate all rolls ────────────────────────────────────────────────────
    const rollsToIssue = [];
    let totalMeters = 0;
    let actualGodownId = godownId ? Number(godownId) : null;
    let godownName = '';

    for (const rId of targetRollIds) {
      const roll = db.prepare(`
        SELECT r.*, p.product_code, p.product_name, g.name AS godown_name
        FROM rolls r
        JOIN products p ON p.id = r.product_id
        LEFT JOIN godowns g ON g.id = r.godown_id
        WHERE r.id = ?
      `).get(rId);

      if (!roll) throw new Error(`Roll ID ${rId} not found.`);

      // Enforce godown isolation
      if (godownId && roll.godown_id !== Number(godownId)) {
        const selectedGodown = db.prepare('SELECT name FROM godowns WHERE id = ?').get(godownId);
        const targetName = selectedGodown ? selectedGodown.name : `Godown #${godownId}`;
        throw new Error(`Roll "${roll.roll_code}" belongs to "${roll.godown_name}" and cannot be issued from "${targetName}".`);
      }

      if (roll.status !== 'available') {
        throw new Error(`Roll "${roll.roll_code}" is already Fully Issued and cannot be issued again.`);
      }
      if (roll.remaining_length_mm <= 0) {
        throw new Error(`Roll "${roll.roll_code}" has no remaining length.`);
      }

      if (!actualGodownId) actualGodownId = roll.godown_id;
      if (!godownName) godownName = roll.godown_name;
      totalMeters += mmToMeters(roll.original_length_mm);
      rollsToIssue.push(roll);
    }

    if (!actualGodownId) actualGodownId = 1;

    // Calculate rates and prices
    let finalRate = Number(ratePerMeter) || 0;
    let finalPrice = Number(totalPrice) || 0;
    if (finalRate > 0 && finalPrice === 0) {
      finalPrice = Math.round(totalMeters * finalRate * 100) / 100;
    } else if (finalPrice > 0 && finalRate === 0 && totalMeters > 0) {
      finalRate = Math.round((finalPrice / totalMeters) * 100) / 100;
    }

    // ── Generate slip number ──────────────────────────────────────────────────
    let slipNumber = generateOutwardSlipNumber();
    let attempt = 0;
    while (db.prepare('SELECT id FROM outward_transactions WHERE slip_number = ?').get(slipNumber)) {
      attempt++;
      slipNumber = slipNumber + `-${attempt}`;
    }

    const txDate = transactionDate || new Date().toISOString().replace('T', ' ').slice(0, 19);

    // ── Insert outward transaction ────────────────────────────────────────────
    const txResult = db.prepare(`
      INSERT INTO outward_transactions (godown_id, slip_number, transaction_date, recipient_reference, notes, rate_per_meter, total_price)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(actualGodownId, slipNumber, txDate, recipientReference.trim(), notes.trim(), finalRate, finalPrice);

    const outwardTxId = txResult.lastInsertRowid;

    // ── Insert items and update each roll ──────────────────────────────────────
    const items = [];
    for (const roll of rollsToIssue) {
      const issuedLengthMm = roll.original_length_mm;
      const rollMeters = mmToMeters(issuedLengthMm);
      const itemPrice = finalRate > 0 ? Math.round(rollMeters * finalRate * 100) / 100 : 0;

      db.prepare(`
        INSERT INTO outward_transaction_items (outward_transaction_id, roll_id, issued_length_mm, rate_per_meter, total_price)
        VALUES (?, ?, ?, ?, ?)
      `).run(outwardTxId, roll.id, issuedLengthMm, finalRate, itemPrice);

      db.prepare(`
        UPDATE rolls
        SET status = 'fully_issued', remaining_length_mm = 0
        WHERE id = ? AND status = 'available'
      `).run(roll.id);

      db.prepare(`
        INSERT INTO roll_history (roll_id, godown_id, transaction_type, transaction_id, slip_number, event_timestamp, length_involved_mm, recipient_reference, notes)
        VALUES (?, ?, 'outward', ?, ?, ?, ?, ?, ?)
      `).run(roll.id, actualGodownId, outwardTxId, slipNumber, txDate, issuedLengthMm, recipientReference.trim(), notes.trim());

      items.push({
        id: outwardTxId,
        outward_transaction_id: outwardTxId,
        roll_id: roll.id,
        roll_code: roll.roll_code,
        product_id: roll.product_id,
        product_code: roll.product_code,
        product_name: roll.product_name,
        godown_id: actualGodownId,
        godown_name: godownName,
        issued_length_mm: issuedLengthMm,
        issued_length_meters: rollMeters,
        original_length_mm: roll.original_length_mm,
        original_length_meters: rollMeters,
        rate_per_meter: finalRate,
        total_price: itemPrice,
        status: 'fully_issued',
      });
    }

    return {
      id: outwardTxId,
      godown_id: actualGodownId,
      godown_name: godownName,
      slip_number: slipNumber,
      transaction_date: txDate,
      recipient_reference: recipientReference.trim(),
      notes: notes.trim(),
      rate_per_meter: finalRate,
      total_price: finalPrice,
      roll: items.length > 0 ? { ...items[0], id: items[0].roll_id } : null, // for backwards compatibility with tests
      items,
    };
  });

  return doIssue();
}

/**
 * List outward transactions with optional filters.
 */
function listOutwardTransactions(filters = {}) {
  const db = getDb();
  const conditions = [];
  const params = [];

  if (filters.godownId) {
    conditions.push('ot.godown_id = ?');
    params.push(filters.godownId);
  }
  if (filters.productId) {
    conditions.push('EXISTS (SELECT 1 FROM outward_transaction_items oti JOIN rolls r ON r.id = oti.roll_id WHERE oti.outward_transaction_id = ot.id AND r.product_id = ?)');
    params.push(filters.productId);
  }
  if (filters.slipNumber) {
    conditions.push('ot.slip_number LIKE ?');
    params.push(`%${filters.slipNumber}%`);
  }
  if (filters.dateFrom) {
    conditions.push('ot.transaction_date >= ?');
    params.push(filters.dateFrom);
  }
  if (filters.dateTo) {
    conditions.push('ot.transaction_date <= ?');
    params.push(filters.dateTo + ' 23:59:59');
  }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

  return db.prepare(`
    SELECT ot.*,
           g.name AS godown_name,
           g.address AS godown_address,
           COUNT(oti.id) AS roll_count,
           SUM(oti.issued_length_mm) AS total_issued_mm
    FROM outward_transactions ot
    LEFT JOIN godowns g ON g.id = ot.godown_id
    LEFT JOIN outward_transaction_items oti ON oti.outward_transaction_id = ot.id
    ${where}
    GROUP BY ot.id
    ORDER BY ot.transaction_date DESC, ot.id DESC
  `).all(...params).map(r => ({
    ...r,
    roll_count: r.roll_count || 0,
    total_issued_meters: mmToMeters(r.total_issued_mm || 0),
  }));
}

/**
 * Get full details of an outward transaction including all issued rolls.
 */
function getOutwardTransactionById(id) {
  const db = getDb();

  const tx = db.prepare(`
    SELECT ot.*, g.name AS godown_name, g.address AS godown_address
    FROM outward_transactions ot
    LEFT JOIN godowns g ON g.id = ot.godown_id
    WHERE ot.id = ?
  `).get(id);

  if (!tx) return null;

  const items = db.prepare(`
    SELECT oti.*, r.roll_code, r.original_length_mm, r.status,
           p.product_code, p.product_name, p.id as product_id
    FROM outward_transaction_items oti
    JOIN rolls r ON r.id = oti.roll_id
    JOIN products p ON p.id = r.product_id
    WHERE oti.outward_transaction_id = ?
    ORDER BY r.roll_code ASC
  `).all(id);

  return {
    ...tx,
    items: items.map(item => ({
      ...item,
      issued_length_meters: mmToMeters(item.issued_length_mm),
      original_length_meters: mmToMeters(item.original_length_mm),
    })),
  };
}

module.exports = {
  createOutwardTransaction,
  listOutwardTransactions,
  getOutwardTransactionById,
};
