'use strict';

const { ipcMain } = require('electron');
const { createOutwardTransaction, listOutwardTransactions, getOutwardTransactionById } = require('../services/outwardService.cjs');

ipcMain.handle('outward:create', async (_event, args) => {
  try {
    const data = createOutwardTransaction(args);
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('outward:list', async (_event, filters) => {
  try {
    return { success: true, data: listOutwardTransactions(filters || {}) };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('outward:getById', async (_event, id) => {
  try {
    const data = getOutwardTransactionById(id);
    if (!data) return { success: false, error: 'Transaction not found.' };
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
