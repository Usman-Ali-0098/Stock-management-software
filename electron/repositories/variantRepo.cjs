'use strict';

const { getDb } = require('../database/init.cjs');
const { mmToMeters, metersToMm } = require('./productRepo.cjs');

function mapVariant(row) {
  return {
    ...row,
    length_meters: mmToMeters(row.length_mm),
  };
}

/** List variants for one product, optionally scoped to a godown. Only quantity > 0 by default. */
function listVariantsByProduct(productId, filters = {}) {
  const db = getDb();
  const conditions = ['v.product_id = ?'];
  const params = [productId];

  if (filters.godownId) {
    conditions.push('v.godown_id = ?');
    params.push(filters.godownId);
  }
  if (filters.includeZero !== true) {
    conditions.push('v.quantity > 0');
  }

  const rows = db.prepare(`
    SELECT v.*, p.product_code, p.product_name, g.name AS godown_name
    FROM variants v
    JOIN products p ON p.id = v.product_id
    LEFT JOIN godowns g ON g.id = v.godown_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY v.length_mm DESC, v.rate_per_meter DESC
  `).all(...params);

  return rows.map(mapVariant);
}

/** List variants across products, optionally scoped to a godown/product. Only quantity > 0 by default. */
function listAllVariants(filters = {}) {
  const db = getDb();
  const conditions = [];
  const params = [];

  if (filters.godownId) {
    conditions.push('v.godown_id = ?');
    params.push(filters.godownId);
  }
  if (filters.productId) {
    conditions.push('v.product_id = ?');
    params.push(filters.productId);
  }
  if (filters.includeZero !== true) {
    conditions.push('v.quantity > 0');
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const rows = db.prepare(`
    SELECT v.*, p.product_code, p.product_name, g.name AS godown_name
    FROM variants v
    JOIN products p ON p.id = v.product_id
    LEFT JOIN godowns g ON g.id = v.godown_id
    ${where}
    ORDER BY v.updated_at DESC
  `).all(...params);

  return rows.map(mapVariant);
}

function getVariantById(id) {
  const db = getDb();
  const row = db.prepare(`
    SELECT v.*, p.product_code, p.product_name, g.name AS godown_name
    FROM variants v
    JOIN products p ON p.id = v.product_id
    LEFT JOIN godowns g ON g.id = v.godown_id
    WHERE v.id = ?
  `).get(id);
  return row ? mapVariant(row) : null;
}

/** Find the variant matching this exact (product, godown, length, rate) combination, if any. */
function findVariant(db, { productId, godownId, lengthMm, ratePerMeter }) {
  return db.prepare(`
    SELECT * FROM variants
    WHERE product_id = ? AND godown_id = ? AND length_mm = ? AND rate_per_meter = ?
  `).get(productId, godownId, lengthMm, ratePerMeter);
}

/**
 * Add `quantity` to the matching variant (creating it if it doesn't exist yet).
 * Must be called inside a transaction. Returns the variant id.
 */
function addToVariant(db, { productId, godownId, lengthMm, ratePerMeter, quantity }) {
  const existing = findVariant(db, { productId, godownId, lengthMm, ratePerMeter });
  if (existing) {
    db.prepare(`UPDATE variants SET quantity = quantity + ?, updated_at = datetime('now','localtime') WHERE id = ?`)
      .run(quantity, existing.id);
    return existing.id;
  }
  const result = db.prepare(`
    INSERT INTO variants (product_id, godown_id, length_mm, rate_per_meter, quantity)
    VALUES (?, ?, ?, ?, ?)
  `).run(productId, godownId, lengthMm, ratePerMeter, quantity);
  return result.lastInsertRowid;
}

/**
 * Subtract `quantity` from a variant. Throws if there isn't enough stock.
 * Must be called inside a transaction.
 */
function subtractFromVariant(db, variantId, quantity) {
  const variant = db.prepare('SELECT * FROM variants WHERE id = ?').get(variantId);
  if (!variant) throw new Error('Stock variant not found.');
  if (variant.quantity < quantity) {
    throw new Error(`Only ${variant.quantity} in stock, cannot dispatch ${quantity}.`);
  }
  db.prepare(`UPDATE variants SET quantity = quantity - ?, updated_at = datetime('now','localtime') WHERE id = ?`)
    .run(quantity, variantId);
  return variant;
}

/**
 * Change a variant's buying rate. If another variant already exists with the
 * new rate (same product/godown/length), the two are merged into one row.
 */
function updateVariantRate(variantId, newRate) {
  const db = getDb();
  const doUpdate = db.transaction(() => {
    const variant = db.prepare('SELECT * FROM variants WHERE id = ?').get(variantId);
    if (!variant) throw new Error('Stock variant not found.');

    const collision = db.prepare(`
      SELECT * FROM variants
      WHERE product_id = ? AND godown_id = ? AND length_mm = ? AND rate_per_meter = ? AND id != ?
    `).get(variant.product_id, variant.godown_id, variant.length_mm, newRate, variantId);

    if (collision) {
      // Move this variant's quantity into the matching one instead of
      // deleting it outright — old inward/outward lines and movement
      // history still reference this row by id, so it must survive with
      // quantity 0 rather than being removed.
      db.prepare(`UPDATE variants SET quantity = quantity + ?, updated_at = datetime('now','localtime') WHERE id = ?`)
        .run(variant.quantity, collision.id);
      // Leave this row's own rate untouched (old inward/outward lines still
      // describe it accurately) — only its live quantity moves to the
      // surviving variant, so it drops out of normal (quantity > 0) listings.
      db.prepare(`UPDATE variants SET quantity = 0, updated_at = datetime('now','localtime') WHERE id = ?`)
        .run(variantId);
      return collision.id;
    }

    db.prepare(`UPDATE variants SET rate_per_meter = ?, updated_at = datetime('now','localtime') WHERE id = ?`)
      .run(newRate, variantId);
    return variantId;
  });
  const finalId = doUpdate();
  return getVariantById(finalId);
}

module.exports = {
  listVariantsByProduct,
  listAllVariants,
  getVariantById,
  findVariant,
  addToVariant,
  subtractFromVariant,
  updateVariantRate,
  mmToMeters,
  metersToMm,
};
