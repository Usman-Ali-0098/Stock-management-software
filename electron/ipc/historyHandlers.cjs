'use strict';

const { ipcMain } = require('electron');
const { getDb } = require('../database/init.cjs');
const { mmToMeters } = require('../repositories/productRepo.cjs');

/**
 * Combined history view — both inward and outward movements for a godown.
 */
ipcMain.handle('history:list', async (_event, filters) => {
  try {
    const db = getDb();
    const f = filters || {};

    const inwardConditions = ['1=1'];
    const outwardConditions = ['1=1'];
    const inParams = [];
    const outParams = [];

    if (f.godownId) {
      inwardConditions.push('it.godown_id = ?');
      inParams.push(f.godownId);
      outwardConditions.push('ot.godown_id = ?');
      outParams.push(f.godownId);
    }
    if (f.productId) {
      inwardConditions.push('r.product_id = ?');
      inParams.push(f.productId);
      outwardConditions.push('r.product_id = ?');
      outParams.push(f.productId);
    }
    if (f.rollCode) {
      inwardConditions.push('r.roll_code LIKE ?');
      inParams.push(`%${f.rollCode}%`);
      outwardConditions.push('r.roll_code LIKE ?');
      outParams.push(`%${f.rollCode}%`);
    }
    if (f.slipNumber) {
      inwardConditions.push('it.slip_number LIKE ?');
      inParams.push(`%${f.slipNumber}%`);
      outwardConditions.push('ot.slip_number LIKE ?');
      outParams.push(`%${f.slipNumber}%`);
    }
    if (f.dateFrom) {
      inwardConditions.push('it.transaction_date >= ?');
      inParams.push(f.dateFrom);
      outwardConditions.push('ot.transaction_date >= ?');
      outParams.push(f.dateFrom);
    }
    if (f.dateTo) {
      inwardConditions.push('it.transaction_date <= ?');
      inParams.push(f.dateTo + ' 23:59:59');
      outwardConditions.push('ot.transaction_date <= ?');
      outParams.push(f.dateTo + ' 23:59:59');
    }

    const rows = [];

    // Include inward transactions
    if (!f.type || f.type === 'all' || f.type === 'inward') {
      const inwardRows = db.prepare(`
        SELECT
          'inward' AS type,
          it.id AS transaction_id,
          it.godown_id,
          g.name AS godown_name,
          it.slip_number,
          it.transaction_date,
          it.reference_note AS reference,
          r.id AS roll_id,
          r.roll_code,
          r.original_length_mm AS length_mm,
          p.id AS product_id,
          p.product_code,
          p.product_name
        FROM inward_transactions it
        LEFT JOIN godowns g ON g.id = it.godown_id
        JOIN inward_transaction_items iti ON iti.inward_transaction_id = it.id
        JOIN rolls r ON r.id = iti.roll_id
        JOIN products p ON p.id = r.product_id
        WHERE ${inwardConditions.join(' AND ')}
        ORDER BY it.transaction_date DESC, it.id DESC
      `).all(...inParams);
      rows.push(...inwardRows);
    }

    // Include outward transactions
    if (!f.type || f.type === 'all' || f.type === 'outward') {
      const outwardRows = db.prepare(`
        SELECT
          'outward' AS type,
          ot.id AS transaction_id,
          ot.godown_id,
          g.name AS godown_name,
          ot.slip_number,
          ot.transaction_date,
          ot.recipient_reference AS reference,
          r.id AS roll_id,
          r.roll_code,
          oti.issued_length_mm AS length_mm,
          p.id AS product_id,
          p.product_code,
          p.product_name
        FROM outward_transactions ot
        LEFT JOIN godowns g ON g.id = ot.godown_id
        JOIN outward_transaction_items oti ON oti.outward_transaction_id = ot.id
        JOIN rolls r ON r.id = oti.roll_id
        JOIN products p ON p.id = r.product_id
        WHERE ${outwardConditions.join(' AND ')}
        ORDER BY ot.transaction_date DESC, ot.id DESC
      `).all(...outParams);
      rows.push(...outwardRows);
    }

    // Sort combined result by date desc
    rows.sort((a, b) => b.transaction_date.localeCompare(a.transaction_date));

    return {
      success: true,
      data: rows.map(r => ({
        ...r,
        length_meters: mmToMeters(r.length_mm),
      })),
    };
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
