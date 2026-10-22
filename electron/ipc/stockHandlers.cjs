'use strict';

const { ipcMain } = require('electron');
const { getDb } = require('../database/init.cjs');
const { mmToMeters, metersToMm } = require('../repositories/productRepo.cjs');
const { listAllRolls } = require('../repositories/rollRepo.cjs');

/** Dashboard summary — supports 'all' (overall warehouse) or a specific godown */
ipcMain.handle('stock:dashboard', async (_event, args) => {
  try {
    const db = getDb();
    const rawId = typeof args === 'object' ? args?.godownId : args;
    const isOverall = rawId === 'all' || rawId === 0 || rawId === null || rawId === undefined;
    const godownId = isOverall ? 'all' : Number(rawId);
    const today = new Date().toISOString().slice(0, 10);

    // List all active godowns with their respective roll counts and meters
    const godownsBreakdown = db.prepare(`
      SELECT
        g.id, g.name, g.address,
        COUNT(CASE WHEN r.status = 'available' THEN 1 END) as available_rolls,
        COALESCE(SUM(CASE WHEN r.status = 'available' THEN r.remaining_length_mm ELSE 0 END), 0) as total_available_mm,
        COUNT(DISTINCT CASE WHEN r.status = 'available' THEN r.product_id END) as product_count
      FROM godowns g
      LEFT JOIN rolls r ON r.godown_id = g.id
      WHERE g.is_active = 1
      GROUP BY g.id
      ORDER BY g.id ASC
    `).all().map(g => ({
      ...g,
      total_available_meters: mmToMeters(g.total_available_mm || 0),
    }));

    let godownName = 'Overall Warehouse (All Godowns)';
    if (!isOverall) {
      const g = db.prepare('SELECT name, address FROM godowns WHERE id = ?').get(godownId);
      if (g) godownName = g.name;
    }

    // Available rolls and meters
    let totals;
    if (isOverall) {
      totals = db.prepare(`
        SELECT
          COUNT(*) as total_available_rolls,
          COALESCE(SUM(remaining_length_mm), 0) as total_available_mm
        FROM rolls
        WHERE status = 'available'
      `).get();
    } else {
      totals = db.prepare(`
        SELECT
          COUNT(*) as total_available_rolls,
          COALESCE(SUM(remaining_length_mm), 0) as total_available_mm
        FROM rolls
        WHERE status = 'available' AND godown_id = ?
      `).get(godownId);
    }

    // Per-product breakdown
    let byProduct;
    if (isOverall) {
      byProduct = db.prepare(`
        SELECT
          p.id, p.product_code, p.product_name,
          COUNT(r.id) as available_rolls,
          COALESCE(SUM(r.remaining_length_mm), 0) as total_available_mm
        FROM products p
        LEFT JOIN rolls r ON r.product_id = p.id AND r.status = 'available'
        WHERE p.is_active = 1
        GROUP BY p.id
        ORDER BY p.product_name ASC
      `).all();
    } else {
      byProduct = db.prepare(`
        SELECT
          p.id, p.product_code, p.product_name,
          COUNT(r.id) as available_rolls,
          COALESCE(SUM(r.remaining_length_mm), 0) as total_available_mm
        FROM products p
        LEFT JOIN rolls r ON r.product_id = p.id AND r.status = 'available' AND r.godown_id = ?
        WHERE p.is_active = 1
        GROUP BY p.id
        ORDER BY p.product_name ASC
      `).all(godownId);
    }

    // Today's inward/outward counts
    let todayInward, todayOutward;
    if (isOverall) {
      todayInward = db.prepare(`
        SELECT COUNT(*) as cnt FROM inward_transactions WHERE transaction_date LIKE ?
      `).get(`${today}%`);
      todayOutward = db.prepare(`
        SELECT COUNT(*) as cnt FROM outward_transactions WHERE transaction_date LIKE ?
      `).get(`${today}%`);
    } else {
      todayInward = db.prepare(`
        SELECT COUNT(*) as cnt FROM inward_transactions WHERE godown_id = ? AND transaction_date LIKE ?
      `).get(godownId, `${today}%`);
      todayOutward = db.prepare(`
        SELECT COUNT(*) as cnt FROM outward_transactions WHERE godown_id = ? AND transaction_date LIKE ?
      `).get(godownId, `${today}%`);
    }

    // Recently received rolls
    let recentInward;
    if (isOverall) {
      recentInward = db.prepare(`
        SELECT r.id, r.roll_code, r.original_length_mm, r.received_at,
               p.product_name, p.product_code,
               it.slip_number, g.name AS godown_name
        FROM rolls r
        JOIN products p ON p.id = r.product_id
        JOIN inward_transactions it ON it.id = r.inward_transaction_id
        LEFT JOIN godowns g ON g.id = r.godown_id
        ORDER BY r.received_at DESC, r.id DESC
        LIMIT 10
      `).all();
    } else {
      recentInward = db.prepare(`
        SELECT r.id, r.roll_code, r.original_length_mm, r.received_at,
               p.product_name, p.product_code,
               it.slip_number, g.name AS godown_name
        FROM rolls r
        JOIN products p ON p.id = r.product_id
        JOIN inward_transactions it ON it.id = r.inward_transaction_id
        LEFT JOIN godowns g ON g.id = r.godown_id
        WHERE r.godown_id = ?
        ORDER BY r.received_at DESC, r.id DESC
        LIMIT 10
      `).all(godownId);
    }

    // Recently issued rolls
    let recentOutward;
    if (isOverall) {
      recentOutward = db.prepare(`
        SELECT r.id, r.roll_code, oti.issued_length_mm, ot.transaction_date,
               p.product_name, p.product_code,
               ot.slip_number, ot.recipient_reference, g.name AS godown_name
        FROM outward_transaction_items oti
        JOIN rolls r ON r.id = oti.roll_id
        JOIN outward_transactions ot ON ot.id = oti.outward_transaction_id
        JOIN products p ON p.id = r.product_id
        LEFT JOIN godowns g ON g.id = ot.godown_id
        ORDER BY ot.transaction_date DESC, ot.id DESC
        LIMIT 10
      `).all();
    } else {
      recentOutward = db.prepare(`
        SELECT r.id, r.roll_code, oti.issued_length_mm, ot.transaction_date,
               p.product_name, p.product_code,
               ot.slip_number, ot.recipient_reference, g.name AS godown_name
        FROM outward_transaction_items oti
        JOIN rolls r ON r.id = oti.roll_id
        JOIN outward_transactions ot ON ot.id = oti.outward_transaction_id
        JOIN products p ON p.id = r.product_id
        LEFT JOIN godowns g ON g.id = ot.godown_id
        WHERE ot.godown_id = ?
        ORDER BY ot.transaction_date DESC, ot.id DESC
        LIMIT 10
      `).all(godownId);
    }

    return {
      success: true,
      data: {
        godownId,
        godownName,
        isOverall,
        totalAvailableRolls: totals.total_available_rolls || 0,
        totalAvailableMeters: mmToMeters(totals.total_available_mm || 0),
        godownsBreakdown,
        byProduct: byProduct.map(p => ({
          ...p,
          available_rolls: p.available_rolls || 0,
          total_available_meters: mmToMeters(p.total_available_mm || 0),
        })),
        todayInwardCount: todayInward.cnt || 0,
        todayOutwardCount: todayOutward.cnt || 0,
        recentInward: recentInward.map(r => ({
          ...r,
          original_length_meters: mmToMeters(r.original_length_mm),
        })),
        recentOutward: recentOutward.map(r => ({
          ...r,
          issued_length_meters: mmToMeters(r.issued_length_mm),
        })),
      },
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

/** Current stock summary (product-level view) for a specific godown */
ipcMain.handle('stock:summary', async (_event, args) => {
  try {
    const db = getDb();
    const godownId = (typeof args === 'object' ? args?.godownId : args) || 1;

    const rows = db.prepare(`
      SELECT
        p.id, p.product_code, p.product_name, p.is_active,
        COUNT(CASE WHEN r.status = 'available' THEN 1 END) AS available_rolls,
        COALESCE(SUM(CASE WHEN r.status = 'available' THEN r.remaining_length_mm ELSE 0 END), 0) AS total_available_mm
      FROM products p
      LEFT JOIN rolls r ON r.product_id = p.id AND r.godown_id = ?
      GROUP BY p.id
      ORDER BY p.product_name ASC
    `).all(godownId);

    return {
      success: true,
      data: rows.map(r => ({
        ...r,
        is_active: r.is_active === 1,
        available_rolls: r.available_rolls || 0,
        total_available_meters: mmToMeters(r.total_available_mm || 0),
      })),
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

/** Individual roll inventory with filters */
ipcMain.handle('stock:rollInventory', async (_event, filters) => {
  try {
    const f = {};

    if (filters?.godownId) f.godownId = filters.godownId;
    if (filters?.productId) f.productId = filters.productId;
    if (filters?.status && filters.status !== 'all') f.status = filters.status;
    if (filters?.rollCode) f.rollCode = filters.rollCode;
    if (filters?.exactLengthMeters != null) f.exactLengthMm = metersToMm(filters.exactLengthMeters);
    if (filters?.minLengthMeters != null) f.minLengthMm = metersToMm(filters.minLengthMeters);
    if (filters?.maxLengthMeters != null) f.maxLengthMm = metersToMm(filters.maxLengthMeters);

    const data = listAllRolls(f);
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

/** Update purchase rate for a batch of rolls */
ipcMain.handle('stock:updateBatchRate', async (_event, args) => {
  try {
    const db = getDb();
    const { rollIds, ratePerMeter } = args || {};
    const rate = Number(ratePerMeter) || 0;
    if (!Array.isArray(rollIds) || rollIds.length === 0) {
      throw new Error('No rolls specified.');
    }
    const updateStmt = db.prepare('UPDATE rolls SET purchase_rate = ? WHERE id = ?');
    const updateTx = db.transaction(() => {
      for (const id of rollIds) {
        updateStmt.run(rate, id);
      }
    });
    updateTx();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

