'use strict';

const { ipcMain } = require('electron');
const { getDb } = require('../database/init.cjs');
const { mmToMeters } = require('../repositories/productRepo.cjs');
const {
  listBulkLotsByProduct, listAllBulkLots, getBulkLotById, updateBulkLotRate,
} = require('../repositories/bulkLotRepo.cjs');

ipcMain.handle('bulk:listByProduct', async (_event, args) => {
  try {
    const { productId, godownId, includeZero } = args || {};
    return { success: true, data: listBulkLotsByProduct(productId, { godownId, includeZero }) };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('bulk:listAll', async (_event, args) => {
  try {
    const { godownId, productId, includeZero } = args || {};
    return { success: true, data: listAllBulkLots({ godownId, productId, includeZero }) };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('bulk:getById', async (_event, id) => {
  try {
    const data = getBulkLotById(id);
    if (!data) return { success: false, error: 'Bulk lot not found.' };
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('bulk:updateRate', async (_event, args) => {
  try {
    const { bulkLotId, ratePerMeter } = args || {};
    const rate = Number(ratePerMeter);
    if (!bulkLotId) throw new Error('Bulk lot is required.');
    if (!Number.isFinite(rate) || rate < 0) throw new Error('Enter a valid rate.');
    const data = updateBulkLotRate(bulkLotId, rate);
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

/** Full movement (inward/outward) history for one bulk lot. */
ipcMain.handle('bulk:getMovements', async (_event, bulkLotId) => {
  try {
    const db = getDb();
    const lot = getBulkLotById(bulkLotId);
    if (!lot) return { success: false, error: 'Bulk lot not found.' };

    const movements = db.prepare(`
      SELECT * FROM bulk_stock_movements
      WHERE bulk_lot_id = ?
      ORDER BY event_timestamp DESC, id DESC
    `).all(bulkLotId);

    return {
      success: true,
      data: {
        lot,
        movements: movements.map(m => ({
          ...m,
          length_meters: mmToMeters(m.length_mm),
        })),
      },
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
