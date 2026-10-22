'use strict';

const { getDb } = require('../database/init.cjs');
const { metersToMm, mmToMeters } = require('../repositories/productRepo.cjs');

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

/**
 * Generate a roll code: PRODUCTCODE-NNNN (sequential per product).
 * E.g., A-0001, BlackLeather-0042
 */
function generateRollCode(productCode, productId) {
  const db = getDb();
  const count = db.prepare(
    'SELECT COUNT(*) as cnt FROM rolls WHERE product_id = ?'
  ).get(productId);
  let nextNum = (count.cnt || 0) + 1;
  let code = `${productCode.toUpperCase()}-${String(nextNum).padStart(4, '0')}`;

  // Ensure global uniqueness guard
  while (db.prepare('SELECT id FROM rolls WHERE roll_code = ?').get(code)) {
    nextNum++;
    code = `${productCode.toUpperCase()}-${String(nextNum).padStart(4, '0')}`;
  }
  return code;
}

// ─── Inward service ──────────────────────────────────────────────────────────

/**
 * Create an inward transaction with multiple rolls atomically into a specific godown.
 */
function createInwardTransaction(params) {
  const db = getDb();

  const {
    godownId = 1,
    productId,
    rollLengthsMeters,
    referenceNote = '',
    notes = '',
    transactionDate,
    ratePerMeter = 0,
    totalPrice = 0,
  } = params;

  // ── Validate ────────────────────────────────────────────────────────────────
  if (!godownId) throw new Error('Godown selection is required.');
  if (!productId) throw new Error('Product is required.');
  if (!Array.isArray(rollLengthsMeters) || rollLengthsMeters.length === 0) {
    throw new Error('At least one roll length is required.');
  }

  const godown = db.prepare('SELECT id, name, is_active FROM godowns WHERE id = ?').get(godownId);
  if (!godown) throw new Error('Selected godown does not exist.');
  if (!godown.is_active) throw new Error(`Cannot add stock to inactive godown "${godown.name}".`);

  const product = db.prepare('SELECT id, product_code, product_name, is_active FROM products WHERE id = ?').get(productId);
  if (!product) throw new Error('Product not found.');
  if (!product.is_active) throw new Error('Cannot add stock to an inactive product.');

  // Validate each length
  const rollLengthsMm = rollLengthsMeters.map((m, i) => {
    const mm = metersToMm(m);
    if (!Number.isFinite(m) || m <= 0) {
      throw new Error(`Roll ${i + 1}: Length must be a positive number. Got: ${m}`);
    }
    if (mm <= 0) throw new Error(`Roll ${i + 1}: Length too small.`);
    if (mm > 10_000_000) throw new Error(`Roll ${i + 1}: Length exceeds maximum (10,000 meters).`);
    return mm;
  });

  const totalMeters = rollLengthsMeters.reduce((s, m) => s + m, 0);
  let finalRate = Number(ratePerMeter) || 0;
  let finalPrice = Number(totalPrice) || 0;
  if (finalRate > 0 && finalPrice === 0) {
    finalPrice = Math.round(totalMeters * finalRate * 100) / 100;
  } else if (finalPrice > 0 && finalRate === 0 && totalMeters > 0) {
    finalRate = Math.round((finalPrice / totalMeters) * 100) / 100;
  }

  // ── Atomic transaction ───────────────────────────────────────────────────────
  const doCreate = db.transaction(() => {
    // 1. Generate unique slip number
    let slipNumber = generateInwardSlipNumber();
    let attempt = 0;
    while (db.prepare('SELECT id FROM inward_transactions WHERE slip_number = ?').get(slipNumber)) {
      attempt++;
      slipNumber = slipNumber + `-${attempt}`;
    }

    const txDate = transactionDate || new Date().toISOString().replace('T', ' ').slice(0, 19);

    // 2. Insert inward transaction
    const txResult = db.prepare(`
      INSERT INTO inward_transactions (godown_id, slip_number, transaction_date, reference_note, notes, rate_per_meter, total_price)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(godownId, slipNumber, txDate, referenceNote.trim(), notes.trim(), finalRate, finalPrice);

    const transactionId = txResult.lastInsertRowid;

    // 3. Create each roll, link to transaction, and record in roll_history
    const createdRolls = [];
    for (const lengthMm of rollLengthsMm) {
      const rollCode = generateRollCode(product.product_code, productId);

      const rollResult = db.prepare(`
        INSERT INTO rolls (roll_code, product_id, godown_id, original_length_mm, remaining_length_mm,
                           status, inward_transaction_id, received_at, notes, purchase_rate)
        VALUES (?, ?, ?, ?, ?, 'available', ?, ?, ?, ?)
      `).run(rollCode, productId, godownId, lengthMm, lengthMm, transactionId, txDate, notes.trim(), finalRate);

      const rollId = rollResult.lastInsertRowid;
      const rollMeters = lengthMm / 1000;
      const itemPrice = finalRate > 0 ? Math.round(rollMeters * finalRate * 100) / 100 : 0;

      db.prepare(`
        INSERT INTO inward_transaction_items (inward_transaction_id, roll_id, received_length_mm, rate_per_meter, total_price)
        VALUES (?, ?, ?, ?, ?)
      `).run(transactionId, rollId, lengthMm, finalRate, itemPrice);

      // Record in roll_history audit table
      db.prepare(`
        INSERT INTO roll_history (roll_id, godown_id, transaction_type, transaction_id, slip_number, event_timestamp, length_involved_mm, notes)
        VALUES (?, ?, 'inward', ?, ?, ?, ?, ?)
      `).run(rollId, godownId, transactionId, slipNumber, txDate, lengthMm, referenceNote.trim());

      createdRolls.push({
        id: rollId,
        roll_code: rollCode,
        product_id: productId,
        product_code: product.product_code,
        product_name: product.product_name,
        godown_id: godownId,
        godown_name: godown.name,
        length_mm: lengthMm,
        length_meters: mmToMeters(lengthMm),
        original_length_meters: mmToMeters(lengthMm),
        purchase_rate: finalRate,
        remaining_length_meters: mmToMeters(lengthMm),
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
      total_price: finalPrice,
      rolls: createdRolls,
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
    conditions.push('EXISTS (SELECT 1 FROM inward_transaction_items iti JOIN rolls r ON r.id = iti.roll_id WHERE iti.inward_transaction_id = it.id AND r.product_id = ?)');
    params.push(filters.productId);
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
           COUNT(iti.id) AS roll_count,
           SUM(iti.received_length_mm) AS total_received_mm
    FROM inward_transactions it
    LEFT JOIN godowns g ON g.id = it.godown_id
    LEFT JOIN inward_transaction_items iti ON iti.inward_transaction_id = it.id
    ${where}
    GROUP BY it.id
    ORDER BY it.transaction_date DESC, it.id DESC
  `).all(...params).map(r => ({
    ...r,
    roll_count: r.roll_count || 0,
    total_received_meters: mmToMeters(r.total_received_mm || 0),
  }));
}

/**
 * Get full details of an inward transaction, including all its rolls.
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

  const items = db.prepare(`
    SELECT iti.*, r.roll_code, r.status, r.remaining_length_mm, r.original_length_mm,
           p.product_code, p.product_name, p.id as product_id
    FROM inward_transaction_items iti
    JOIN rolls r ON r.id = iti.roll_id
    JOIN products p ON p.id = r.product_id
    WHERE iti.inward_transaction_id = ?
    ORDER BY r.roll_code ASC
  `).all(id);

  return {
    ...tx,
    items: items.map(item => ({
      ...item,
      received_length_meters: mmToMeters(item.received_length_mm),
      remaining_length_meters: mmToMeters(item.remaining_length_mm),
      original_length_meters: mmToMeters(item.original_length_mm),
    })),
  };
}

module.exports = {
  createInwardTransaction,
  listInwardTransactions,
  getInwardTransactionById,
  generateInwardSlipNumber,
  generateOutwardSlipNumber,
  generateRollCode,
  createSupplierBill,
  listSupplierBills,
  getSupplierBillById,
  verifyBillItemWithRolls,
};

// ─── Supplier Bill functions ─────────────────────────────────────────────────

/**
 * Create a supplier bill (Mode A) with product-wise summary lines.
 * Does NOT create any roll records. Marks items as 'pending' verification.
 */
function createSupplierBill(params) {
  const db = getDb();
  const {
    godownId,
    billNumber = '',
    billDate,
    notes = '',
    items, // Array of { productId, supplierTotalMeters, supplierTotalRolls, notes? }
  } = params;

  if (!godownId) throw new Error('Godown selection is required.');
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('At least one product line is required.');
  }

  const godown = db.prepare('SELECT id, name, is_active FROM godowns WHERE id = ?').get(godownId);
  if (!godown) throw new Error('Selected godown does not exist.');
  if (!godown.is_active) throw new Error(`Cannot add stock to inactive godown "${godown.name}".`);

  // Validate bill number uniqueness (only if bill_number is provided and non-empty)
  const trimmedBillNum = (billNumber || '').trim();
  if (trimmedBillNum) {
    const existingBill = db.prepare(
      'SELECT id FROM supplier_bills WHERE bill_number = ? AND godown_id = ?'
    ).get(trimmedBillNum, godownId);
    if (existingBill) {
      throw new Error(
        `Bill number "${trimmedBillNum}" already exists for this godown (Bill ID: ${existingBill.id}). Check for duplicate receipt.`
      );
    }
  }

  // Validate each line
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const product = db.prepare('SELECT id, product_code, product_name, is_active FROM products WHERE id = ?').get(item.productId);
    if (!product) throw new Error(`Line ${i + 1}: Product not found (ID: ${item.productId}).`);
    if (!product.is_active) throw new Error(`Line ${i + 1}: Product "${product.product_name}" is inactive.`);
    const m = parseFloat(item.supplierTotalMeters);
    if (!Number.isFinite(m) || m <= 0) throw new Error(`Line ${i + 1}: Supplier total meters must be a positive number.`);
    const r = parseInt(item.supplierTotalRolls, 10);
    if (!Number.isInteger(r) || r <= 0) throw new Error(`Line ${i + 1}: Supplier roll count must be a positive whole number.`);
  }

  const doCreate = db.transaction(() => {
    const txDate = billDate || new Date().toISOString().slice(0, 10);

    const billResult = db.prepare(`
      INSERT INTO supplier_bills (godown_id, bill_number, bill_date, notes)
      VALUES (?, ?, ?, ?)
    `).run(godownId, trimmedBillNum, txDate, (notes || '').trim());

    const billId = billResult.lastInsertRowid;
    const createdItems = [];

    for (const item of items) {
      const m = parseFloat(item.supplierTotalMeters);
      const r = parseInt(item.supplierTotalRolls, 10);
      const product = db.prepare('SELECT id, product_code, product_name FROM products WHERE id = ?').get(item.productId);

      const itemResult = db.prepare(`
        INSERT INTO supplier_bill_items
          (supplier_bill_id, product_id, supplier_total_meters, supplier_total_rolls, notes)
        VALUES (?, ?, ?, ?, ?)
      `).run(billId, item.productId, m, r, (item.notes || '').trim());

      createdItems.push({
        id: itemResult.lastInsertRowid,
        supplier_bill_id: billId,
        product_id: item.productId,
        product_code: product.product_code,
        product_name: product.product_name,
        supplier_total_meters: m,
        supplier_total_rolls: r,
        verification_status: 'pending',
        verified_rolls: 0,
        verified_meters: 0,
        inward_transaction_id: null,
        notes: (item.notes || '').trim(),
      });
    }

    return {
      id: billId,
      godown_id: godownId,
      godown_name: godown.name,
      bill_number: trimmedBillNum,
      bill_date: txDate,
      notes: (notes || '').trim(),
      items: createdItems,
    };
  });

  return doCreate();
}

/**
 * List supplier bills for a godown with optional filters.
 */
function listSupplierBills(filters = {}) {
  const db = getDb();
  const conditions = [];
  const params = [];

  if (filters.godownId) {
    conditions.push('sb.godown_id = ?');
    params.push(filters.godownId);
  }
  if (filters.billNumber) {
    conditions.push('sb.bill_number LIKE ?');
    params.push(`%${filters.billNumber}%`);
  }
  if (filters.verificationStatus && filters.verificationStatus !== 'all') {
    conditions.push('EXISTS (SELECT 1 FROM supplier_bill_items sbi WHERE sbi.supplier_bill_id = sb.id AND sbi.verification_status = ?)');
    params.push(filters.verificationStatus);
  }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

  return db.prepare(`
    SELECT sb.*,
           g.name AS godown_name,
           COUNT(sbi.id) AS item_count,
           SUM(sbi.supplier_total_meters) AS grand_total_meters,
           SUM(sbi.supplier_total_rolls) AS grand_total_rolls
    FROM supplier_bills sb
    LEFT JOIN godowns g ON g.id = sb.godown_id
    LEFT JOIN supplier_bill_items sbi ON sbi.supplier_bill_id = sb.id
    ${where}
    GROUP BY sb.id
    ORDER BY sb.bill_date DESC, sb.id DESC
  `).all(...params).map(r => ({
    ...r,
    item_count: r.item_count || 0,
    grand_total_meters: r.grand_total_meters || 0,
    grand_total_rolls: r.grand_total_rolls || 0,
  }));
}

/**
 * Get full details of a supplier bill including all its product items.
 */
function getSupplierBillById(id) {
  const db = getDb();
  const bill = db.prepare(`
    SELECT sb.*, g.name AS godown_name
    FROM supplier_bills sb
    LEFT JOIN godowns g ON g.id = sb.godown_id
    WHERE sb.id = ?
  `).get(id);

  if (!bill) return null;

  const items = db.prepare(`
    SELECT sbi.*,
           p.product_code, p.product_name,
           it.slip_number AS verified_slip_number
    FROM supplier_bill_items sbi
    JOIN products p ON p.id = sbi.product_id
    LEFT JOIN inward_transactions it ON it.id = sbi.inward_transaction_id
    WHERE sbi.supplier_bill_id = ?
    ORDER BY sbi.id ASC
  `).all(id);

  return { ...bill, items };
}

/**
 * Link actual roll measurements to an existing supplier bill item.
 * Creates an inward transaction for the actual rolls and updates
 * verification status on the bill item.
 */
function verifyBillItemWithRolls(params) {
  const db = getDb();
  const {
    billItemId,
    godownId,
    rollLengthsMeters, // Array of actual lengths in meters
    notes = '',
  } = params;

  if (!billItemId) throw new Error('Bill item ID is required.');
  if (!godownId) throw new Error('Godown ID is required.');
  if (!Array.isArray(rollLengthsMeters) || rollLengthsMeters.length === 0) {
    throw new Error('At least one roll length is required.');
  }

  const billItem = db.prepare(`
    SELECT sbi.*, sb.godown_id AS bill_godown_id, sb.bill_number,
           p.product_code, p.product_name, p.is_active AS product_active
    FROM supplier_bill_items sbi
    JOIN supplier_bills sb ON sb.id = sbi.supplier_bill_id
    JOIN products p ON p.id = sbi.product_id
    WHERE sbi.id = ?
  `).get(billItemId);

  if (!billItem) throw new Error('Supplier bill item not found.');
  if (billItem.bill_godown_id !== godownId) {
    throw new Error('Godown mismatch: bill item belongs to a different godown.');
  }
  if (billItem.inward_transaction_id) {
    throw new Error('This bill item already has actual rolls recorded. To add more rolls, create a new inward transaction.');
  }

  // Create the actual inward transaction
  const tx = createInwardTransaction({
    godownId,
    productId: billItem.product_id,
    rollLengthsMeters,
    referenceNote: billItem.bill_number
      ? `Bill: ${billItem.bill_number} — ${billItem.product_name}`
      : `Supplier Bill ID ${billItem.supplier_bill_id} — ${billItem.product_name}`,
    notes: notes.trim(),
  });

  // Calculate verified totals
  const verifiedRolls = rollLengthsMeters.length;
  const verifiedMeters = rollLengthsMeters.reduce((s, m) => s + m, 0);

  // Determine status
  const rollMatch = verifiedRolls === billItem.supplier_total_rolls;
  const meterDiff = Math.abs(verifiedMeters - billItem.supplier_total_meters);
  // Float epsilon 0.01m (1 cm) to avoid IEEE 754 precision issues
  const meterMatch = meterDiff < 0.01;

  let status = 'verified';
  if (!rollMatch || !meterMatch) {
    status = 'discrepancy';
  }

  // Update the bill item
  const doUpdate = db.transaction(() => {
    db.prepare(`
      UPDATE supplier_bill_items
      SET inward_transaction_id = ?,
          verified_rolls = ?,
          verified_meters = ?,
          verification_status = ?
      WHERE id = ?
    `).run(tx.id, verifiedRolls, verifiedMeters, status, billItemId);
  });
  doUpdate();

  return {
    transaction: tx,
    billItemId,
    verifiedRolls,
    verifiedMeters,
    supplierRolls: billItem.supplier_total_rolls,
    supplierMeters: billItem.supplier_total_meters,
    rollCountDiff: verifiedRolls - billItem.supplier_total_rolls,
    meterDiff: verifiedMeters - billItem.supplier_total_meters,
    status,
  };
}

