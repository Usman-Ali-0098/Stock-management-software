'use strict';

const { ipcMain } = require('electron');
const {
  createInwardTransaction,
  listInwardTransactions,
  getInwardTransactionById,
  createSupplierBill,
  listSupplierBills,
  getSupplierBillById,
  verifyBillItemWithRolls,
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

// ─── Supplier Bills (Mode A) ─────────────────────────────────────────────────

ipcMain.handle('inward:createBill', async (_event, params) => {
  try {
    const data = createSupplierBill(params);
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('inward:listBills', async (_event, filters) => {
  try {
    const data = listSupplierBills(filters || {});
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('inward:getBillById', async (_event, id) => {
  try {
    const data = getSupplierBillById(Number(id));
    if (!data) return { success: false, error: 'Supplier bill not found.' };
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('inward:verifyBillItem', async (_event, params) => {
  try {
    const data = verifyBillItemWithRolls(params);
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

    // Verified physical rolls (available only)
    const rolls = db.prepare(`
      SELECT original_length_mm, COUNT(*) as cnt
      FROM rolls
      WHERE product_id = ? AND godown_id = ? AND status = 'available'
      GROUP BY original_length_mm
      ORDER BY original_length_mm ASC
    `).all(productId, godownId);

    const totalVerifiedRolls = rolls.reduce((s, r) => s + r.cnt, 0);
    const totalVerifiedMeters = rolls.reduce((s, r) => s + mmToMeters(r.original_length_mm) * r.cnt, 0);

    // Pending bill items for this product+godown
    const pending = db.prepare(`
      SELECT sbi.supplier_total_meters, sbi.supplier_total_rolls
      FROM supplier_bill_items sbi
      JOIN supplier_bills sb ON sb.id = sbi.supplier_bill_id
      WHERE sbi.product_id = ? AND sb.godown_id = ? AND sbi.verification_status = 'pending'
    `).all(productId, godownId);

    const totalPendingRolls = pending.reduce((s, p) => s + p.supplier_total_rolls, 0);
    const totalPendingMeters = pending.reduce((s, p) => s + p.supplier_total_meters, 0);

    return {
      success: true,
      data: {
        verifiedRolls: totalVerifiedRolls,
        verifiedMeters: totalVerifiedMeters,
        pendingRolls: totalPendingRolls,
        pendingMeters: totalPendingMeters,
        rollBreakdown: rolls.map(r => ({
          length_meters: mmToMeters(r.original_length_mm),
          count: r.cnt,
        })),
      },
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

