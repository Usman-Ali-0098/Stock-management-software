'use strict';

const { ipcMain } = require('electron');
const {
  createInwardTransaction,
  createBulkInwardTransaction,
  listInwardTransactions,
  getInwardTransactionById,
} = require('../services/inwardService.cjs');

// ─── Inward Transactions ─────────────────────────────────────────────────────

ipcMain.handle('inward:create', async (_event, args) => {
  try {
    const data = createInwardTransaction(args);
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('inward:createBulk', async (_event, args) => {
  try {
    const data = createBulkInwardTransaction(args);
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('inward:list', async (_event, filters) => {
  try {
    return { success: true, data: listInwardTransactions(filters || {}) };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('inward:getById', async (_event, id) => {
  try {
    const data = getInwardTransactionById(id);
    if (!data) return { success: false, error: 'Transaction not found.' };
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ─── Stock summary for a product+godown combo (used by InwardPage live panel) ─
const { getDb } = require('../database/init.cjs');
const { mmToMeters } = require('../repositories/productRepo.cjs');

ipcMain.handle('inward:productStock', async (_event, { productId, godownId }) => {
  try {
    const db = getDb();

    const variants = db.prepare(`
      SELECT length_mm, rate_per_meter, quantity
      FROM variants
      WHERE product_id = ? AND godown_id = ? AND quantity > 0
      ORDER BY length_mm ASC
    `).all(productId, godownId);

    const bulkLots = db.prepare(`
      SELECT total_length_mm, rate_per_meter, quantity
      FROM bulk_lots
      WHERE product_id = ? AND godown_id = ? AND quantity > 0
    `).all(productId, godownId);

    const totalRolls = variants.reduce((s, v) => s + v.quantity, 0)
      + bulkLots.reduce((s, b) => s + b.quantity, 0);
    const totalMeters = variants.reduce((s, v) => s + mmToMeters(v.length_mm) * v.quantity, 0)
      + bulkLots.reduce((s, b) => s + mmToMeters(b.total_length_mm), 0);

    return {
      success: true,
      data: {
        verifiedRolls: totalRolls,
        verifiedMeters: totalMeters,
        rollBreakdown: variants.map(v => ({
          length_meters: mmToMeters(v.length_mm),
          count: v.quantity,
        })),
        bulkBreakdown: bulkLots.map(b => ({
          total_length_meters: mmToMeters(b.total_length_mm),
          count: b.quantity,
        })),
      },
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
