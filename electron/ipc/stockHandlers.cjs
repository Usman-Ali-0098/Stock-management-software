'use strict';

const { ipcMain } = require('electron');
const { getDb } = require('../database/init.cjs');
const { mmToMeters, metersToMm } = require('../repositories/productRepo.cjs');

/** Dashboard summary — supports 'all' (overall warehouse) or a specific godown */
ipcMain.handle('stock:dashboard', async (_event, args) => {
  try {
    const db = getDb();
    const rawId = typeof args === 'object' ? args?.godownId : args;
    const isOverall = rawId === 'all' || rawId === 0 || rawId === null || rawId === undefined;
    const godownId = isOverall ? 'all' : Number(rawId);
    const today = new Date().toISOString().slice(0, 10);

    // Every active godown, with its own variant + bulk-lot totals
    const godownsBreakdown = db.prepare(`
      SELECT
        g.id, g.name, g.address,
        COALESCE(SUM(v.quantity), 0) as available_rolls,
        COALESCE(SUM(v.quantity * v.length_mm), 0) as total_available_mm,
        COALESCE((SELECT SUM(b.quantity) FROM bulk_lots b WHERE b.godown_id = g.id), 0) as bulk_rolls,
        COALESCE((SELECT SUM(b.total_length_mm) FROM bulk_lots b WHERE b.godown_id = g.id), 0) as bulk_mm,
        COUNT(DISTINCT CASE WHEN v.quantity > 0 THEN v.product_id END) as product_count
      FROM godowns g
      LEFT JOIN variants v ON v.godown_id = g.id
      WHERE g.is_active = 1
      GROUP BY g.id
      ORDER BY g.id ASC
    `).all().map(g => ({
      ...g,
      available_rolls: (g.available_rolls || 0) + (g.bulk_rolls || 0),
      total_available_meters: mmToMeters((g.total_available_mm || 0) + (g.bulk_mm || 0)),
    }));

    let godownName = 'Overall Warehouse (All Godowns)';
    if (!isOverall) {
      const g = db.prepare('SELECT name, address FROM godowns WHERE id = ?').get(godownId);
      if (g) godownName = g.name;
    }

    let totals, bulkTotals;
    if (isOverall) {
      totals = db.prepare(`
        SELECT COALESCE(SUM(quantity), 0) as total_available_rolls,
               COALESCE(SUM(quantity * length_mm), 0) as total_available_mm
        FROM variants
      `).get();
      bulkTotals = db.prepare(`
        SELECT COALESCE(SUM(quantity), 0) as total_available_rolls,
               COALESCE(SUM(total_length_mm), 0) as total_available_mm
        FROM bulk_lots
      `).get();
    } else {
      totals = db.prepare(`
        SELECT COALESCE(SUM(quantity), 0) as total_available_rolls,
               COALESCE(SUM(quantity * length_mm), 0) as total_available_mm
        FROM variants WHERE godown_id = ?
      `).get(godownId);
      bulkTotals = db.prepare(`
        SELECT COALESCE(SUM(quantity), 0) as total_available_rolls,
               COALESCE(SUM(total_length_mm), 0) as total_available_mm
        FROM bulk_lots WHERE godown_id = ?
      `).get(godownId);
    }

    let byProduct;
    if (isOverall) {
      byProduct = db.prepare(`
        SELECT
          p.id, p.product_code, p.product_name,
          COALESCE(SUM(v.quantity), 0) as available_rolls,
          COALESCE(SUM(v.quantity * v.length_mm), 0) as total_available_mm
        FROM products p
        LEFT JOIN variants v ON v.product_id = p.id
        WHERE p.is_active = 1
        GROUP BY p.id
        ORDER BY p.product_name ASC
      `).all();
    } else {
      byProduct = db.prepare(`
        SELECT
          p.id, p.product_code, p.product_name,
          COALESCE(SUM(v.quantity), 0) as available_rolls,
          COALESCE(SUM(v.quantity * v.length_mm), 0) as total_available_mm
        FROM products p
        LEFT JOIN variants v ON v.product_id = p.id AND v.godown_id = ?
        WHERE p.is_active = 1
        GROUP BY p.id
        ORDER BY p.product_name ASC
      `).all(godownId);
    }

    let todayInward, todayOutward;
    if (isOverall) {
      todayInward = db.prepare(`SELECT COUNT(*) as cnt FROM inward_transactions WHERE transaction_date LIKE ?`).get(`${today}%`);
      todayOutward = db.prepare(`SELECT COUNT(*) as cnt FROM outward_transactions WHERE transaction_date LIKE ?`).get(`${today}%`);
    } else {
      todayInward = db.prepare(`SELECT COUNT(*) as cnt FROM inward_transactions WHERE godown_id = ? AND transaction_date LIKE ?`).get(godownId, `${today}%`);
      todayOutward = db.prepare(`SELECT COUNT(*) as cnt FROM outward_transactions WHERE godown_id = ? AND transaction_date LIKE ?`).get(godownId, `${today}%`);
    }

    return {
      success: true,
      data: {
        godownId,
        godownName,
        isOverall,
        totalAvailableRolls: (totals.total_available_rolls || 0) + (bulkTotals.total_available_rolls || 0),
        totalAvailableMeters: mmToMeters((totals.total_available_mm || 0) + (bulkTotals.total_available_mm || 0)),
        godownsBreakdown,
        byProduct: byProduct.map(p => ({
          ...p,
          available_rolls: p.available_rolls || 0,
          total_available_meters: mmToMeters(p.total_available_mm || 0),
        })),
        todayInwardCount: todayInward.cnt || 0,
        todayOutwardCount: todayOutward.cnt || 0,
      },
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

/** Stock variants at or below a quantity threshold (default 5) — used for the low-stock warning. */
ipcMain.handle('stock:lowStock', async (_event, args) => {
  try {
    const db = getDb();
    const threshold = Number(args?.threshold) > 0 ? Number(args.threshold) : 5;
    const bulkThresholdMeters = Number(args?.bulkThresholdMeters) > 0 ? Number(args.bulkThresholdMeters) : 100;
    const bulkThresholdMm = metersToMm(bulkThresholdMeters);

    const rows = db.prepare(`
      SELECT v.*, p.product_code, p.product_name, g.name AS godown_name
      FROM variants v
      JOIN products p ON p.id = v.product_id
      LEFT JOIN godowns g ON g.id = v.godown_id
      WHERE v.quantity <= ? AND p.is_active = 1
      ORDER BY v.quantity ASC, v.updated_at DESC
    `).all(threshold);

    // Bulk lots are tracked by total meters, so their own low-stock warning
    // triggers on remaining meters (e.g. <= 100m) rather than roll count.
    const bulkRows = db.prepare(`
      SELECT b.*, p.product_code, p.product_name, g.name AS godown_name
      FROM bulk_lots b
      JOIN products p ON p.id = b.product_id
      LEFT JOIN godowns g ON g.id = b.godown_id
      WHERE b.total_length_mm <= ? AND p.is_active = 1
      ORDER BY b.total_length_mm ASC, b.updated_at DESC
    `).all(bulkThresholdMm);

    const data = [
      ...rows.map(r => ({ ...r, length_meters: mmToMeters(r.length_mm), is_bulk: false })),
      ...bulkRows.map(r => ({ ...r, total_length_meters: mmToMeters(r.total_length_mm), is_bulk: true })),
    ];

    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
