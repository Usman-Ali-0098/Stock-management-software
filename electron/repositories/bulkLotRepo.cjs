'use strict';

const { getDb } = require('../database/init.cjs');
const { mmToMeters, metersToMm } = require('./productRepo.cjs');

function mapBulkLot(row) {
  return {
    ...row,
    total_length_meters: mmToMeters(row.total_length_mm),
  };
}

/** List bulk lots for one product, optionally scoped to a godown. Only quantity > 0 by default. */
function listBulkLotsByProduct(productId, filters = {}) {
  const db = getDb();
  const conditions = ['b.product_id = ?'];
  const params = [productId];

  if (filters.godownId) {
    conditions.push('b.godown_id = ?');
    params.push(filters.godownId);
  }
  if (filters.includeZero !== true) {
    conditions.push('b.quantity > 0');
  }

  const rows = db.prepare(`
    SELECT b.*, p.product_code, p.product_name, g.name AS godown_name
    FROM bulk_lots b
    JOIN products p ON p.id = b.product_id
    LEFT JOIN godowns g ON g.id = b.godown_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY b.updated_at DESC
  `).all(...params);

  return rows.map(mapBulkLot);
}

/** List bulk lots across products, optionally scoped to a godown/product. Only quantity > 0 by default. */
function listAllBulkLots(filters = {}) {
  const db = getDb();
  const conditions = [];
  const params = [];

  if (filters.godownId) {
    conditions.push('b.godown_id = ?');
    params.push(filters.godownId);
  }
  if (filters.productId) {
    conditions.push('b.product_id = ?');
    params.push(filters.productId);
  }
  if (filters.includeZero !== true) {
    conditions.push('b.quantity > 0');
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const rows = db.prepare(`
    SELECT b.*, p.product_code, p.product_name, g.name AS godown_name
    FROM bulk_lots b
    JOIN products p ON p.id = b.product_id
    LEFT JOIN godowns g ON g.id = b.godown_id
    ${where}
    ORDER BY b.updated_at DESC
  `).all(...params);

  return rows.map(mapBulkLot);
}

function getBulkLotById(id) {
  const db = getDb();
  const row = db.prepare(`
    SELECT b.*, p.product_code, p.product_name, g.name AS godown_name
    FROM bulk_lots b
    JOIN products p ON p.id = b.product_id
    LEFT JOIN godowns g ON g.id = b.godown_id
    WHERE b.id = ?
  `).get(id);
  return row ? mapBulkLot(row) : null;
}

/** Find the bulk lot matching this exact (product, godown, rate) combination, if any. */
function findBulkLot(db, { productId, godownId, ratePerMeter }) {
  return db.prepare(`
    SELECT * FROM bulk_lots
    WHERE product_id = ? AND godown_id = ? AND rate_per_meter = ?
  `).get(productId, godownId, ratePerMeter);
}

/**
 * Add `quantity` rolls and `lengthMm` total meters to the matching bulk lot
 * (creating it if it doesn't exist yet). Must be called inside a transaction.
 * Returns the bulk lot id.
 */
function addToBulkLot(db, { productId, godownId, ratePerMeter, quantity, lengthMm }) {
  const existing = findBulkLot(db, { productId, godownId, ratePerMeter });
  if (existing) {
    db.prepare(`
      UPDATE bulk_lots SET quantity = quantity + ?, total_length_mm = total_length_mm + ?,
      updated_at = datetime('now','localtime') WHERE id = ?
    `).run(quantity, lengthMm, existing.id);
    return existing.id;
  }
  const result = db.prepare(`
    INSERT INTO bulk_lots (product_id, godown_id, rate_per_meter, quantity, total_length_mm)
    VALUES (?, ?, ?, ?, ?)
  `).run(productId, godownId, ratePerMeter, quantity, lengthMm);
  return result.lastInsertRowid;
}

/**
 * Subtract `quantity` rolls and `lengthMm` total meters from a bulk lot.
 * Throws if there isn't enough of either left. Must be called inside a transaction.
 */
function subtractFromBulkLot(db, bulkLotId, { quantity, lengthMm }) {
  const lot = db.prepare('SELECT * FROM bulk_lots WHERE id = ?').get(bulkLotId);
  if (!lot) throw new Error('Bulk lot not found.');
  if (lot.quantity < quantity) {
    throw new Error(`Only ${lot.quantity} rolls left in this bulk lot, cannot dispatch ${quantity}.`);
  }
  if (lot.total_length_mm < lengthMm) {
    throw new Error(`Only ${mmToMeters(lot.total_length_mm)} m left in this bulk lot, cannot dispatch ${mmToMeters(lengthMm)} m.`);
  }
  db.prepare(`
    UPDATE bulk_lots SET quantity = quantity - ?, total_length_mm = total_length_mm - ?,
    updated_at = datetime('now','localtime') WHERE id = ?
  `).run(quantity, lengthMm, bulkLotId);
  return lot;
}

/**
 * Change a bulk lot's buying rate. If another lot already exists with the new
 * rate (same product/godown), the two are merged into one row.
 */
function updateBulkLotRate(bulkLotId, newRate) {
  const db = getDb();
  const doUpdate = db.transaction(() => {
    const lot = db.prepare('SELECT * FROM bulk_lots WHERE id = ?').get(bulkLotId);
    if (!lot) throw new Error('Bulk lot not found.');

    const collision = db.prepare(`
      SELECT * FROM bulk_lots
      WHERE product_id = ? AND godown_id = ? AND rate_per_meter = ? AND id != ?
    `).get(lot.product_id, lot.godown_id, newRate, bulkLotId);

    if (collision) {
      db.prepare(`
        UPDATE bulk_lots SET quantity = quantity + ?, total_length_mm = total_length_mm + ?,
        updated_at = datetime('now','localtime') WHERE id = ?
      `).run(lot.quantity, lot.total_length_mm, collision.id);
      db.prepare(`
        UPDATE bulk_lots SET quantity = 0, total_length_mm = 0,
        updated_at = datetime('now','localtime') WHERE id = ?
      `).run(bulkLotId);
      return collision.id;
    }

    db.prepare(`UPDATE bulk_lots SET rate_per_meter = ?, updated_at = datetime('now','localtime') WHERE id = ?`)
      .run(newRate, bulkLotId);
    return bulkLotId;
  });
  const finalId = doUpdate();
  return getBulkLotById(finalId);
}

module.exports = {
  listBulkLotsByProduct,
  listAllBulkLots,
  getBulkLotById,
  findBulkLot,
  addToBulkLot,
  subtractFromBulkLot,
  updateBulkLotRate,
  mmToMeters,
  metersToMm,
};
