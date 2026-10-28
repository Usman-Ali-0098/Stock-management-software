'use strict';

const { getDb } = require('../database/init.cjs');
const { mmToMeters, metersToMm } = require('../repositories/productRepo.cjs');
const { subtractFromVariant } = require('../repositories/variantRepo.cjs');
const { subtractFromBulkLot } = require('../repositories/bulkLotRepo.cjs');
const { generateOutwardSlipNumber } = require('./inwardService.cjs');

/**
 * Dispatch stock: one or more lines, each decrementing either a roll-size
 * variant's quantity or a bulk lot's meters+rolls. Strictly enforces godown
 * isolation and available stock.
 */
function createOutwardTransaction(params) {
  const db = getDb();

  const {
    items, // Array of { variantId, quantity } OR { bulkLotId, quantity, lengthMeters }
    godownId,
    recipientReference = '',
    notes = '',
    transactionDate,
    ratePerMeter = 0,
    totalPrice = 0,
  } = params;

  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('At least one stock line is required.');
  }
  if (!godownId) throw new Error('Godown selection is required.');

  const doIssue = db.transaction(() => {
    const godown = db.prepare('SELECT id, name FROM godowns WHERE id = ?').get(godownId);
    if (!godown) throw new Error('Selected godown does not exist.');

    let totalMeters = 0;
    const resolvedLines = [];

    for (const item of items) {
      const quantity = Number(item.quantity);
      if (!Number.isInteger(quantity) || quantity <= 0) {
        throw new Error('Each line must have a positive whole quantity.');
      }

      if (item.bulkLotId) {
        const lengthMeters = Number(item.lengthMeters);
        if (!Number.isFinite(lengthMeters) || lengthMeters <= 0) {
          throw new Error('Each bulk line must have a positive number of meters.');
        }
        const lengthMm = metersToMm(lengthMeters);

        const lot = db.prepare(`
          SELECT b.*, p.product_code, p.product_name
          FROM bulk_lots b
          JOIN products p ON p.id = b.product_id
          WHERE b.id = ?
        `).get(item.bulkLotId);

        if (!lot) throw new Error(`Bulk lot ${item.bulkLotId} not found.`);
        if (lot.godown_id !== Number(godownId)) {
          throw new Error(`"${lot.product_name}" (bulk) belongs to a different godown and cannot be issued from "${godown.name}".`);
        }

        subtractFromBulkLot(db, lot.id, { quantity, lengthMm });

        totalMeters += lengthMeters;
        resolvedLines.push({ isBulk: true, lot, quantity, lengthMeters, lengthMm });
        continue;
      }

      const variant = db.prepare(`
        SELECT v.*, p.product_code, p.product_name
        FROM variants v
        JOIN products p ON p.id = v.product_id
        WHERE v.id = ?
      `).get(item.variantId);

      if (!variant) throw new Error(`Stock variant ${item.variantId} not found.`);
      if (variant.godown_id !== Number(godownId)) {
        throw new Error(`"${variant.product_name}" (${mmToMeters(variant.length_mm)}m) belongs to a different godown and cannot be issued from "${godown.name}".`);
      }

      subtractFromVariant(db, variant.id, quantity);

      const lengthMeters = mmToMeters(variant.length_mm);
      totalMeters += lengthMeters * quantity;
      resolvedLines.push({ isBulk: false, variant, quantity, lengthMeters });
    }

    let finalRate = Number(ratePerMeter) || 0;
    let finalPrice = Number(totalPrice) || 0;
    if (finalRate > 0 && finalPrice === 0) {
      finalPrice = Math.round(totalMeters * finalRate * 100) / 100;
    } else if (finalPrice > 0 && finalRate === 0 && totalMeters > 0) {
      finalRate = Math.round((finalPrice / totalMeters) * 100) / 100;
    }

    let slipNumber = generateOutwardSlipNumber();
    let attempt = 0;
    while (db.prepare('SELECT id FROM outward_transactions WHERE slip_number = ?').get(slipNumber)) {
      attempt++;
      slipNumber = slipNumber + `-${attempt}`;
    }

    const txDate = transactionDate || new Date().toISOString().replace('T', ' ').slice(0, 19);

    const txResult = db.prepare(`
      INSERT INTO outward_transactions (godown_id, slip_number, transaction_date, recipient_reference, notes, rate_per_meter, total_price)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(godownId, slipNumber, txDate, recipientReference.trim(), notes.trim(), finalRate, finalPrice);

    const outwardTxId = txResult.lastInsertRowid;

    const lines = [];
    for (const resolved of resolvedLines) {
      if (resolved.isBulk) {
        const { lot, quantity, lengthMeters, lengthMm } = resolved;
        const lineTotal = finalRate > 0 ? Math.round(lengthMeters * finalRate * 100) / 100 : 0;

        db.prepare(`
          INSERT INTO outward_bulk_lines (outward_transaction_id, bulk_lot_id, quantity, length_mm, rate_per_meter, total_price)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(outwardTxId, lot.id, quantity, lengthMm, finalRate, lineTotal);

        db.prepare(`
          INSERT INTO bulk_stock_movements (bulk_lot_id, movement_type, transaction_id, slip_number, quantity, length_mm, rate_per_meter, event_timestamp, reference, notes)
          VALUES (?, 'outward', ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(lot.id, outwardTxId, slipNumber, quantity, lengthMm, finalRate, txDate, recipientReference.trim(), notes.trim());

        lines.push({
          bulk_lot_id: lot.id,
          is_bulk: true,
          product_id: lot.product_id,
          product_code: lot.product_code,
          product_name: lot.product_name,
          godown_id: godownId,
          godown_name: godown.name,
          length_mm: lengthMm,
          length_meters: lengthMeters,
          quantity,
          rate_per_meter: finalRate,
          total_price: lineTotal,
        });
        continue;
      }

      const { variant, quantity, lengthMeters } = resolved;
      const lineTotal = finalRate > 0 ? Math.round(lengthMeters * quantity * finalRate * 100) / 100 : 0;

      db.prepare(`
        INSERT INTO outward_lines (outward_transaction_id, variant_id, quantity, length_mm, rate_per_meter, total_price)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(outwardTxId, variant.id, quantity, variant.length_mm, finalRate, lineTotal);

      db.prepare(`
        INSERT INTO stock_movements (variant_id, movement_type, transaction_id, slip_number, quantity, rate_per_meter, event_timestamp, reference, notes)
        VALUES (?, 'outward', ?, ?, ?, ?, ?, ?, ?)
      `).run(variant.id, outwardTxId, slipNumber, quantity, finalRate, txDate, recipientReference.trim(), notes.trim());

      lines.push({
        variant_id: variant.id,
        is_bulk: false,
        product_id: variant.product_id,
        product_code: variant.product_code,
        product_name: variant.product_name,
        godown_id: godownId,
        godown_name: godown.name,
        length_mm: variant.length_mm,
        length_meters: lengthMeters,
        quantity,
        rate_per_meter: finalRate,
        total_price: lineTotal,
      });
    }

    return {
      id: outwardTxId,
      godown_id: godownId,
      godown_name: godown.name,
      slip_number: slipNumber,
      transaction_date: txDate,
      recipient_reference: recipientReference.trim(),
      notes: notes.trim(),
      rate_per_meter: finalRate,
      total_price: finalPrice,
      lines,
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
    conditions.push(`(
      EXISTS (SELECT 1 FROM outward_lines ol JOIN variants v ON v.id = ol.variant_id WHERE ol.outward_transaction_id = ot.id AND v.product_id = ?)
      OR EXISTS (SELECT 1 FROM outward_bulk_lines obl JOIN bulk_lots b ON b.id = obl.bulk_lot_id WHERE obl.outward_transaction_id = ot.id AND b.product_id = ?)
    )`);
    params.push(filters.productId, filters.productId);
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
           COALESCE(SUM(ol.quantity), 0) AS roll_count,
           COALESCE(SUM(ol.quantity * ol.length_mm), 0) AS total_issued_mm,
           COALESCE((SELECT SUM(obl.quantity) FROM outward_bulk_lines obl WHERE obl.outward_transaction_id = ot.id), 0) AS bulk_roll_count,
           COALESCE((SELECT SUM(obl.length_mm) FROM outward_bulk_lines obl WHERE obl.outward_transaction_id = ot.id), 0) AS bulk_total_mm
    FROM outward_transactions ot
    LEFT JOIN godowns g ON g.id = ot.godown_id
    LEFT JOIN outward_lines ol ON ol.outward_transaction_id = ot.id
    ${where}
    GROUP BY ot.id
    ORDER BY ot.transaction_date DESC, ot.id DESC
  `).all(...params).map(r => ({
    ...r,
    roll_count: (r.roll_count || 0) + (r.bulk_roll_count || 0),
    total_issued_meters: mmToMeters((r.total_issued_mm || 0) + (r.bulk_total_mm || 0)),
  }));
}

/**
 * Get full details of an outward transaction including all its batch lines.
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

  const lines = db.prepare(`
    SELECT ol.*, p.product_code, p.product_name, p.id as product_id
    FROM outward_lines ol
    JOIN variants v ON v.id = ol.variant_id
    JOIN products p ON p.id = v.product_id
    WHERE ol.outward_transaction_id = ?
    ORDER BY ol.length_mm DESC
  `).all(id);

  const bulkLines = db.prepare(`
    SELECT obl.*, p.product_code, p.product_name, p.id as product_id
    FROM outward_bulk_lines obl
    JOIN bulk_lots b ON b.id = obl.bulk_lot_id
    JOIN products p ON p.id = b.product_id
    WHERE obl.outward_transaction_id = ?
  `).all(id);

  return {
    ...tx,
    lines: [
      ...lines.map(line => ({ ...line, length_meters: mmToMeters(line.length_mm), is_bulk: false })),
      ...bulkLines.map(line => ({ ...line, length_meters: mmToMeters(line.length_mm), is_bulk: true })),
    ],
  };
}

module.exports = {
  createOutwardTransaction,
  listOutwardTransactions,
  getOutwardTransactionById,
};
