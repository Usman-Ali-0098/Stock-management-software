'use strict';

const { ipcMain } = require('electron');
const { listProducts, getProductById, createProduct, updateProduct } = require('../repositories/productRepo.cjs');

ipcMain.handle('products:list', async (_event, args) => {
  try {
    const includeInactive = typeof args === 'boolean' ? args : (args?.includeInactive ?? false);
    const godownId = typeof args === 'object' ? (args?.godownId ?? null) : null;
    return { success: true, data: listProducts(includeInactive, godownId) };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('products:getById', async (_event, args) => {
  try {
    const id = typeof args === 'object' ? args.id : args;
    const godownId = typeof args === 'object' ? args.godownId : null;
    const data = getProductById(id, godownId);
    if (!data) return { success: false, error: 'Product not found.' };
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('products:create', async (_event, args) => {
  try {
    const data = createProduct(args);
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('products:update', async (_event, args) => {
  try {
    const { id, ...updates } = args;
    const data = updateProduct(id, updates);
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('products:getStockSummary', async (_event, args) => {
  try {
    const productId = typeof args === 'object' ? args.productId : args;
    const godownId = typeof args === 'object' ? args.godownId : null;
    const data = getProductById(productId, godownId);
    if (!data) return { success: false, error: 'Product not found.' };
    return { success: true, data: { available_rolls: data.available_rolls, total_available_meters: data.total_available_meters } };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
