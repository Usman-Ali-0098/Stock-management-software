'use strict';

const { getDb } = require('../database/init.cjs');

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Convert meters (number) to millimeters (integer). Rounds to nearest mm. */
function metersToMm(meters) {
  return Math.round(meters * 1000);
}

/** Convert millimeters (integer) to meters (number, 3 dp). */
function mmToMeters(mm) {
  return mm / 1000;
}

// ─── Product Queries ─────────────────────────────────────────────────────────

function listProducts(includeInactive = false, godownId = null) {
  const db = getDb();
  const whereClauses = [];
  const params = [];

  if (!includeInactive) {
    whereClauses.push('p.is_active = 1');
  }

  const where = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

  let rollJoin = "ON r.product_id = p.id AND r.status = 'available'";
  if (godownId != null) {
    rollJoin += " AND r.godown_id = ?";
    params.push(godownId);
  }

  const rows = db.prepare(`
    SELECT
      p.id,
      p.product_code,
      p.product_name,
      p.description,
      p.is_active,
      p.created_at,
      p.updated_at,
      COUNT(r.id)                                                AS available_rolls,
      COALESCE(SUM(r.remaining_length_mm), 0)                   AS total_available_mm
    FROM products p
    LEFT JOIN rolls r ${rollJoin}
    ${where}
    GROUP BY p.id
    ORDER BY p.product_name ASC
  `).all(...params);

  return rows.map(r => ({
    ...r,
    is_active: r.is_active === 1,
    available_rolls: r.available_rolls || 0,
    total_available_meters: mmToMeters(r.total_available_mm || 0),
  }));
}

function getProductById(id, godownId = null) {
  const db = getDb();
  let rollJoin = "ON r.product_id = p.id AND r.status = 'available'";
  const params = [];

  if (godownId != null) {
    rollJoin += " AND r.godown_id = ?";
    params.push(godownId);
  }
  params.push(id);

  const row = db.prepare(`
    SELECT
      p.id,
      p.product_code,
      p.product_name,
      p.description,
      p.is_active,
      p.created_at,
      p.updated_at,
      COUNT(r.id)                                                AS available_rolls,
      COALESCE(SUM(r.remaining_length_mm), 0)                   AS total_available_mm
    FROM products p
    LEFT JOIN rolls r ${rollJoin}
    WHERE p.id = ?
    GROUP BY p.id
  `).get(...params);

  if (!row) return null;
  return {
    ...row,
    is_active: row.is_active === 1,
    available_rolls: row.available_rolls || 0,
    total_available_meters: mmToMeters(row.total_available_mm || 0),
  };
}

function createProduct({ product_code, product_name, description = '' }) {
  const db = getDb();

  // Check for duplicate code
  const existing = db.prepare(
    'SELECT id FROM products WHERE product_code = ? COLLATE NOCASE'
  ).get(product_code.trim());
  if (existing) {
    throw new Error(`Product code "${product_code}" already exists.`);
  }

  const result = db.prepare(`
    INSERT INTO products (product_code, product_name, description)
    VALUES (?, ?, ?)
  `).run(product_code.trim(), product_name.trim(), (description || '').trim());

  return getProductById(result.lastInsertRowid);
}

function updateProduct(id, { product_name, description, is_active }) {
  const db = getDb();

  const updates = [];
  const params = [];

  if (product_name !== undefined) {
    updates.push('product_name = ?');
    params.push(product_name.trim());
  }
  if (description !== undefined) {
    updates.push('description = ?');
    params.push(description.trim());
  }
  if (is_active !== undefined) {
    updates.push('is_active = ?');
    params.push(is_active ? 1 : 0);
  }
  updates.push("updated_at = datetime('now', 'localtime')");

  params.push(id);

  db.prepare(`UPDATE products SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  return getProductById(id);
}

module.exports = {
  listProducts,
  getProductById,
  createProduct,
  updateProduct,
  metersToMm,
  mmToMeters,
};
