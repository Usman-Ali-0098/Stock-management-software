'use strict';

const { ipcMain } = require('electron');
const { listGodowns, getGodownById, createGodown, updateGodown } = require('../repositories/godownRepo.cjs');

ipcMain.handle('godowns:list', async (_event, includeInactive) => {
  try {
    const data = listGodowns(Boolean(includeInactive));
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('godowns:getById', async (_event, id) => {
  try {
    const data = getGodownById(Number(id));
    if (!data) return { success: false, error: 'Godown not found.' };
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('godowns:create', async (_event, params) => {
  try {
    const data = createGodown(params);
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('godowns:update', async (_event, { id, ...data }) => {
  try {
    const updated = updateGodown(Number(id), data);
    return { success: true, data: updated };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
