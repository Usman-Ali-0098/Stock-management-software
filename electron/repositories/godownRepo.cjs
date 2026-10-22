'use strict';

const { getDb } = require('../database/init.cjs');
const { mmToMeters } = require('./productRepo.cjs');

function listGodowns(includeInactive = false) {
  const db = getDb();
  const where = includeInactive ? '' : 'WHERE g.is_active = 1';
  const rows = db.prepare(`
    SELECT
      g.id,
      g.name,
      g.address,
      g.is_active,
      g.created_at,
      COUNT(CASE WHEN r.status = 'available' THEN 1 END) AS available_rolls,
      COALESCE(SUM(CASE WHEN r.status = 'available' THEN r.remaining_length_mm ELSE 0 END), 0) AS total_available_mm
    FROM godowns g
    LEFT JOIN rolls r ON r.godown_id = g.id
    ${where}
    GROUP BY g.id
    ORDER BY g.id ASC
  `).all();

  return rows.map(r => ({
    ...r,
    is_active: r.is_active === 1,
    available_rolls: r.available_rolls || 0,
    total_available_meters: mmToMeters(r.total_available_mm || 0),
  }));
}

function getGodownById(id) {
  const db = getDb();
  const row = db.prepare(`
    SELECT
      g.id,
      g.name,
      g.address,
      g.is_active,
      g.created_at,
      COUNT(CASE WHEN r.status = 'available' THEN 1 END) AS available_rolls,
      COALESCE(SUM(CASE WHEN r.status = 'available' THEN r.remaining_length_mm ELSE 0 END), 0) AS total_available_mm
    FROM godowns g
    LEFT JOIN rolls r ON r.godown_id = g.id
    WHERE g.id = ?
    GROUP BY g.id
  `).get(id);

  if (!row) return null;
  return {
    ...row,
    is_active: row.is_active === 1,
    available_rolls: row.available_rolls || 0,
    total_available_meters: mmToMeters(row.total_available_mm || 0),
  };
}

function createGodown({ name, address = '' }) {
  const db = getDb();
  const trimmedName = (name || '').trim();
  if (!trimmedName) {
    throw new Error('Godown name is required.');
  }

  const existing = db.prepare('SELECT id FROM godowns WHERE name = ? COLLATE NOCASE').get(trimmedName);
  if (existing) {
    throw new Error(`Godown with name "${trimmedName}" already exists.`);
  }

  const result = db.prepare(`
    INSERT INTO godowns (name, address)
    VALUES (?, ?)
  `).run(trimmedName, (address || '').trim());

  return getGodownById(result.lastInsertRowid);
}

function updateGodown(id, { name, address, is_active }) {
  const db = getDb();
  const updates = [];
  const params = [];

  if (name !== undefined) {
    const trimmedName = name.trim();
    if (!trimmedName) throw new Error('Godown name cannot be empty.');
    const duplicate = db.prepare('SELECT id FROM godowns WHERE name = ? COLLATE NOCASE AND id != ?').get(trimmedName, id);
    if (duplicate) throw new Error(`Another godown already has the name "${trimmedName}".`);
    updates.push('name = ?');
    params.push(trimmedName);
  }

  if (address !== undefined) {
    updates.push('address = ?');
    params.push((address || '').trim());
  }

  if (is_active !== undefined) {
    updates.push('is_active = ?');
    params.push(is_active ? 1 : 0);
  }

  if (updates.length === 0) {
    return getGodownById(id);
  }

  params.push(id);
  db.prepare(`UPDATE godowns SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  return getGodownById(id);
}

module.exports = {
  listGodowns,
  getGodownById,
  createGodown,
  updateGodown,
};
