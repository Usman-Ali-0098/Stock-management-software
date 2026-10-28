'use strict';

const { ipcMain } = require('electron');
const { getDb } = require('../database/init.cjs');
const { mmToMeters } = require('../repositories/productRepo.cjs');

/**
 * Combined history view — every inward/outward stock movement, across every
 * variant (product + roll size + godown).
 */
ipcMain.handle('history:list', async (_event, filters) => {
  try {
    const db = getDb();
    const f = filters || {};

    const conditions = ['1=1'];
    const params = [];

    if (f.godownId) {
      conditions.push('v.godown_id = ?');
      params.push(f.godownId);
    }
    if (f.productId) {
      conditions.push('v.product_id = ?');
      params.push(f.productId);
    }
    if (f.type && f.type !== 'all') {
      conditions.push('sm.movement_type = ?');
      params.push(f.type);
    }
    if (f.slipNumber) {
      conditions.push('sm.slip_number LIKE ?');
      params.push(`%${f.slipNumber}%`);
    }
    if (f.dateFrom) {
      conditions.push('sm.event_timestamp >= ?');
      params.push(f.dateFrom);
    }
    if (f.dateTo) {
      conditions.push('sm.event_timestamp <= ?');
      params.push(f.dateTo + ' 23:59:59');
    }

    const rows = db.prepare(`
      SELECT
        sm.movement_type AS type,
        sm.transaction_id,
        sm.slip_number,
        sm.event_timestamp AS transaction_date,
        sm.reference,
        sm.quantity,
        sm.rate_per_meter,
        v.id AS variant_id,
        v.length_mm,
        v.godown_id,
        g.name AS godown_name,
        p.id AS product_id, p.product_code, p.product_name,
        0 AS is_bulk
      FROM stock_movements sm
      JOIN variants v ON v.id = sm.variant_id
      JOIN products p ON p.id = v.product_id
      LEFT JOIN godowns g ON g.id = v.godown_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY sm.event_timestamp DESC, sm.id DESC
    `).all(...params);

    // Bulk movements use the same filters, but join through bulk_lots instead of variants.
    const bulkConditions = ['1=1'];
    const bulkParams = [];
    if (f.godownId) { bulkConditions.push('b.godown_id = ?'); bulkParams.push(f.godownId); }
    if (f.productId) { bulkConditions.push('b.product_id = ?'); bulkParams.push(f.productId); }
    if (f.type && f.type !== 'all') { bulkConditions.push('bsm.movement_type = ?'); bulkParams.push(f.type); }
    if (f.slipNumber) { bulkConditions.push('bsm.slip_number LIKE ?'); bulkParams.push(`%${f.slipNumber}%`); }
    if (f.dateFrom) { bulkConditions.push('bsm.event_timestamp >= ?'); bulkParams.push(f.dateFrom); }
    if (f.dateTo) { bulkConditions.push('bsm.event_timestamp <= ?'); bulkParams.push(f.dateTo + ' 23:59:59'); }

    const bulkRows = db.prepare(`
      SELECT
        bsm.movement_type AS type,
        bsm.transaction_id,
        bsm.slip_number,
        bsm.event_timestamp AS transaction_date,
        bsm.reference,
        bsm.quantity,
        bsm.rate_per_meter,
        b.id AS bulk_lot_id,
        bsm.length_mm,
        b.godown_id,
        g.name AS godown_name,
        p.id AS product_id, p.product_code, p.product_name,
        1 AS is_bulk
      FROM bulk_stock_movements bsm
      JOIN bulk_lots b ON b.id = bsm.bulk_lot_id
      JOIN products p ON p.id = b.product_id
      LEFT JOIN godowns g ON g.id = b.godown_id
      WHERE ${bulkConditions.join(' AND ')}
      ORDER BY bsm.event_timestamp DESC, bsm.id DESC
    `).all(...bulkParams);

    const combined = [...rows, ...bulkRows]
      .map(r => ({ ...r, length_meters: mmToMeters(r.length_mm), is_bulk: !!r.is_bulk }))
      .sort((a, b) => b.transaction_date.localeCompare(a.transaction_date));

    return { success: true, data: combined };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('history:getBySlip', async (_event, { type, slipNumber }) => {
  try {
    if (type === 'inward') {
      const { getInwardTransactionById } = require('../services/inwardService.cjs');
      const db = getDb();
      const tx = db.prepare('SELECT id FROM inward_transactions WHERE slip_number = ?').get(slipNumber);
      if (!tx) return { success: false, error: 'Slip not found.' };
      return { success: true, data: getInwardTransactionById(tx.id) };
    } else {
      const { getOutwardTransactionById } = require('../services/outwardService.cjs');
      const db = getDb();
      const tx = db.prepare('SELECT id FROM outward_transactions WHERE slip_number = ?').get(slipNumber);
      if (!tx) return { success: false, error: 'Slip not found.' };
      return { success: true, data: getOutwardTransactionById(tx.id) };
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
});
