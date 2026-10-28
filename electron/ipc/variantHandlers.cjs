'use strict';

const { ipcMain } = require('electron');
const { getDb } = require('../database/init.cjs');
const {
  listVariantsByProduct, listAllVariants, getVariantById, updateVariantRate,
} = require('../repositories/variantRepo.cjs');

ipcMain.handle('variants:listByProduct', async (_event, args) => {
  try {
    const { productId, godownId, includeZero } = args || {};
    return { success: true, data: listVariantsByProduct(productId, { godownId, includeZero }) };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('variants:listAll', async (_event, args) => {
  try {
    const { godownId, productId, includeZero } = args || {};
    return { success: true, data: listAllVariants({ godownId, productId, includeZero }) };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('variants:getById', async (_event, id) => {
  try {
    const data = getVariantById(id);
    if (!data) return { success: false, error: 'Stock variant not found.' };
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('variants:updateRate', async (_event, args) => {
  try {
    const { variantId, ratePerMeter } = args || {};
    const rate = Number(ratePerMeter);
    if (!variantId) throw new Error('Stock variant is required.');
    if (!Number.isFinite(rate) || rate < 0) throw new Error('Enter a valid rate.');
    const data = updateVariantRate(variantId, rate);
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

/** Full movement (inward/outward) history for one stock variant. */
ipcMain.handle('variants:getMovements', async (_event, variantId) => {
  try {
    const db = getDb();
    const variant = getVariantById(variantId);
    if (!variant) return { success: false, error: 'Stock variant not found.' };

    const movements = db.prepare(`
      SELECT * FROM stock_movements
      WHERE variant_id = ?
      ORDER BY event_timestamp DESC, id DESC
    `).all(variantId);

    return {
      success: true,
      data: {
        variant,
        movements: movements.map(m => ({
          ...m,
          length_meters: variant.length_meters,
        })),
      },
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
