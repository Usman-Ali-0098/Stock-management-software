'use strict';

const { getDb } = require('../database/init.cjs');
const { metersToMm, mmToMeters } = require('../repositories/productRepo.cjs');
const { addToVariant } = require('../repositories/variantRepo.cjs');
const { addToBulkLot } = require('../repositories/bulkLotRepo.cjs');

// ─── Slip number generators ──────────────────────────────────────────────────

function generateInwardSlipNumber() {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const count = db.prepare(
    `SELECT COUNT(*) as cnt FROM inward_transactions WHERE transaction_date LIKE ?`
  ).get(`${today.slice(0, 4)}-${today.slice(4, 6)}-${today.slice(6, 8)}%`);
  const seq = String((count.cnt || 0) + 1).padStart(3, '0');
  return `IN-${today}-${seq}`;
}

function generateOutwardSlipNumber() {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const count = db.prepare(
    `SELECT COUNT(*) as cnt FROM outward_transactions WHERE transaction_date LIKE ?`
  ).get(`${today.slice(0, 4)}-${today.slice(4, 6)}-${today.slice(6, 8)}%`);
  const seq = String((count.cnt || 0) + 1).padStart(3, '0');
  return `OUT-${today}-${seq}`;
}

// ─── Inward service ──────────────────────────────────────────────────────────

/**
 * Create an inward transaction: one or more roll-size batches, each adding
 * to (or creating) a stock variant atomically within a single godown.
 */
function createInwardTransaction(params) {
  const db = getDb();

  const {
    godownId,
    productId,
    batches, // Array of { lengthMeters, quantity, ratePerMeter }
    referenceNote = '',
    notes = '',
    transactionDate,
  } = params;

  if (!godownId) throw new Error('Godown selection is required.');
  if (!productId) throw new Error('Product is required.');
  if (!Array.isArray(batches) || batches.length === 0) {
    throw new Error('At least one roll batch is required.');
  }

  const godown = db.prepare('SELECT id, name, is_active FROM godowns WHERE id = ?').get(godownId);
  if (!godown) throw new Error('Selected godown does not exist.');
  if (!godown.is_active) throw new Error(`Cannot add stock to inactive godown "${godown.name}".`);

  const product = db.prepare('SELECT id, product_code, product_name, is_active FROM products WHERE id = ?').get(productId);
  if (!product) throw new Error('Product not found.');
  if (!product.is_active) throw new Error('Cannot add stock to an inactive product.');

  const normalized = batches.map((b, i) => {
    const lengthMeters = Number(b.lengthMeters);
    const quantity = Number(b.quantity);
    const ratePerMeter = Number(b.ratePerMeter) || 0;
    if (!Number.isFinite(lengthMeters) || lengthMeters <= 0) {
      throw new Error(`Batch ${i + 1}: Length must be a positive number.`);
    }
    const lengthMm = metersToMm(lengthMeters);
    if (lengthMm > 10_000_000) throw new Error(`Batch ${i + 1}: Length exceeds maximum (10,000 meters).`);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error(`Batch ${i + 1}: Quantity must be a positive whole number.`);
    }
    if (ratePerMeter < 0) throw new Error(`Batch ${i + 1}: Rate cannot be negative.`);
    return { lengthMm, lengthMeters, quantity, ratePerMeter };
  });

  const totalMeters = normalized.reduce((s, b) => s + b.lengthMeters * b.quantity, 0);
  const totalPrice = Math.round(
    normalized.reduce((s, b) => s + b.lengthMeters * b.quantity * b.ratePerMeter, 0) * 100
  ) / 100;
  const finalRate = totalMeters > 0 ? Math.round((totalPrice / totalMeters) * 100) / 100 : 0;

  const doCreate = db.transaction(() => {
    let slipNumber = generateInwardSlipNumber();
    let attempt = 0;
    while (db.prepare('SELECT id FROM inward_transactions WHERE slip_number = ?').get(slipNumber)) {
      attempt++;
      slipNumber = slipNumber + `-${attempt}`;
    }

    const txDate = transactionDate || new Date().toISOString().replace('T', ' ').slice(0, 19);

    const txResult = db.prepare(`
      INSERT INTO inward_transactions (godown_id, slip_number, transaction_date, reference_note, notes, rate_per_meter, total_price)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(godownId, slipNumber, txDate, referenceNote.trim(), notes.trim(), finalRate, totalPrice);

    const transactionId = txResult.lastInsertRowid;

    const lines = [];
    for (const b of normalized) {
      const variantId = addToVariant(db, {
        productId, godownId, lengthMm: b.lengthMm, ratePerMeter: b.ratePerMeter, quantity: b.quantity,
      });
      const lineTotal = Math.round(b.lengthMeters * b.quantity * b.ratePerMeter * 100) / 100;

      db.prepare(`
        INSERT INTO inward_lines (inward_transaction_id, variant_id, quantity, length_mm, rate_per_meter, total_price)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(transactionId, variantId, b.quantity, b.lengthMm, b.ratePerMeter, lineTotal);

      db.prepare(`
        INSERT INTO stock_movements (variant_id, movement_type, transaction_id, slip_number, quantity, rate_per_meter, event_timestamp, reference, notes)
        VALUES (?, 'inward', ?, ?, ?, ?, ?, ?, ?)
      `).run(variantId, transactionId, slipNumber, b.quantity, b.ratePerMeter, txDate, referenceNote.trim(), notes.trim());

      lines.push({
        variant_id: variantId,
        product_id: productId,
        product_code: product.product_code,
        product_name: product.product_name,
        godown_id: godownId,
        godown_name: godown.name,
        length_mm: b.lengthMm,
        length_meters: b.lengthMeters,
        quantity: b.quantity,
        rate_per_meter: b.ratePerMeter,
        total_price: lineTotal,
      });
    }

    return {
      id: transactionId,
      godown_id: godownId,
      godown_name: godown.name,
      slip_number: slipNumber,
      transaction_date: txDate,
      reference_note: referenceNote.trim(),
      notes: notes.trim(),
      rate_per_meter: finalRate,
      total_price: totalPrice,
      lines,
    };
  });

  return doCreate();
}

/**
 * Create a bulk inward transaction: a single lot with a known total length and
 * roll count but no fixed per-roll size — e.g. a supplier bill that only states
 * totals. Adds to (or creates) a bulk lot atomically within a single godown.
 */
function createBulkInwardTransaction(params) {
  const db = getDb();

  const {
    godownId,
    productId,
    totalMeters,
    quantity,
    ratePerMeter = 0,
    referenceNote = '',
    notes = '',
    transactionDate,
  } = params;

  if (!godownId) throw new Error('Godown selection is required.');
  if (!productId) throw new Error('Product is required.');

  const godown = db.prepare('SELECT id, name, is_active FROM godowns WHERE id = ?').get(godownId);
  if (!godown) throw new Error('Selected godown does not exist.');
  if (!godown.is_active) throw new Error(`Cannot add stock to inactive godown "${godown.name}".`);

  const product = db.prepare('SELECT id, product_code, product_name, is_active FROM products WHERE id = ?').get(productId);
  if (!product) throw new Error('Product not found.');
  if (!product.is_active) throw new Error('Cannot add stock to an inactive product.');

  const metersNum = Number(totalMeters);
  const qtyNum = Number(quantity);
  const rateNum = Number(ratePerMeter) || 0;

  if (!Number.isFinite(metersNum) || metersNum <= 0) {
    throw new Error('Total meters must be a positive number.');
  }
  const lengthMm = metersToMm(metersNum);
  if (lengthMm > 10_000_000_000) throw new Error('Total meters exceeds maximum.');
  if (!Number.isInteger(qtyNum) || qtyNum <= 0) {
    throw new Error('Quantity must be a positive whole number.');
  }
  if (rateNum < 0) throw new Error('Rate cannot be negative.');

  const totalPrice = Math.round(metersNum * rateNum * 100) / 100;

  const doCreate = db.transaction(() => {
    let slipNumber = generateInwardSlipNumber();
    let attempt = 0;
    while (db.prepare('SELECT id FROM inward_transactions WHERE slip_number = ?').get(slipNumber)) {
      attempt++;
      slipNumber = slipNumber + `-${attempt}`;
    }

    const txDate = transactionDate || new Date().toISOString().replace('T', ' ').slice(0, 19);

    const txResult = db.prepare(`
      INSERT INTO inward_transactions (godown_id, slip_number, transaction_date, reference_note, notes, rate_per_meter, total_price)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(godownId, slipNumber, txDate, referenceNote.trim(), notes.trim(), rateNum, totalPrice);

    const transactionId = txResult.lastInsertRowid;

    const bulkLotId = addToBulkLot(db, {
      productId, godownId, ratePerMeter: rateNum, quantity: qtyNum, lengthMm,
    });

    db.prepare(`
      INSERT INTO inward_bulk_lines (inward_transaction_id, bulk_lot_id, quantity, length_mm, rate_per_meter, total_price)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(transactionId, bulkLotId, qtyNum, lengthMm, rateNum, totalPrice);

    db.prepare(`
      INSERT INTO bulk_stock_movements (bulk_lot_id, movement_type, transaction_id, slip_number, quantity, length_mm, rate_per_meter, event_timestamp, reference, notes)
      VALUES (?, 'inward', ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(bulkLotId, transactionId, slipNumber, qtyNum, lengthMm, rateNum, txDate, referenceNote.trim(), notes.trim());

    return {
      id: transactionId,
      godown_id: godownId,
      godown_name: godown.name,
      slip_number: slipNumber,
      transaction_date: txDate,
      reference_note: referenceNote.trim(),
      notes: notes.trim(),
      rate_per_meter: rateNum,
      total_price: totalPrice,
      lines: [{
        bulk_lot_id: bulkLotId,
        is_bulk: true,
        product_id: productId,
        product_code: product.product_code,
        product_name: product.product_name,
        godown_id: godownId,
        godown_name: godown.name,
        length_mm: lengthMm,
        length_meters: metersNum,
        quantity: qtyNum,
        rate_per_meter: rateNum,
        total_price: totalPrice,
      }],
    };
  });

  return doCreate();
}

/**
 * List inward transactions with optional filters.
 */
function listInwardTransactions(filters = {}) {
  const db = getDb();
  const conditions = [];
  const params = [];

  if (filters.godownId) {
    conditions.push('it.godown_id = ?');
    params.push(filters.godownId);
  }
  if (filters.productId) {
    conditions.push(`(
      EXISTS (SELECT 1 FROM inward_lines il JOIN variants v ON v.id = il.variant_id WHERE il.inward_transaction_id = it.id AND v.product_id = ?)
      OR EXISTS (SELECT 1 FROM inward_bulk_lines ibl JOIN bulk_lots b ON b.id = ibl.bulk_lot_id WHERE ibl.inward_transaction_id = it.id AND b.product_id = ?)
    )`);
    params.push(filters.productId, filters.productId);
  }
  if (filters.slipNumber) {
    conditions.push('it.slip_number LIKE ?');
    params.push(`%${filters.slipNumber}%`);
  }
  if (filters.dateFrom) {
    conditions.push('it.transaction_date >= ?');
    params.push(filters.dateFrom);
  }
  if (filters.dateTo) {
    conditions.push('it.transaction_date <= ?');
    params.push(filters.dateTo + ' 23:59:59');
  }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

  return db.prepare(`
    SELECT it.*,
           g.name AS godown_name,
           g.address AS godown_address,
           COALESCE(SUM(il.quantity), 0) AS roll_count,
           COALESCE(SUM(il.quantity * il.length_mm), 0) AS total_received_mm,
           MIN(il.rate_per_meter) AS min_rate_per_meter,
           MAX(il.rate_per_meter) AS max_rate_per_meter,
           COALESCE((SELECT SUM(ibl.quantity) FROM inward_bulk_lines ibl WHERE ibl.inward_transaction_id = it.id), 0) AS bulk_roll_count,
           COALESCE((SELECT SUM(ibl.length_mm) FROM inward_bulk_lines ibl WHERE ibl.inward_transaction_id = it.id), 0) AS bulk_total_mm
    FROM inward_transactions it
    LEFT JOIN godowns g ON g.id = it.godown_id
    LEFT JOIN inward_lines il ON il.inward_transaction_id = it.id
    ${where}
    GROUP BY it.id
    ORDER BY it.transaction_date DESC, it.id DESC
  `).all(...params).map(r => ({
    ...r,
    roll_count: (r.roll_count || 0) + (r.bulk_roll_count || 0),
    total_received_meters: mmToMeters((r.total_received_mm || 0) + (r.bulk_total_mm || 0)),
    rate_is_uniform: r.min_rate_per_meter === r.max_rate_per_meter,
  }));
}

/**
 * Get full details of an inward transaction, including all its batch lines.
 */
function getInwardTransactionById(id) {
  const db = getDb();

  const tx = db.prepare(`
    SELECT it.*, g.name AS godown_name, g.address AS godown_address
    FROM inward_transactions it
    LEFT JOIN godowns g ON g.id = it.godown_id
    WHERE it.id = ?
  `).get(id);

  if (!tx) return null;

  const lines = db.prepare(`
    SELECT il.*, p.product_code, p.product_name, p.id as product_id
    FROM inward_lines il
    JOIN variants v ON v.id = il.variant_id
    JOIN products p ON p.id = v.product_id
    WHERE il.inward_transaction_id = ?
    ORDER BY il.length_mm DESC
  `).all(id);

  const bulkLines = db.prepare(`
    SELECT ibl.*, p.product_code, p.product_name, p.id as product_id
    FROM inward_bulk_lines ibl
    JOIN bulk_lots b ON b.id = ibl.bulk_lot_id
    JOIN products p ON p.id = b.product_id
    WHERE ibl.inward_transaction_id = ?
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
  createInwardTransaction,
  createBulkInwardTransaction,
  listInwardTransactions,
  getInwardTransactionById,
  generateInwardSlipNumber,
  generateOutwardSlipNumber,
};
