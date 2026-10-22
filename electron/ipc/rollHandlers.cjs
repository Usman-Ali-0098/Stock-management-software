'use strict';

const { ipcMain } = require('electron');
const { getRollById, getRollByCode, listRollsByProduct, listAllRolls, getRollHistory } = require('../repositories/rollRepo.cjs');
const { metersToMm } = require('../repositories/productRepo.cjs');

ipcMain.handle('rolls:listByProduct', async (_event, args) => {
  try {
    const { productId, godownId, status, exactLengthMeters, minLengthMeters, maxLengthMeters } = args || {};

    const filters = { status, godownId };
    if (exactLengthMeters != null) filters.exactLengthMm = metersToMm(exactLengthMeters);
    if (minLengthMeters != null) filters.minLengthMm = metersToMm(minLengthMeters);
    if (maxLengthMeters != null) filters.maxLengthMm = metersToMm(maxLengthMeters);

    return { success: true, data: listRollsByProduct(productId, filters) };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('rolls:listAvailable', async (_event, args) => {
  try {
    const { productId, godownId, exactLengthMeters, minLengthMeters, maxLengthMeters, rollCode } = args || {};

    const filters = { status: 'available', godownId, rollCode };
    if (productId) filters.productId = productId;
    if (exactLengthMeters != null) filters.exactLengthMm = metersToMm(exactLengthMeters);
    if (minLengthMeters != null) filters.minLengthMm = metersToMm(minLengthMeters);
    if (maxLengthMeters != null) filters.maxLengthMm = metersToMm(maxLengthMeters);

    return { success: true, data: listAllRolls(filters) };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('rolls:getById', async (_event, id) => {
  try {
    const data = getRollById(id);
    if (!data) return { success: false, error: 'Roll not found.' };
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('rolls:getByCode', async (_event, rollCode) => {
  try {
    const data = getRollByCode(rollCode);
    if (!data) return { success: false, error: 'Roll not found.' };
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('rolls:getHistory', async (_event, rollIdOrCode) => {
  try {
    const data = getRollHistory(rollIdOrCode);
    if (!data) return { success: false, error: 'Roll not found.' };
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
