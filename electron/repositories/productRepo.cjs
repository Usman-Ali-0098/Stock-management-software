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

  let variantJoin = "ON v.product_id = p.id AND v.quantity > 0";

  let bulkWhere = "b.product_id = p.id";
  if (godownId != null) {
    bulkWhere += " AND b.godown_id = ?";
  }
  // Params must be pushed in the same order the "?" placeholders appear in the SQL
  // text below: the two bulk-lot subqueries come first (inside the SELECT list),
  // then the variant join condition.
  if (godownId != null) params.push(godownId, godownId);
  if (godownId != null) {
    variantJoin += " AND v.godown_id = ?";
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
      COALESCE(SUM(v.quantity), 0)                               AS available_rolls,
      COALESCE(SUM(v.quantity * v.length_mm), 0)                AS total_available_mm,
      COALESCE((SELECT SUM(b.quantity) FROM bulk_lots b WHERE ${bulkWhere}), 0)        AS bulk_rolls,
      COALESCE((SELECT SUM(b.total_length_mm) FROM bulk_lots b WHERE ${bulkWhere}), 0) AS bulk_mm
    FROM products p
    LEFT JOIN variants v ${variantJoin}
    ${where}
    GROUP BY p.id
    ORDER BY p.product_name ASC
  `).all(...params);

  return rows.map(r => ({
    ...r,
    is_active: r.is_active === 1,
    available_rolls: (r.available_rolls || 0) + (r.bulk_rolls || 0),
    total_available_meters: mmToMeters((r.total_available_mm || 0) + (r.bulk_mm || 0)),
    bulk_rolls: r.bulk_rolls || 0,
    bulk_meters: mmToMeters(r.bulk_mm || 0),
    has_bulk: (r.bulk_rolls || 0) > 0,
  }));
}

function getProductById(id, godownId = null) {
  const db = getDb();
  let variantJoin = "ON v.product_id = p.id AND v.quantity > 0";
  let bulkWhere = "b.product_id = p.id";
  const params = [];

  if (godownId != null) {
    bulkWhere += " AND b.godown_id = ?";
  }
  // Params follow the "?" placeholder order in the SQL text: the two bulk
  // subqueries (SELECT list) first, then the variant join, then WHERE p.id.
  if (godownId != null) params.push(godownId, godownId);
  if (godownId != null) {
    variantJoin += " AND v.godown_id = ?";
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
      COALESCE(SUM(v.quantity), 0)                               AS available_rolls,
      COALESCE(SUM(v.quantity * v.length_mm), 0)                AS total_available_mm,
      COALESCE((SELECT SUM(b.quantity) FROM bulk_lots b WHERE ${bulkWhere}), 0)        AS bulk_rolls,
      COALESCE((SELECT SUM(b.total_length_mm) FROM bulk_lots b WHERE ${bulkWhere}), 0) AS bulk_mm
    FROM products p
    LEFT JOIN variants v ${variantJoin}
    WHERE p.id = ?
    GROUP BY p.id
  `).get(...params);

  if (!row) return null;
  return {
    ...row,
    is_active: row.is_active === 1,
    available_rolls: (row.available_rolls || 0) + (row.bulk_rolls || 0),
    total_available_meters: mmToMeters((row.total_available_mm || 0) + (row.bulk_mm || 0)),
    bulk_rolls: row.bulk_rolls || 0,
    bulk_meters: mmToMeters(row.bulk_mm || 0),
    has_bulk: (row.bulk_rolls || 0) > 0,
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
