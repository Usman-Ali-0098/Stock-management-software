// @ts-ignore
const fs = require('fs');
// @ts-ignore
const path = require('path');

// @ts-ignore
const { initDatabase, closeDatabase, getDb } = require('../electron/database/init.cjs');
// @ts-ignore
const { createGodown, getGodownById, listGodowns } = require('../electron/repositories/godownRepo.cjs');
// @ts-ignore
const { createProduct, getProductById, listProducts } = require('../electron/repositories/productRepo.cjs');
// @ts-ignore
const { listVariantsByProduct, listAllVariants, getVariantById, updateVariantRate } = require('../electron/repositories/variantRepo.cjs');
// @ts-ignore
const { listBulkLotsByProduct, updateBulkLotRate } = require('../electron/repositories/bulkLotRepo.cjs');
// @ts-ignore
const { createInwardTransaction, createBulkInwardTransaction, getInwardTransactionById, listInwardTransactions } = require('../electron/services/inwardService.cjs');
// @ts-ignore
const { createOutwardTransaction, getOutwardTransactionById } = require('../electron/services/outwardService.cjs');
// @ts-ignore
const { generateInwardSlipHtml, generateOutwardSlipHtml } = require('../electron/ipc/printHandlers.cjs');
// @ts-ignore
const { performFactoryReset } = require('../electron/ipc/settingsHandlers.cjs');

const TEST_DB_PATH = path.join(process.cwd(), 'tests', 'test_warehouse.db');

describe('Leather Warehouse WMS — Acceptance & Core Business Logic Tests', () => {
  beforeEach(() => {
    // Clean up test db file if exists
    if (fs.existsSync(TEST_DB_PATH)) {
      try {
        closeDatabase();
        fs.unlinkSync(TEST_DB_PATH);
      } catch (e) {
        // ignore
      }
    }
    initDatabase(TEST_DB_PATH);
  });

  afterAll(() => {
    closeDatabase();
    if (fs.existsSync(TEST_DB_PATH)) {
      try {
        fs.unlinkSync(TEST_DB_PATH);
      } catch (e) {}
    }
  });

  // ─── Test A: Create multiple godowns ─────────────────────────────────────────
  test('Test A: Create multiple godowns and verify independent stock views', () => {
    const g1 = createGodown({ name: 'Godown 1 — Main Warehouse Custom', address: 'Shah Alam Market' });
    const g2 = createGodown({ name: 'Godown 2 — Secondary Store', address: 'Circular Road' });

    expect(g1.id).toBeDefined();
    expect(g2.id).toBeDefined();
    expect(g1.id).not.toBe(g2.id);

    // Initial stock for both godowns must be completely independent and 0
    expect(g1.available_rolls).toBe(0);
    expect(g1.total_available_meters).toBe(0);
    expect(g2.available_rolls).toBe(0);
    expect(g2.total_available_meters).toBe(0);

    const godownsList = listGodowns(false);
    expect(godownsList.some((g: any) => g.id === g1.id)).toBe(true);
    expect(godownsList.some((g: any) => g.id === g2.id)).toBe(true);
  });

  // ─── Test B: Same product in different godowns ──────────────────────────────
  test('Test B: Same product in different godowns (40 rolls in G1, 10 rolls in G2)', () => {
    const g1 = createGodown({ name: 'Godown 1', address: 'Lahore Gate 1' });
    const g2 = createGodown({ name: 'Godown 2', address: 'Lahore Gate 2' });

    const prodA = createProduct({ product_code: 'A', product_name: 'Product A Premium' });

    createInwardTransaction({
      godownId: g1.id,
      productId: prodA.id,
      batches: [{ lengthMeters: 50, quantity: 40, ratePerMeter: 0 }],
      referenceNote: 'Batch for Godown 1',
    });

    createInwardTransaction({
      godownId: g2.id,
      productId: prodA.id,
      batches: [{ lengthMeters: 30, quantity: 10, ratePerMeter: 0 }],
      referenceNote: 'Batch for Godown 2',
    });

    // Verify Godown 1 stock
    const prodInG1 = getProductById(prodA.id, g1.id);
    expect(prodInG1.available_rolls).toBe(40);
    expect(prodInG1.total_available_meters).toBe(40 * 50); // 2000m

    // Verify Godown 2 stock
    const prodInG2 = getProductById(prodA.id, g2.id);
    expect(prodInG2.available_rolls).toBe(10);
    expect(prodInG2.total_available_meters).toBe(10 * 30); // 300m

    // Ensure variants strictly isolate godown stock
    const variantsG1 = listVariantsByProduct(prodA.id, { godownId: g1.id });
    const variantsG2 = listVariantsByProduct(prodA.id, { godownId: g2.id });
    expect(variantsG1).toHaveLength(1);
    expect(variantsG2).toHaveLength(1);
    expect(variantsG1[0].quantity).toBe(40);
    expect(variantsG2[0].quantity).toBe(10);

    // Verify neither godown's variant ids overlap with the other's
    expect(variantsG1[0].id).not.toBe(variantsG2[0].id);
  });

  // ─── Test C: Different roll lengths create separate variants ───────────────
  test('Test C: Receive five different roll sizes into Godown 1 -> 5 variants, 415m total', () => {
    const g1 = createGodown({ name: 'Godown 1 Central', address: 'Shah Alam' });
    const prodA = createProduct({ product_code: 'A_C', product_name: 'Product A Core' });

    const inwardTx = createInwardTransaction({
      godownId: g1.id,
      productId: prodA.id,
      batches: [40, 50, 100, 150, 75].map(l => ({ lengthMeters: l, quantity: 1, ratePerMeter: 0 })),
      referenceNote: 'Test C shipment',
    });

    expect(inwardTx.lines).toHaveLength(5);
    expect(inwardTx.slip_number).toMatch(/^IN-\d{8}-\d{3}/);

    const lengths = inwardTx.lines.map((l: any) => l.length_meters).sort((a: number, b: number) => a - b);
    expect(lengths).toEqual([40, 50, 75, 100, 150]);

    // Check product summary calculation in Godown 1
    const summary = getProductById(prodA.id, g1.id);
    expect(summary.available_rolls).toBe(5);
    expect(summary.total_available_meters).toBe(415); // 40 + 50 + 100 + 150 + 75 = 415

    const variants = listVariantsByProduct(prodA.id, { godownId: g1.id });
    expect(variants).toHaveLength(5);
  });

  // ─── Test D: Issue a specific variant ────────────────────────────────────────
  test('Test D: Issue the 50-meter roll -> Available: 4 rolls, 365m; variant quantity decremented', () => {
    const g1 = createGodown({ name: 'Godown 1 Issue Test', address: 'Shah Alam' });
    const prodA = createProduct({ product_code: 'A_D', product_name: 'Product A Issue' });

    createInwardTransaction({
      godownId: g1.id,
      productId: prodA.id,
      batches: [40, 50, 100, 150, 75].map(l => ({ lengthMeters: l, quantity: 1, ratePerMeter: 0 })),
    });

    const variants = listVariantsByProduct(prodA.id, { godownId: g1.id });
    const variant50 = variants.find((v: any) => v.length_meters === 50);
    expect(variant50).toBeDefined();

    // Issue the specific 50-meter roll
    const outwardTx = createOutwardTransaction({
      godownId: g1.id,
      items: [{ variantId: variant50.id, quantity: 1 }],
      recipientReference: 'Customer Shah Alam',
      notes: 'Urgent 50m order',
    });

    expect(outwardTx.slip_number).toMatch(/^OUT-\d{8}-\d{3}/);
    expect(outwardTx.lines[0].variant_id).toBe(variant50.id);

    // Verify stock in Godown 1
    const summary = getProductById(prodA.id, g1.id);
    expect(summary.available_rolls).toBe(4);
    expect(summary.total_available_meters).toBe(365); // 415 - 50 = 365

    // Verify variant quantity decremented to 0 (and so no longer listed by default)
    const dbVariant = getVariantById(variant50.id);
    expect(dbVariant.quantity).toBe(0);

    // Verify other 4 variants remain available
    const available = listVariantsByProduct(prodA.id, { godownId: g1.id });
    expect(available).toHaveLength(4);
    expect(available.some((v: any) => v.id === variant50.id)).toBe(false);
  });

  // ─── Test E: Stock movement history ─────────────────────────────────────────
  test('Test E: Variant movement history records both the inward and outward event', () => {
    const g1 = createGodown({ name: 'Godown 1 History Test', address: 'Shah Alam' });
    const prod = createProduct({ product_code: 'A_E', product_name: 'Product A Hist' });

    const inTx = createInwardTransaction({
      godownId: g1.id,
      productId: prod.id,
      batches: [{ lengthMeters: 50, quantity: 1, ratePerMeter: 0 }],
      referenceNote: 'Supplier Delivery Note 99',
    });
    const variantId = inTx.lines[0].variant_id;

    const outTx = createOutwardTransaction({
      godownId: g1.id,
      items: [{ variantId, quantity: 1 }],
      recipientReference: 'Buyer Lahore 1',
      notes: 'Full roll issued',
    });

    const db = getDb();
    const movements = db.prepare(
      `SELECT * FROM stock_movements WHERE variant_id = ? ORDER BY id ASC`
    ).all(variantId);

    expect(movements).toHaveLength(2);

    // Event 1: Received
    expect(movements[0].movement_type).toBe('inward');
    expect(movements[0].slip_number).toBe(inTx.slip_number);
    expect(movements[0].quantity).toBe(1);

    // Event 2: Issued
    expect(movements[1].movement_type).toBe('outward');
    expect(movements[1].slip_number).toBe(outTx.slip_number);
    expect(movements[1].reference).toBe('Buyer Lahore 1');
    expect(movements[1].quantity).toBe(1);

    // Variant is now empty
    expect(getVariantById(variantId).quantity).toBe(0);
  });

  // ─── Test F: Prevent cross-godown issuance ──────────────────────────────────
  test('Test F: Attempt to issue a variant belonging to Godown 1 while operating in Godown 2 must be rejected', () => {
    const g1 = createGodown({ name: 'Godown 1 Isolated', address: 'Lahore Gate 1' });
    const g2 = createGodown({ name: 'Godown 2 Isolated', address: 'Lahore Gate 2' });

    const prod = createProduct({ product_code: 'A_F', product_name: 'Product A Cross' });

    const inTx = createInwardTransaction({
      godownId: g1.id,
      productId: prod.id,
      batches: [{ lengthMeters: 70, quantity: 1, ratePerMeter: 0 }],
    });
    const variantInG1 = inTx.lines[0].variant_id;

    // Attempt to issue variantInG1 while specifying Godown 2
    expect(() => {
      createOutwardTransaction({
        godownId: g2.id, // User is operating in Godown 2!
        items: [{ variantId: variantInG1, quantity: 1 }],
        recipientReference: 'Unauthorized Cross Issue',
      });
    }).toThrow(/cannot be issued from/);

    // Verify stock in Godown 1 was NOT modified
    const variantCheck = getVariantById(variantInG1);
    expect(variantCheck.quantity).toBe(1);

    const summaryG1 = getProductById(prod.id, g1.id);
    expect(summaryG1.available_rolls).toBe(1);
    expect(summaryG1.total_available_meters).toBe(70);

    const summaryG2 = getProductById(prod.id, g2.id);
    expect(summaryG2.available_rolls).toBe(0);
    expect(summaryG2.total_available_meters).toBe(0);
  });

  // ─── Test G: Switch godowns ─────────────────────────────────────────────────
  test('Test G: Switching godowns returns separate, non-overlapping stock and totals', () => {
    const g1 = createGodown({ name: 'Godown 1 Switch', address: 'Addr 1' });
    const g2 = createGodown({ name: 'Godown 2 Switch', address: 'Addr 2' });
    const prod = createProduct({ product_code: 'A_G', product_name: 'Product A Switch' });

    // Inward to G1: 2 rolls (40m, 60m)
    createInwardTransaction({
      godownId: g1.id,
      productId: prod.id,
      batches: [40, 60].map(l => ({ lengthMeters: l, quantity: 1, ratePerMeter: 0 })),
    });

    // Inward to G2: 1 roll (90m)
    createInwardTransaction({
      godownId: g2.id,
      productId: prod.id,
      batches: [{ lengthMeters: 90, quantity: 1, ratePerMeter: 0 }],
    });

    // State when viewing Godown 1
    const g1Stock = getProductById(prod.id, g1.id);
    const g1Variants = listVariantsByProduct(prod.id, { godownId: g1.id });
    expect(g1Stock.available_rolls).toBe(2);
    expect(g1Stock.total_available_meters).toBe(100);
    expect(g1Variants).toHaveLength(2);

    // State when viewing Godown 2 (simulating switch)
    const g2Stock = getProductById(prod.id, g2.id);
    const g2Variants = listVariantsByProduct(prod.id, { godownId: g2.id });
    expect(g2Stock.available_rolls).toBe(1);
    expect(g2Stock.total_available_meters).toBe(90);
    expect(g2Variants).toHaveLength(1);
  });

  // ─── Test H: Over-dispatch rejected ─────────────────────────────────────────
  test('Test H: Attempting to dispatch more than available quantity fails without modifying stock', () => {
    const g = createGodown({ name: 'Godown Double Issue', address: 'Market' });
    const prod = createProduct({ product_code: 'A_H', product_name: 'Product A Double' });

    const inTx = createInwardTransaction({
      godownId: g.id,
      productId: prod.id,
      batches: [{ lengthMeters: 45, quantity: 1, ratePerMeter: 0 }],
    });
    const variantId = inTx.lines[0].variant_id;

    // First issue succeeds
    const out1 = createOutwardTransaction({ godownId: g.id, items: [{ variantId, quantity: 1 }] });
    expect(out1.id).toBeDefined();

    // Second issue (nothing left) must fail
    expect(() => {
      createOutwardTransaction({ godownId: g.id, items: [{ variantId, quantity: 1 }] });
    }).toThrow(/Only 0 in stock/);

    // Stock must reflect single issuance
    const summary = getProductById(prod.id, g.id);
    expect(summary.available_rolls).toBe(0);
    expect(summary.total_available_meters).toBe(0);
  });

  // ─── Test I: Persistence across database reconnects ─────────────────────────
  test('Test I: Close and reopen database; verify godowns, products, and variant stock persist', () => {
    const g = createGodown({ name: 'Godown Persistent', address: 'Lahore Shah Alam' });
    const prod = createProduct({ product_code: 'PERSIST', product_name: 'Persistent Leather' });

    createInwardTransaction({
      godownId: g.id,
      productId: prod.id,
      batches: [120, 80].map(l => ({ lengthMeters: l, quantity: 1, ratePerMeter: 0 })),
    });

    // Close and reopen
    closeDatabase();
    initDatabase(TEST_DB_PATH);

    const reloadedGodown = getGodownById(g.id);
    expect(reloadedGodown).toBeDefined();
    expect(reloadedGodown.name).toBe('Godown Persistent');

    const reloadedProduct = getProductById(prod.id, g.id);
    expect(reloadedProduct).toBeDefined();
    expect(reloadedProduct.available_rolls).toBe(2);
    expect(reloadedProduct.total_available_meters).toBe(200);
  });

  // ─── Test J: Printing slips HTML Rendering ──────────────────────────────────
  test('Test J: Inward and outward slips display correct godown name, slip number, product, and lengths', () => {
    const shopSettings = {
      shop_name: 'Raxine Leather Warehouse',
      shop_address: 'Shah Alam Market, Lahore, Pakistan',
      shop_contact: '+92 300 1234567',
    };

    const inwardTx = {
      godown_name: 'Godown 1 — Main Warehouse',
      godown_address: 'Shah Alam Market, Lahore',
      slip_number: 'IN-20261014-001',
      transaction_date: '2026-10-14 11:30:00',
      reference_note: 'Tannery Batch A-5',
      lines: [
        {
          product_name: 'Product A',
          product_code: 'A',
          length_meters: 50,
          quantity: 1,
          rate_per_meter: 0,
        },
      ],
    };

    const inwardHtml = generateInwardSlipHtml(inwardTx, shopSettings);
    expect(inwardHtml).toContain('Godown 1 — Main Warehouse');
    expect(inwardHtml).toContain('IN-20261014-001');
    expect(inwardHtml).toContain('Product A');
    expect(inwardHtml).toContain('50.00 m');
    expect(inwardHtml).toContain('Prepared By');
    expect(inwardHtml).toContain('Received By');

    const outwardTx = {
      godown_name: 'Godown 1 — Main Warehouse',
      godown_address: 'Shah Alam Market, Lahore',
      slip_number: 'OUT-20261014-001',
      transaction_date: '2026-10-14 14:00:00',
      recipient_reference: 'Shah Alam Buyer Co',
      notes: 'Delivered',
      lines: [
        {
          product_name: 'Product A',
          product_code: 'A',
          length_meters: 50,
          quantity: 1,
          rate_per_meter: 0,
        },
      ],
    };

    const outwardHtml = generateOutwardSlipHtml(outwardTx, shopSettings);
    expect(outwardHtml).toContain('Godown 1 — Main Warehouse');
    expect(outwardHtml).toContain('OUT-20261014-001');
    expect(outwardHtml).toContain('Shah Alam Buyer Co');
    expect(outwardHtml).toContain('Product A');
    expect(outwardHtml).toContain('50.00 m');
  });

  // ─── Test K: Backup & Restore ───────────────────────────────────────────────
  test('Test K: Backup database, restore into test instance, and verify godowns and movement history remain intact', () => {
    const g = createGodown({ name: 'Godown Backup K', address: 'Market' });
    const prod = createProduct({ product_code: 'PROD_K', product_name: 'Product K' });

    const inTx = createInwardTransaction({
      godownId: g.id,
      productId: prod.id,
      batches: [55, 65].map(l => ({ lengthMeters: l, quantity: 1, ratePerMeter: 0 })),
    });
    const issuedVariantId = inTx.lines[0].variant_id;

    createOutwardTransaction({
      godownId: g.id,
      items: [{ variantId: issuedVariantId, quantity: 1 }],
      recipientReference: 'Client K',
    });

    const backupFile = path.join(process.cwd(), 'tests', 'test_backup_k.db');
    if (fs.existsSync(backupFile)) fs.unlinkSync(backupFile);

    const db = getDb();
    db.exec(`VACUUM INTO '${backupFile.replace(/'/g, "''")}'`);

    expect(fs.existsSync(backupFile)).toBe(true);

    // Open backup database separately and verify content
    // @ts-ignore
    const Database = require('better-sqlite3');
    const backupDb = new Database(backupFile, { readonly: true });

    // Verify godown exists in backup
    const backupGodown = backupDb.prepare('SELECT * FROM godowns WHERE id = ?').get(g.id);
    expect(backupGodown).toBeDefined();
    expect(backupGodown.name).toBe('Godown Backup K');

    // Verify movement history in backup
    const historyEntries = backupDb.prepare('SELECT * FROM stock_movements WHERE variant_id = ?').all(issuedVariantId);
    expect(historyEntries).toHaveLength(2); // inward + outward

    backupDb.close();
    fs.unlinkSync(backupFile);
  });

  // ─── Test L: Upgrade legacy database without godown_id ───────────────────────
  test('Test L: Seamlessly upgrade legacy database schema all the way to the variant-based model', () => {
    closeDatabase();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);

    // @ts-ignore
    const Database = require('better-sqlite3');
    const legacyDb = new Database(TEST_DB_PATH);
    legacyDb.pragma('foreign_keys = ON');

    // Simulate an older DB version that only had migration 1 and 2 without godown_id on transactions
    legacyDb.exec(`
      CREATE TABLE schema_migrations (
        version INTEGER PRIMARY KEY,
        description TEXT NOT NULL,
        applied_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_code TEXT NOT NULL UNIQUE,
        product_name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE inward_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slip_number TEXT NOT NULL UNIQUE,
        transaction_date TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        reference_note TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE rolls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        roll_code TEXT NOT NULL UNIQUE,
        product_id INTEGER NOT NULL REFERENCES products(id),
        original_length_mm INTEGER NOT NULL,
        remaining_length_mm INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'available',
        inward_transaction_id INTEGER NOT NULL REFERENCES inward_transactions(id),
        received_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        notes TEXT NOT NULL DEFAULT ''
      );

      CREATE TABLE outward_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slip_number TEXT NOT NULL UNIQUE,
        transaction_date TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        recipient_reference TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
      );

      INSERT INTO schema_migrations (version, description) VALUES (1, 'Initial');
      INSERT INTO schema_migrations (version, description) VALUES (2, 'Settings');
    `);
    legacyDb.close();

    // Now initDatabase must run every remaining migration (3 through 7) without any errors
    expect(() => {
      initDatabase(TEST_DB_PATH);
    }).not.toThrow();

    const db = getDb();
    const cols = db.prepare("PRAGMA table_info(inward_transactions)").all();
    expect(cols.some((c: any) => c.name === 'godown_id')).toBe(true);

    // Migration 7 must have created the variant-based tables too
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((t: any) => t.name);
    expect(tables).toEqual(expect.arrayContaining(['variants', 'stock_movements', 'inward_lines', 'outward_lines']));

    // New stock additions must work end-to-end on the upgraded database
    const g = createGodown({ name: 'Post-Upgrade Godown', address: 'Lahore' });
    const p = createProduct({ product_code: 'UPGRADED', product_name: 'Upgraded Product' });
    createInwardTransaction({ godownId: g.id, productId: p.id, batches: [{ lengthMeters: 40, quantity: 3, ratePerMeter: 0 }] });
    expect(getProductById(p.id, g.id).available_rolls).toBe(3);
  });

  // ─── Test M: Factory Reset wipes all variant stock, transactions, & products ──
  test('Test M: Factory Reset wipes all variant stock, transactions, and products while preserving clean schema', () => {
    const g1 = createGodown({ name: 'Godown Test Reset', address: 'Lahore' });
    const prod = createProduct({ product_code: 'TEST-RESET', product_name: 'Test Product For Reset' });

    createInwardTransaction({
      godownId: g1.id,
      productId: prod.id,
      batches: [50, 60, 70].map(l => ({ lengthMeters: l, quantity: 1, ratePerMeter: 0 })),
      referenceNote: 'Dummy test inward',
    });

    const variantsBefore = listVariantsByProduct(prod.id, { godownId: g1.id });
    expect(variantsBefore.length).toBe(3);

    // Perform factory reset with clearProducts: true
    const result = performFactoryReset({ clearProducts: true });
    expect(result.success).toBe(true);

    const db = getDb();
    const variantCount = db.prepare('SELECT count(*) as count FROM variants').get().count;
    const movementCount = db.prepare('SELECT count(*) as count FROM stock_movements').get().count;
    const inwardCount = db.prepare('SELECT count(*) as count FROM inward_transactions').get().count;
    const outwardCount = db.prepare('SELECT count(*) as count FROM outward_transactions').get().count;
    const prodCount = db.prepare('SELECT count(*) as count FROM products').get().count;

    expect(variantCount).toBe(0);
    expect(movementCount).toBe(0);
    expect(inwardCount).toBe(0);
    expect(outwardCount).toBe(0);
    expect(prodCount).toBe(0);

    // Verify safety backup file was created
    if (result.data && result.data.safetyBackupPath) {
      expect(fs.existsSync(result.data.safetyBackupPath)).toBe(true);
      try {
        fs.unlinkSync(result.data.safetyBackupPath);
      } catch {}
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// NEW: Variant Batching, Merging, Rate Management & Data Integrity Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('Incoming Stock — Variant Batching, Merging & Rate Management Tests', () => {
  const TEST_DB2 = path.join(process.cwd(), 'tests', 'test_inward2.db');

  beforeEach(() => {
    if (fs.existsSync(TEST_DB2)) { try { closeDatabase(); fs.unlinkSync(TEST_DB2); } catch {} }
    initDatabase(TEST_DB2);
  });

  afterAll(() => {
    closeDatabase();
    if (fs.existsSync(TEST_DB2)) { try { fs.unlinkSync(TEST_DB2); } catch {} }
  });

  // Test 1: Godown required for inward transaction
  test('Test 1: createInwardTransaction throws without godownId', () => {
    const prod = createProduct({ product_code: 'T1P', product_name: 'Test1 Product' });
    expect(() => createInwardTransaction({
      godownId: null, productId: prod.id, batches: [{ lengthMeters: 30, quantity: 1, ratePerMeter: 0 }],
    })).toThrow(/godown/i);
  });

  // Test 2: Transaction records correct godown ID
  test('Test 2: New inward transaction records correct godown_id on tx and variant', () => {
    const g = createGodown({ name: 'Test Godown T2', address: 'Test Street' });
    const p = createProduct({ product_code: 'T2P', product_name: 'Test2 Product' });
    const tx = createInwardTransaction({ godownId: g.id, productId: p.id, batches: [{ lengthMeters: 50, quantity: 1, ratePerMeter: 0 }] });
    expect(tx.godown_id).toBe(g.id);
    const db = getDb();
    const dbVariant = db.prepare('SELECT godown_id FROM variants WHERE id = ?').get(tx.lines[0].variant_id);
    expect(dbVariant.godown_id).toBe(g.id);
  });

  // Test 3: Stock in Godown A does not affect Godown B
  test('Test 3: Stock in Godown A does not change Godown B', () => {
    const gA = createGodown({ name: 'Godown A-T3', address: 'A' });
    const gB = createGodown({ name: 'Godown B-T3', address: 'B' });
    const p  = createProduct({ product_code: 'T3P', product_name: 'Test3 Product' });
    createInwardTransaction({
      godownId: gA.id, productId: p.id,
      batches: [100, 200].map(l => ({ lengthMeters: l, quantity: 1, ratePerMeter: 0 })),
    });
    expect(getProductById(p.id, gA.id).available_rolls).toBe(2);
    expect(getProductById(p.id, gB.id).available_rolls).toBe(0);
  });

  // Test 4: Identical batches (same length + rate) merge into ONE variant with a summed quantity
  test('Test 4: Adding the same roll size & rate twice merges into one variant, not duplicate rows', () => {
    const g = createGodown({ name: 'Merge Godown T4', address: 'T4' });
    const p = createProduct({ product_code: 'T4P', product_name: 'T4 Product' });

    createInwardTransaction({ godownId: g.id, productId: p.id, batches: [{ lengthMeters: 30, quantity: 10, ratePerMeter: 400 }] });
    createInwardTransaction({ godownId: g.id, productId: p.id, batches: [{ lengthMeters: 30, quantity: 5, ratePerMeter: 400 }] });

    const variants = listVariantsByProduct(p.id, { godownId: g.id });
    expect(variants).toHaveLength(1);
    expect(variants[0].quantity).toBe(15);

    const stock = getProductById(p.id, g.id);
    expect(stock.available_rolls).toBe(15);
    expect(stock.total_available_meters).toBe(450);
  });

  // Test 5: Same length, different rate -> stays as two separate variants
  test('Test 5: Same roll size bought at a different rate creates a separate variant', () => {
    const g = createGodown({ name: 'Rate Split T5', address: 'T5' });
    const p = createProduct({ product_code: 'T5P', product_name: 'T5 Product' });

    createInwardTransaction({ godownId: g.id, productId: p.id, batches: [{ lengthMeters: 30, quantity: 10, ratePerMeter: 400 }] });
    createInwardTransaction({ godownId: g.id, productId: p.id, batches: [{ lengthMeters: 30, quantity: 5, ratePerMeter: 450 }] });

    const variants = listVariantsByProduct(p.id, { godownId: g.id });
    expect(variants).toHaveLength(2);
    expect(variants.reduce((s: number, v: any) => s + v.quantity, 0)).toBe(15);

    const stock = getProductById(p.id, g.id);
    expect(stock.available_rolls).toBe(15);
    expect(stock.total_available_meters).toBe(450);
  });

  // Test 6: Multiple lengths with quantities calculate correctly in one transaction
  test('Test 6: 4×29m + 10×30m + 6×31m + 5×32m = 25 rolls, 762m across 4 variants', () => {
    const g = createGodown({ name: 'Multi Len T6', address: 'T6' });
    const p = createProduct({ product_code: 'T6P', product_name: 'T6 Product' });
    const tx = createInwardTransaction({
      godownId: g.id, productId: p.id,
      batches: [
        { lengthMeters: 29, quantity: 4, ratePerMeter: 0 },
        { lengthMeters: 30, quantity: 10, ratePerMeter: 0 },
        { lengthMeters: 31, quantity: 6, ratePerMeter: 0 },
        { lengthMeters: 32, quantity: 5, ratePerMeter: 0 },
      ],
    });
    expect(tx.lines).toHaveLength(4);
    const stock = getProductById(p.id, g.id);
    expect(stock.available_rolls).toBe(25);
    expect(stock.total_available_meters).toBe(762);
  });

  // Test 7: Decimal lengths preserved
  test('Test 7: Decimal lengths (29.5, 30.0, 31.25) stored correctly in mm', () => {
    const g = createGodown({ name: 'Decimal T7', address: 'T7' });
    const p = createProduct({ product_code: 'T7P', product_name: 'T7 Product' });
    const tx = createInwardTransaction({
      godownId: g.id, productId: p.id,
      batches: [29.5, 30.0, 31.25].map(l => ({ lengthMeters: l, quantity: 1, ratePerMeter: 0 })),
    });
    const sortedLines = [...tx.lines].sort((a: any, b: any) => a.length_meters - b.length_meters);
    expect(sortedLines[0].length_meters).toBe(29.5);
    expect(sortedLines[2].length_meters).toBe(31.25);
    const db = getDb();
    const v = db.prepare('SELECT length_mm FROM variants WHERE id = ?').get(sortedLines[2].variant_id);
    expect(v.length_mm).toBe(31250);
  });

  // Test 8: Updating a variant's rate merges it into a matching variant without losing quantity or breaking history
  test('Test 8: Changing a variant rate to match an existing one merges quantities and preserves movement history (FK-safe)', () => {
    const g = createGodown({ name: 'Rate Merge T8', address: 'T8' });
    const p = createProduct({ product_code: 'T8P', product_name: 'T8 Product' });

    createInwardTransaction({ godownId: g.id, productId: p.id, batches: [{ lengthMeters: 30, quantity: 3, ratePerMeter: 300 }] });
    createInwardTransaction({ godownId: g.id, productId: p.id, batches: [{ lengthMeters: 30, quantity: 2, ratePerMeter: 350 }] });

    let variants = listVariantsByProduct(p.id, { godownId: g.id });
    expect(variants).toHaveLength(2);
    const variant350 = variants.find((v: any) => v.rate_per_meter === 350);

    // Re-rate the 350 variant down to 300 — it should merge into the existing 300 variant
    const merged = updateVariantRate(variant350.id, 300);
    expect(merged.rate_per_meter).toBe(300);
    expect(merged.quantity).toBe(5); // 3 (existing) + 2 (merged in)

    variants = listVariantsByProduct(p.id, { godownId: g.id });
    expect(variants).toHaveLength(1);

    // The old (merged-away) variant row must still exist with quantity 0 — NOT deleted —
    // because its inward_lines / stock_movements rows reference it by foreign key.
    const db = getDb();
    const oldRow = db.prepare('SELECT * FROM variants WHERE id = ?').get(variant350.id);
    expect(oldRow).toBeDefined();
    expect(oldRow.quantity).toBe(0);

    // Historical movement for the now-merged-away variant must still be queryable.
    const oldMovements = db.prepare('SELECT * FROM stock_movements WHERE variant_id = ?').all(variant350.id);
    expect(oldMovements).toHaveLength(1);
    expect(oldMovements[0].quantity).toBe(2);
  });

  // Test 9: Invalid batch causes full transaction rollback
  test('Test 9: Invalid batch quantity causes full transaction rollback', () => {
    const g = createGodown({ name: 'Rollback T9', address: 'T9' });
    const p = createProduct({ product_code: 'T9P', product_name: 'T9 Product' });
    const db = getDb();
    const before = db.prepare('SELECT count(*) as cnt FROM variants').get().cnt;
    expect(() => createInwardTransaction({
      godownId: g.id, productId: p.id,
      batches: [
        { lengthMeters: 50, quantity: 1, ratePerMeter: 0 },
        { lengthMeters: -10, quantity: 1, ratePerMeter: 0 },
        { lengthMeters: 30, quantity: 1, ratePerMeter: 0 },
      ],
    })).toThrow();
    expect(db.prepare('SELECT count(*) as cnt FROM variants').get().cnt).toBe(before);
  });

  // Test 10: Pricing section records rate_per_meter and total_price correctly
  test('Test 10: Inward transaction persists rate_per_meter and total_price', () => {
    const g = createGodown({ name: 'Price T10', address: 'T10' });
    const p = createProduct({ product_code: 'T10P', product_name: 'T10 Product' });
    const tx = createInwardTransaction({
      godownId: g.id,
      productId: p.id,
      batches: [{ lengthMeters: 50, quantity: 3, ratePerMeter: 400 }], // 150m total @ 400/m
    });
    expect(tx.rate_per_meter).toBe(400);
    expect(tx.total_price).toBe(60000);

    const saved = getInwardTransactionById(tx.id);
    expect(saved.rate_per_meter).toBe(400);
    expect(saved.total_price).toBe(60000);
    expect(saved.lines[0].rate_per_meter).toBe(400);
  });

  // Test 11: Mixed rates in one transaction compute a correct weighted-average rate
  test('Test 11: Mixed-rate batches in one transaction compute the correct weighted-average rate', () => {
    const g = createGodown({ name: 'Weighted T11', address: 'T11' });
    const p = createProduct({ product_code: 'T11P', product_name: 'T11 Product' });
    // 100m @ 300/m = 30000, and 50m @ 600/m = 30000 -> total 150m, total 60000 -> avg 400/m
    const tx = createInwardTransaction({
      godownId: g.id,
      productId: p.id,
      batches: [
        { lengthMeters: 100, quantity: 1, ratePerMeter: 300 },
        { lengthMeters: 50, quantity: 1, ratePerMeter: 600 },
      ],
    });
    expect(tx.total_price).toBe(60000);
    expect(tx.rate_per_meter).toBe(400);
  });

  // Test 12: Outward dispatch decrements the correct variant and records total price
  test('Test 12: Outward dispatch decrements variant quantity and records sale price', () => {
    const g = createGodown({ name: 'Dispatch T12', address: 'T12' });
    const p = createProduct({ product_code: 'T12P', product_name: 'T12 Product' });
    const inTx = createInwardTransaction({ godownId: g.id, productId: p.id, batches: [{ lengthMeters: 30, quantity: 10, ratePerMeter: 300 }] });
    const variantId = inTx.lines[0].variant_id;

    const outTx = createOutwardTransaction({
      godownId: g.id,
      items: [{ variantId, quantity: 4 }],
      ratePerMeter: 500,
    });

    expect(outTx.total_price).toBe(4 * 30 * 500);
    expect(getVariantById(variantId).quantity).toBe(6);

    const saved = getOutwardTransactionById(outTx.id);
    expect(saved.lines[0].quantity).toBe(4);
    expect(saved.lines[0].rate_per_meter).toBe(500);
  });

  // Test 13: listAllVariants scoping by godown and product
  test('Test 13: listAllVariants is correctly scoped by godown and by product', () => {
    const gA = createGodown({ name: 'List A T13', address: 'A' });
    const gB = createGodown({ name: 'List B T13', address: 'B' });
    const p1 = createProduct({ product_code: 'T13P1', product_name: 'T13 Product 1' });
    const p2 = createProduct({ product_code: 'T13P2', product_name: 'T13 Product 2' });

    createInwardTransaction({ godownId: gA.id, productId: p1.id, batches: [{ lengthMeters: 20, quantity: 1, ratePerMeter: 0 }] });
    createInwardTransaction({ godownId: gA.id, productId: p2.id, batches: [{ lengthMeters: 25, quantity: 1, ratePerMeter: 0 }] });
    createInwardTransaction({ godownId: gB.id, productId: p1.id, batches: [{ lengthMeters: 35, quantity: 1, ratePerMeter: 0 }] });

    expect(listAllVariants({ godownId: gA.id })).toHaveLength(2);
    expect(listAllVariants({ godownId: gB.id })).toHaveLength(1);
    expect(listAllVariants({ productId: p1.id })).toHaveLength(2);
    expect(listAllVariants({})).toHaveLength(3);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// NEW: Bulk Lots — total meters + roll count known, no fixed per-roll size
// ═══════════════════════════════════════════════════════════════════════════════

describe('Incoming/Outgoing Stock — Bulk Lot Tests', () => {
  const TEST_DB3 = path.join(process.cwd(), 'tests', 'test_bulk.db');

  beforeEach(() => {
    if (fs.existsSync(TEST_DB3)) { try { closeDatabase(); fs.unlinkSync(TEST_DB3); } catch {} }
    initDatabase(TEST_DB3);
  });

  afterAll(() => {
    closeDatabase();
    if (fs.existsSync(TEST_DB3)) { try { fs.unlinkSync(TEST_DB3); } catch {} }
  });

  // Test B1: Bulk inward creates one lot with correct totals
  test('Test B1: Bulk inward (500m / 30 rolls @ Rs.100/m) creates one bulk lot', () => {
    const g = createGodown({ name: 'Bulk Godown B1', address: 'B1' });
    const p = createProduct({ product_code: 'BULK_B1', product_name: 'Bulk Product B1' });

    const tx = createBulkInwardTransaction({
      godownId: g.id, productId: p.id, totalMeters: 500, quantity: 30, ratePerMeter: 100,
    });
    expect(tx.lines).toHaveLength(1);
    expect(tx.lines[0].is_bulk).toBe(true);
    expect(tx.total_price).toBe(50000);

    const lots = listBulkLotsByProduct(p.id, { godownId: g.id });
    expect(lots).toHaveLength(1);
    expect(lots[0].quantity).toBe(30);
    expect(lots[0].total_length_meters).toBe(500);
  });

  // Test B2: Adding more at the same rate merges into the same lot
  test('Test B2: Adding more bulk stock at the same rate merges into the existing lot', () => {
    const g = createGodown({ name: 'Bulk Merge B2', address: 'B2' });
    const p = createProduct({ product_code: 'BULK_B2', product_name: 'Bulk Product B2' });

    createBulkInwardTransaction({ godownId: g.id, productId: p.id, totalMeters: 500, quantity: 30, ratePerMeter: 100 });
    createBulkInwardTransaction({ godownId: g.id, productId: p.id, totalMeters: 200, quantity: 10, ratePerMeter: 100 });

    const lots = listBulkLotsByProduct(p.id, { godownId: g.id });
    expect(lots).toHaveLength(1);
    expect(lots[0].quantity).toBe(40);
    expect(lots[0].total_length_meters).toBe(700);
  });

  // Test B3: A different rate creates a separate bulk lot
  test('Test B3: Bulk stock added at a different rate creates a separate lot', () => {
    const g = createGodown({ name: 'Bulk Rate Split B3', address: 'B3' });
    const p = createProduct({ product_code: 'BULK_B3', product_name: 'Bulk Product B3' });

    createBulkInwardTransaction({ godownId: g.id, productId: p.id, totalMeters: 500, quantity: 30, ratePerMeter: 100 });
    createBulkInwardTransaction({ godownId: g.id, productId: p.id, totalMeters: 100, quantity: 5, ratePerMeter: 120 });

    const lots = listBulkLotsByProduct(p.id, { godownId: g.id });
    expect(lots).toHaveLength(2);
  });

  // Test B4: Dispatch from a bulk lot decrements both meters and rolls
  test('Test B4: Dispatching from a bulk lot decrements both meters and roll count', () => {
    const g = createGodown({ name: 'Bulk Dispatch B4', address: 'B4' });
    const p = createProduct({ product_code: 'BULK_B4', product_name: 'Bulk Product B4' });
    createBulkInwardTransaction({ godownId: g.id, productId: p.id, totalMeters: 500, quantity: 30, ratePerMeter: 100 });
    const lot = listBulkLotsByProduct(p.id, { godownId: g.id })[0];

    const outTx = createOutwardTransaction({
      godownId: g.id,
      items: [{ bulkLotId: lot.id, quantity: 5, lengthMeters: 100 }],
      ratePerMeter: 150,
    });
    expect(outTx.lines[0].is_bulk).toBe(true);
    expect(outTx.total_price).toBe(100 * 150);

    const updated = listBulkLotsByProduct(p.id, { godownId: g.id })[0];
    expect(updated.quantity).toBe(25);
    expect(updated.total_length_meters).toBe(400);
  });

  // Test B5: Over-dispatch (more meters than available) is rejected
  test('Test B5: Dispatching more meters than available from a bulk lot is rejected', () => {
    const g = createGodown({ name: 'Bulk Over B5', address: 'B5' });
    const p = createProduct({ product_code: 'BULK_B5', product_name: 'Bulk Product B5' });
    createBulkInwardTransaction({ godownId: g.id, productId: p.id, totalMeters: 100, quantity: 5, ratePerMeter: 100 });
    const lot = listBulkLotsByProduct(p.id, { godownId: g.id })[0];

    expect(() => createOutwardTransaction({
      godownId: g.id, items: [{ bulkLotId: lot.id, quantity: 1, lengthMeters: 9999 }],
    })).toThrow(/Only .* left/);

    const unchanged = listBulkLotsByProduct(p.id, { godownId: g.id })[0];
    expect(unchanged.quantity).toBe(5);
    expect(unchanged.total_length_meters).toBe(100);
  });

  // Test B6: Cross-godown bulk dispatch is rejected
  test('Test B6: Dispatching a bulk lot from the wrong godown is rejected', () => {
    const g1 = createGodown({ name: 'Bulk Cross A B6', address: 'A' });
    const g2 = createGodown({ name: 'Bulk Cross B B6', address: 'B' });
    const p = createProduct({ product_code: 'BULK_B6', product_name: 'Bulk Product B6' });
    createBulkInwardTransaction({ godownId: g1.id, productId: p.id, totalMeters: 100, quantity: 5, ratePerMeter: 100 });
    const lot = listBulkLotsByProduct(p.id, { godownId: g1.id })[0];

    expect(() => createOutwardTransaction({
      godownId: g2.id, items: [{ bulkLotId: lot.id, quantity: 1, lengthMeters: 10 }],
    })).toThrow(/different godown/);
  });

  // Test B7: A single outward transaction can mix a roll-size item and a bulk item
  test('Test B7: One dispatch transaction can mix a roll-size variant and a bulk lot', () => {
    const g = createGodown({ name: 'Bulk Mixed B7', address: 'B7' });
    const p = createProduct({ product_code: 'BULK_B7', product_name: 'Bulk Product B7' });
    createInwardTransaction({ godownId: g.id, productId: p.id, batches: [{ lengthMeters: 30, quantity: 3, ratePerMeter: 300 }] });
    createBulkInwardTransaction({ godownId: g.id, productId: p.id, totalMeters: 500, quantity: 30, ratePerMeter: 100 });

    const variant = listVariantsByProduct(p.id, { godownId: g.id })[0];
    const lot = listBulkLotsByProduct(p.id, { godownId: g.id })[0];

    const mixedTx = createOutwardTransaction({
      godownId: g.id,
      items: [
        { variantId: variant.id, quantity: 1 },
        { bulkLotId: lot.id, quantity: 2, lengthMeters: 50 },
      ],
    });
    expect(mixedTx.lines).toHaveLength(2);
    expect(mixedTx.lines.some((l: any) => l.is_bulk)).toBe(true);
    expect(mixedTx.lines.some((l: any) => !l.is_bulk)).toBe(true);
  });

  // Test B8: getInwardTransactionById returns bulk lines correctly
  test('Test B8: getInwardTransactionById returns the bulk line with correct totals', () => {
    const g = createGodown({ name: 'Bulk Fetch B8', address: 'B8' });
    const p = createProduct({ product_code: 'BULK_B8', product_name: 'Bulk Product B8' });
    const tx = createBulkInwardTransaction({ godownId: g.id, productId: p.id, totalMeters: 500, quantity: 30, ratePerMeter: 100 });

    const full = getInwardTransactionById(tx.id);
    expect(full.lines).toHaveLength(1);
    expect(full.lines[0].is_bulk).toBe(true);
    expect(full.lines[0].length_meters).toBe(500);
    expect(full.lines[0].quantity).toBe(30);
  });

  // Test B9: listInwardTransactions includes bulk rolls/meters in its totals
  test('Test B9: listInwardTransactions rolls up bulk roll count and meters correctly', () => {
    const g = createGodown({ name: 'Bulk List B9', address: 'B9' });
    const p = createProduct({ product_code: 'BULK_B9', product_name: 'Bulk Product B9' });
    const tx = createBulkInwardTransaction({ godownId: g.id, productId: p.id, totalMeters: 500, quantity: 30, ratePerMeter: 100 });

    const list = listInwardTransactions({ godownId: g.id });
    const entry = list.find((t: any) => t.id === tx.id);
    expect(entry.roll_count).toBe(30);
    expect(entry.total_received_meters).toBe(500);
  });

  // Test B10: updateBulkLotRate merges on collision without deleting the old row (FK-safe)
  test('Test B10: Re-rating a bulk lot to match an existing one merges them and preserves history (FK-safe)', () => {
    const g = createGodown({ name: 'Bulk Rerate B10', address: 'B10' });
    const p = createProduct({ product_code: 'BULK_B10', product_name: 'Bulk Product B10' });
    createBulkInwardTransaction({ godownId: g.id, productId: p.id, totalMeters: 500, quantity: 30, ratePerMeter: 100 });
    createBulkInwardTransaction({ godownId: g.id, productId: p.id, totalMeters: 100, quantity: 5, ratePerMeter: 120 });

    const lots = listBulkLotsByProduct(p.id, { godownId: g.id });
    const lot120 = lots.find((l: any) => l.rate_per_meter === 120);
    const lot100 = lots.find((l: any) => l.rate_per_meter === 100);

    const merged = updateBulkLotRate(lot120.id, 100);
    expect(merged.rate_per_meter).toBe(100);
    expect(merged.quantity).toBe(35);
    expect(merged.total_length_meters).toBe(600);

    const db = getDb();
    const oldRow = db.prepare('SELECT * FROM bulk_lots WHERE id = ?').get(lot120.id);
    expect(oldRow).toBeDefined();
    expect(oldRow.quantity).toBe(0);
  });
});
