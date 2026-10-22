'use strict';

const { getDb } = require('../database/init.cjs');
const { mmToMeters } = require('./productRepo.cjs');

// ─── Roll row mapper ─────────────────────────────────────────────────────────

function mapRoll(row) {
  if (!row) return null;
  return {
    id: row.id,
    roll_code: row.roll_code,
    product_id: row.product_id,
    product_code: row.product_code || null,
    product_name: row.product_name || null,
    godown_id: row.godown_id || null,
    godown_name: row.godown_name || null,
    original_length_meters: mmToMeters(row.original_length_mm),
    remaining_length_meters: mmToMeters(row.remaining_length_mm),
    original_length_mm: row.original_length_mm,
    remaining_length_mm: row.remaining_length_mm,
    status: row.status,
    inward_transaction_id: row.inward_transaction_id,
    received_at: row.received_at,
    notes: row.notes,
    purchase_rate: row.purchase_rate || 0,
  };
}

function getRollById(id) {
  const db = getDb();
  const row = db.prepare(`
    SELECT r.*, p.product_code, p.product_name, g.name AS godown_name,
           COALESCE(NULLIF(r.purchase_rate, 0), it.rate_per_meter, 0) AS purchase_rate
    FROM rolls r
    JOIN products p ON p.id = r.product_id
    LEFT JOIN godowns g ON g.id = r.godown_id
    LEFT JOIN inward_transactions it ON it.id = r.inward_transaction_id
    WHERE r.id = ?
  `).get(id);
  return mapRoll(row);
}

function getRollByCode(rollCode) {
  const db = getDb();
  const row = db.prepare(`
    SELECT r.*, p.product_code, p.product_name, g.name AS godown_name,
           COALESCE(NULLIF(r.purchase_rate, 0), it.rate_per_meter, 0) AS purchase_rate
    FROM rolls r
    JOIN products p ON p.id = r.product_id
    LEFT JOIN godowns g ON g.id = r.godown_id
    LEFT JOIN inward_transactions it ON it.id = r.inward_transaction_id
    WHERE r.roll_code = ? COLLATE NOCASE
  `).get(rollCode.trim());
  return mapRoll(row);
}

/**
 * List rolls for a specific product.
 */
function listRollsByProduct(productId, filters = {}) {
  const db = getDb();
  const conditions = ['r.product_id = ?'];
  const params = [productId];

  if (filters.godownId) {
    conditions.push('r.godown_id = ?');
    params.push(filters.godownId);
  }
  if (filters.status && filters.status !== 'all') {
    conditions.push('r.status = ?');
    params.push(filters.status);
  }
  if (filters.exactLengthMm != null) {
    conditions.push('r.original_length_mm = ?');
    params.push(filters.exactLengthMm);
  }
  if (filters.minLengthMm != null) {
    conditions.push('r.original_length_mm >= ?');
    params.push(filters.minLengthMm);
  }
  if (filters.maxLengthMm != null) {
    conditions.push('r.original_length_mm <= ?');
    params.push(filters.maxLengthMm);
  }

  const where = 'WHERE ' + conditions.join(' AND ');

  const rows = db.prepare(`
    SELECT r.*, p.product_code, p.product_name, g.name AS godown_name,
           COALESCE(NULLIF(r.purchase_rate, 0), it.rate_per_meter, 0) AS purchase_rate
    FROM rolls r
    JOIN products p ON p.id = r.product_id
    LEFT JOIN godowns g ON g.id = r.godown_id
    LEFT JOIN inward_transactions it ON it.id = r.inward_transaction_id
    ${where}
    ORDER BY r.received_at ASC, r.roll_code ASC
  `).all(...params);

  return rows.map(mapRoll);
}

/**
 * List ALL rolls across all products with optional filters.
 */
function listAllRolls(filters = {}) {
  const db = getDb();
  const conditions = [];
  const params = [];

  if (filters.godownId) {
    conditions.push('r.godown_id = ?');
    params.push(filters.godownId);
  }
  if (filters.productId) {
    conditions.push('r.product_id = ?');
    params.push(filters.productId);
  }
  if (filters.status && filters.status !== 'all') {
    conditions.push('r.status = ?');
    params.push(filters.status);
  }
  if (filters.rollCode) {
    conditions.push('r.roll_code LIKE ?');
    params.push(`%${filters.rollCode}%`);
  }
  if (filters.exactLengthMm != null) {
    conditions.push('r.original_length_mm = ?');
    params.push(filters.exactLengthMm);
  }
  if (filters.minLengthMm != null) {
    conditions.push('r.original_length_mm >= ?');
    params.push(filters.minLengthMm);
  }
  if (filters.maxLengthMm != null) {
    conditions.push('r.original_length_mm <= ?');
    params.push(filters.maxLengthMm);
  }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

  const rows = db.prepare(`
    SELECT r.*, p.product_code, p.product_name, g.name AS godown_name,
           COALESCE(NULLIF(r.purchase_rate, 0), it.rate_per_meter, 0) AS purchase_rate
    FROM rolls r
    JOIN products p ON p.id = r.product_id
    LEFT JOIN godowns g ON g.id = r.godown_id
    LEFT JOIN inward_transactions it ON it.id = r.inward_transaction_id
    ${where}
    ORDER BY r.received_at DESC, r.roll_code ASC
  `).all(...params);

  return rows.map(mapRoll);
}

function listAvailableRolls(filters = {}) {
  return listAllRolls({ ...filters, status: 'available' });
}

/**
 * Get comprehensive history for a specific roll.
 */
function getRollHistory(rollIdOrCode) {
  const db = getDb();
  let roll = null;
  if (typeof rollIdOrCode === 'number' || !isNaN(Number(rollIdOrCode))) {
    roll = getRollById(Number(rollIdOrCode));
  } else {
    roll = getRollByCode(String(rollIdOrCode));
  }

  if (!roll) return null;

  const events = db.prepare(`
    SELECT
      rh.*,
      g.name AS godown_name,
      p.product_code,
      p.product_name
    FROM roll_history rh
    JOIN rolls r ON r.id = rh.roll_id
    JOIN products p ON p.id = r.product_id
    LEFT JOIN godowns g ON g.id = rh.godown_id
    WHERE rh.roll_id = ?
    ORDER BY rh.event_timestamp ASC, rh.id ASC
  `).all(roll.id);

  return {
    roll,
    events: events.map(e => ({
      id: e.id,
      roll_id: e.roll_id,
      godown_id: e.godown_id,
      godown_name: e.godown_name || 'Main Warehouse',
      transaction_type: e.transaction_type, // 'inward' | 'outward'
      transaction_id: e.transaction_id,
      slip_number: e.slip_number,
      event_timestamp: e.event_timestamp,
      length_involved_mm: e.length_involved_mm,
      length_involved_meters: mmToMeters(e.length_involved_mm),
      recipient_reference: e.recipient_reference || '',
      notes: e.notes || '',
    })),
  };
}

module.exports = {
  getRollById,
  getRollByCode,
  listRollsByProduct,
  listAllRolls,
  listAvailableRolls,
  getRollHistory,
  mapRoll,
};
