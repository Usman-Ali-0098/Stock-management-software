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
const { getRollById, getRollByCode, listRollsByProduct, listAvailableRolls, getRollHistory } = require('../electron/repositories/rollRepo.cjs');
// @ts-ignore
const { createInwardTransaction, getInwardTransactionById, createSupplierBill, listSupplierBills, getSupplierBillById, verifyBillItemWithRolls } = require('../electron/services/inwardService.cjs');
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

    // Receive 40 rolls into Godown 1
    const lengthsG1 = Array(40).fill(50); // 40 rolls of 50m each
    createInwardTransaction({
      godownId: g1.id,
      productId: prodA.id,
      rollLengthsMeters: lengthsG1,
      referenceNote: 'Batch for Godown 1',
    });

    // Receive 10 rolls into Godown 2
    const lengthsG2 = Array(10).fill(30); // 10 rolls of 30m each
    createInwardTransaction({
      godownId: g2.id,
      productId: prodA.id,
      rollLengthsMeters: lengthsG2,
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

    // Ensure listAvailableRolls strictly isolates godown stock
    const rollsG1 = listAvailableRolls({ godownId: g1.id });
    const rollsG2 = listAvailableRolls({ godownId: g2.id });
    expect(rollsG1).toHaveLength(40);
    expect(rollsG2).toHaveLength(10);

    // Verify neither godown displays the other godown's rolls
    const g1Ids = new Set(rollsG1.map((r: any) => r.id));
    const g2Ids = new Set(rollsG2.map((r: any) => r.id));
    for (const id of g1Ids) {
      expect(g2Ids.has(id)).toBe(false);
    }
  });

  // ─── Test C: Different roll lengths ─────────────────────────────────────────
  test('Test C: Receive five rolls (40m, 50m, 100m, 150m, 75m) into Godown 1 -> Available: 5 rolls, 415m', () => {
    const g1 = createGodown({ name: 'Godown 1 Central', address: 'Shah Alam' });
    const prodA = createProduct({ product_code: 'A_C', product_name: 'Product A Core' });

    const inwardTx = createInwardTransaction({
      godownId: g1.id,
      productId: prodA.id,
      rollLengthsMeters: [40, 50, 100, 150, 75],
      referenceNote: 'Test C shipment',
    });

    expect(inwardTx.rolls).toHaveLength(5);
    expect(inwardTx.slip_number).toMatch(/^IN-\d{8}-\d{3}/);

    const lengths = inwardTx.rolls.map((r: any) => r.original_length_meters);
    expect(lengths).toEqual([40, 50, 100, 150, 75]);

    // Check product summary calculation in Godown 1
    const summary = getProductById(prodA.id, g1.id);
    expect(summary.available_rolls).toBe(5);
    expect(summary.total_available_meters).toBe(415); // 40 + 50 + 100 + 150 + 75 = 415
  });

  // ─── Test D: Issue a specific roll ──────────────────────────────────────────
  test('Test D: Issue the 50-meter roll -> Available: 4 rolls, 365m; Roll marked Issued', () => {
    const g1 = createGodown({ name: 'Godown 1 Issue Test', address: 'Shah Alam' });
    const prodA = createProduct({ product_code: 'A_D', product_name: 'Product A Issue' });

    const inwardTx = createInwardTransaction({
      godownId: g1.id,
      productId: prodA.id,
      rollLengthsMeters: [40, 50, 100, 150, 75],
    });

    const roll50 = inwardTx.rolls.find((r: any) => r.original_length_meters === 50);
    expect(roll50).toBeDefined();

    // Issue the specific 50-meter roll
    const outwardTx = createOutwardTransaction({
      godownId: g1.id,
      rollId: roll50.id,
      recipientReference: 'Customer Shah Alam',
      notes: 'Urgent 50m order',
    });

    expect(outwardTx.slip_number).toMatch(/^OUT-\d{8}-\d{3}/);
    expect(outwardTx.roll.id).toBe(roll50.id);

    // Verify stock in Godown 1
    const summary = getProductById(prodA.id, g1.id);
    expect(summary.available_rolls).toBe(4);
    expect(summary.total_available_meters).toBe(365); // 415 - 50 = 365

    // Verify issued roll status and remaining length
    const dbRoll = getRollById(roll50.id);
    expect(dbRoll.status).toBe('fully_issued');
    expect(dbRoll.remaining_length_meters).toBe(0);
    expect(dbRoll.original_length_meters).toBe(50);

    // Verify other 4 rolls remain available
    const available = listAvailableRolls({ godownId: g1.id, productId: prodA.id });
    expect(available).toHaveLength(4);
    expect(available.some((r: any) => r.id === roll50.id)).toBe(false);
  });

  // ─── Test E: Roll history ───────────────────────────────────────────────────
  test('Test E: Open issued roll history and verify complete movement record', () => {
    const g1 = createGodown({ name: 'Godown 1 History Test', address: 'Shah Alam' });
    const prod = createProduct({ product_code: 'A_E', product_name: 'Product A Hist' });

    const inTx = createInwardTransaction({
      godownId: g1.id,
      productId: prod.id,
      rollLengthsMeters: [50],
      referenceNote: 'Supplier Delivery Note 99',
    });
    const roll = inTx.rolls[0];

    const outTx = createOutwardTransaction({
      godownId: g1.id,
      rollId: roll.id,
      recipientReference: 'Buyer Lahore 1',
      notes: 'Full roll issued',
    });

    // Query comprehensive history
    const historyData = getRollHistory(roll.id);
    expect(historyData).toBeDefined();
    expect(historyData.roll.roll_code).toBe(roll.roll_code);
    expect(historyData.roll.original_length_meters).toBe(50);
    expect(historyData.roll.status).toBe('fully_issued');

    expect(historyData.events).toHaveLength(2);

    // Event 1: Received
    const eventIn = historyData.events[0];
    expect(eventIn.transaction_type).toBe('inward');
    expect(eventIn.slip_number).toBe(inTx.slip_number);
    expect(eventIn.length_involved_meters).toBe(50);
    expect(eventIn.godown_id).toBe(g1.id);

    // Event 2: Issued
    const eventOut = historyData.events[1];
    expect(eventOut.transaction_type).toBe('outward');
    expect(eventOut.slip_number).toBe(outTx.slip_number);
    expect(eventOut.length_involved_meters).toBe(50);
    expect(eventOut.recipient_reference).toBe('Buyer Lahore 1');
    expect(eventOut.godown_id).toBe(g1.id);
  });

  // ─── Test F: Prevent cross-godown issuance ──────────────────────────────────
  test('Test F: Attempt to issue a roll belonging to Godown 1 while operating in Godown 2 must be rejected', () => {
    const g1 = createGodown({ name: 'Godown 1 Isolated', address: 'Lahore Gate 1' });
    const g2 = createGodown({ name: 'Godown 2 Isolated', address: 'Lahore Gate 2' });

    const prod = createProduct({ product_code: 'A_F', product_name: 'Product A Cross' });

    // Receive roll in Godown 1
    const inTx = createInwardTransaction({
      godownId: g1.id,
      productId: prod.id,
      rollLengthsMeters: [70],
    });
    const rollInG1 = inTx.rolls[0];

    // Attempt to issue rollInG1 while specifying Godown 2
    expect(() => {
      createOutwardTransaction({
        godownId: g2.id, // User is operating in Godown 2!
        rollId: rollInG1.id,
        recipientReference: 'Unauthorized Cross Issue',
      });
    }).toThrow(/cannot be issued from/);

    // Verify stock in Godown 1 was NOT modified
    const rollCheck = getRollById(rollInG1.id);
    expect(rollCheck.status).toBe('available');
    expect(rollCheck.remaining_length_meters).toBe(70);

    const summaryG1 = getProductById(prod.id, g1.id);
    expect(summaryG1.available_rolls).toBe(1);
    expect(summaryG1.total_available_meters).toBe(70);

    const summaryG2 = getProductById(prod.id, g2.id);
    expect(summaryG2.available_rolls).toBe(0);
    expect(summaryG2.total_available_meters).toBe(0);
  });

  // ─── Test G: Switch godowns ─────────────────────────────────────────────────
  test('Test G: Switching godowns returns separate, non-overlapping stock, history, and totals', () => {
    const g1 = createGodown({ name: 'Godown 1 Switch', address: 'Addr 1' });
    const g2 = createGodown({ name: 'Godown 2 Switch', address: 'Addr 2' });
    const prod = createProduct({ product_code: 'A_G', product_name: 'Product A Switch' });

    // Inward to G1: 2 rolls (40m, 60m)
    createInwardTransaction({
      godownId: g1.id,
      productId: prod.id,
      rollLengthsMeters: [40, 60],
    });

    // Inward to G2: 1 roll (90m)
    createInwardTransaction({
      godownId: g2.id,
      productId: prod.id,
      rollLengthsMeters: [90],
    });

    // State when viewing Godown 1
    const g1Stock = getProductById(prod.id, g1.id);
    const g1Rolls = listAvailableRolls({ godownId: g1.id });
    expect(g1Stock.available_rolls).toBe(2);
    expect(g1Stock.total_available_meters).toBe(100);
    expect(g1Rolls).toHaveLength(2);

    // State when viewing Godown 2 (simulating switch)
    const g2Stock = getProductById(prod.id, g2.id);
    const g2Rolls = listAvailableRolls({ godownId: g2.id });
    expect(g2Stock.available_rolls).toBe(1);
    expect(g2Stock.total_available_meters).toBe(90);
    expect(g2Rolls).toHaveLength(1);
  });

  // ─── Test H: Duplicate issue ────────────────────────────────────────────────
  test('Test H: Attempting to issue the same roll twice fails without modifying stock', () => {
    const g = createGodown({ name: 'Godown Double Issue', address: 'Market' });
    const prod = createProduct({ product_code: 'A_H', product_name: 'Product A Double' });

    const inTx = createInwardTransaction({
      godownId: g.id,
      productId: prod.id,
      rollLengthsMeters: [45],
    });
    const roll = inTx.rolls[0];

    // First issue succeeds
    const out1 = createOutwardTransaction({ godownId: g.id, rollId: roll.id });
    expect(out1.id).toBeDefined();

    // Second issue must fail
    expect(() => {
      createOutwardTransaction({ godownId: g.id, rollId: roll.id });
    }).toThrow(/already Fully Issued/);

    // Stock must reflect single issuance
    const summary = getProductById(prod.id, g.id);
    expect(summary.available_rolls).toBe(0);
    expect(summary.total_available_meters).toBe(0);
  });

  // ─── Test I: Persistence across database reconnects ─────────────────────────
  test('Test I: Close and reopen database; verify godowns, products, rolls, and stock persist', () => {
    const g = createGodown({ name: 'Godown Persistent', address: 'Lahore Shah Alam' });
    const prod = createProduct({ product_code: 'PERSIST', product_name: 'Persistent Leather' });

    createInwardTransaction({
      godownId: g.id,
      productId: prod.id,
      rollLengthsMeters: [120, 80],
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
  test('Test J: Inward and outward slips display correct godown name, slip number, roll IDs, and lengths', () => {
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
      items: [
        {
          roll_code: 'A-0001',
          product_name: 'Product A',
          product_code: 'A',
          received_length_meters: 50,
        },
      ],
    };

    const inwardHtml = generateInwardSlipHtml(inwardTx, shopSettings);
    expect(inwardHtml).toContain('Godown 1 — Main Warehouse');
    expect(inwardHtml).toContain('IN-20261014-001');
    expect(inwardHtml).toContain('A-0001');
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
      items: [
        {
          roll_code: 'A-0001',
          product_name: 'Product A',
          product_code: 'A',
          original_length_meters: 50,
          issued_length_meters: 50,
        },
      ],
    };

    const outwardHtml = generateOutwardSlipHtml(outwardTx, shopSettings);
    expect(outwardHtml).toContain('Godown 1 — Main Warehouse');
    expect(outwardHtml).toContain('OUT-20261014-001');
    expect(outwardHtml).toContain('Shah Alam Buyer Co');
    expect(outwardHtml).toContain('A-0001');
    expect(outwardHtml).toContain('50.00 m');
  });

  // ─── Test K: Backup & Restore ───────────────────────────────────────────────
  test('Test K: Backup database, restore into test instance, and verify godowns and roll histories remain intact', () => {
    const g = createGodown({ name: 'Godown Backup K', address: 'Market' });
    const prod = createProduct({ product_code: 'PROD_K', product_name: 'Product K' });

    const inTx = createInwardTransaction({
      godownId: g.id,
      productId: prod.id,
      rollLengthsMeters: [55, 65],
    });
    const issuedRoll = inTx.rolls[0];

    createOutwardTransaction({
      godownId: g.id,
      rollId: issuedRoll.id,
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

    // Verify roll history in backup
    const historyEntries = backupDb.prepare('SELECT * FROM roll_history WHERE roll_id = ?').all(issuedRoll.id);
    expect(historyEntries).toHaveLength(2); // inward + outward

    backupDb.close();
    fs.unlinkSync(backupFile);
  });

  // ─── Test L: Upgrade legacy database without godown_id ───────────────────────
  test('Test L: Seamlessly upgrade legacy database schema without godown_id columns', () => {
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

    // Now initDatabase must run migration 3 without any errors
    expect(() => {
      initDatabase(TEST_DB_PATH);
    }).not.toThrow();

    const db = getDb();
    const cols = db.prepare("PRAGMA table_info(inward_transactions)").all();
    expect(cols.some((c: any) => c.name === 'godown_id')).toBe(true);
  });

  // ─── Test M: Factory Reset wipes test rolls, transactions, & products ─────────
  test('Test M: Factory Reset wipes all test rolls, transactions, and products while preserving clean schema', () => {
    const g1 = createGodown({ name: 'Godown Test Reset', address: 'Lahore' });
    const prod = createProduct({ product_code: 'TEST-RESET', product_name: 'Test Product For Reset' });

    createInwardTransaction({
      godownId: g1.id,
      productId: prod.id,
      rollLengthsMeters: [50, 60, 70],
      referenceNote: 'Dummy test inward',
    });

    const rollsBefore = listAvailableRolls(g1.id);
    expect(rollsBefore.length).toBe(3);

    // Perform factory reset with clearProducts: true
    const result = performFactoryReset({ clearProducts: true });
    expect(result.success).toBe(true);

    const db = getDb();
    const rollCount = db.prepare('SELECT count(*) as count FROM rolls').get().count;
    const inwardCount = db.prepare('SELECT count(*) as count FROM inward_transactions').get().count;
    const outwardCount = db.prepare('SELECT count(*) as count FROM outward_transactions').get().count;
    const prodCount = db.prepare('SELECT count(*) as count FROM products').get().count;

    expect(rollCount).toBe(0);
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
// NEW: Supplier Bills, Mode A/B, Verification, Data Integrity Acceptance Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('Incoming Stock — Supplier Bill & Roll Verification Acceptance Tests', () => {
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
      godownId: null, productId: prod.id, rollLengthsMeters: [30],
    })).toThrow(/godown/i);
  });

  // Test 2: Transaction records correct godown ID
  test('Test 2: New inward transaction records correct godown_id on tx and roll', () => {
    const g = createGodown({ name: 'Test Godown T2', address: 'Test Street' });
    const p = createProduct({ product_code: 'T2P', product_name: 'Test2 Product' });
    const tx = createInwardTransaction({ godownId: g.id, productId: p.id, rollLengthsMeters: [50] });
    expect(tx.godown_id).toBe(g.id);
    const db = getDb();
    const dbRoll = db.prepare('SELECT godown_id FROM rolls WHERE id = ?').get(tx.rolls[0].id);
    expect(dbRoll.godown_id).toBe(g.id);
  });

  // Test 3: Stock in Godown A does not affect Godown B
  test('Test 3: Stock in Godown A does not change Godown B', () => {
    const gA = createGodown({ name: 'Godown A-T3', address: 'A' });
    const gB = createGodown({ name: 'Godown B-T3', address: 'B' });
    const p  = createProduct({ product_code: 'T3P', product_name: 'Test3 Product' });
    createInwardTransaction({ godownId: gA.id, productId: p.id, rollLengthsMeters: [100, 200] });
    expect(getProductById(p.id, gA.id).available_rolls).toBe(2);
    expect(getProductById(p.id, gB.id).available_rolls).toBe(0);
  });

  // Test 4: Mode A — multiple product lines, all pending, no roll records
  test('Test 4: Supplier bill saves multiple products as pending with no roll records', () => {
    const g = createGodown({ name: 'Mode A Godown T4', address: 'T4' });
    const p1 = createProduct({ product_code: '192BLK', product_name: '192 Black' });
    const p2 = createProduct({ product_code: '191BLK', product_name: '191 Black' });
    const p3 = createProduct({ product_code: '190BLK', product_name: '190 Black' });
    const bill = createSupplierBill({
      godownId: g.id, billNumber: 'INV-2026-001', billDate: '2026-10-21',
      items: [
        { productId: p1.id, supplierTotalMeters: 7000, supplierTotalRolls: 100 },
        { productId: p2.id, supplierTotalMeters: 8000, supplierTotalRolls: 120 },
        { productId: p3.id, supplierTotalMeters: 10000, supplierTotalRolls: 120 },
      ],
    });
    expect(bill.items).toHaveLength(3);
    const grandRolls = bill.items!.reduce((s: number, i: any) => s + i.supplier_total_rolls, 0);
    expect(grandRolls).toBe(340);
    for (const item of bill.items!) {
      expect((item as any).verification_status).toBe('pending');
    }
    const db = getDb();
    expect(db.prepare('SELECT count(*) as cnt FROM rolls WHERE product_id = ?').get(p1.id).cnt).toBe(0);
  });

  // Test 5: Duplicate bill number rejected
  test('Test 5: Duplicate supplier bill number is rejected', () => {
    const g = createGodown({ name: 'Dup Bill T5', address: 'T5' });
    const p = createProduct({ product_code: 'T5P', product_name: 'T5 Product' });
    createSupplierBill({ godownId: g.id, billNumber: 'BILL-DUP', items: [{ productId: p.id, supplierTotalMeters: 100, supplierTotalRolls: 2 }] });
    expect(() => createSupplierBill({ godownId: g.id, billNumber: 'BILL-DUP', items: [{ productId: p.id, supplierTotalMeters: 50, supplierTotalRolls: 1 }] }))
      .toThrow(/already exists/i);
  });

  // Test 6: No fake roll lengths created from bill totals
  test('Test 6: Supplier bill does NOT create roll records (no fake lengths)', () => {
    const g = createGodown({ name: 'No Fake T6', address: 'T6' });
    const p = createProduct({ product_code: 'T6P', product_name: 'T6 Product' });
    createSupplierBill({ godownId: g.id, items: [{ productId: p.id, supplierTotalMeters: 7000, supplierTotalRolls: 100 }] });
    const db = getDb();
    expect(db.prepare('SELECT count(*) as cnt FROM rolls WHERE product_id = ?').get(p.id).cnt).toBe(0);
    expect(getProductById(p.id, g.id).available_rolls).toBe(0);
  });

  // Test 7: 10 rolls × 50m = 10 individual records, 500m total
  test('Test 7: Mode B batch creates 10 individual roll records totalling 500m', () => {
    const g = createGodown({ name: 'Mode B T7', address: 'T7' });
    const p = createProduct({ product_code: 'T7P', product_name: 'T7 Product' });
    const tx = createInwardTransaction({ godownId: g.id, productId: p.id, rollLengthsMeters: Array(10).fill(50) });
    expect(tx.rolls).toHaveLength(10);
    expect(tx.rolls.every((r: any) => r.original_length_meters === 50)).toBe(true);
    const codes = new Set(tx.rolls.map((r: any) => r.roll_code));
    expect(codes.size).toBe(10); // all unique
    const stock = getProductById(p.id, g.id);
    expect(stock.available_rolls).toBe(10);
    expect(stock.total_available_meters).toBe(500);
  });

  // Test 8: Multiple lengths with quantities calculate correctly
  test('Test 8: 4×29m + 10×30m + 6×31m + 5×32m = 25 rolls, 762m', () => {
    const g = createGodown({ name: 'Multi Len T8', address: 'T8' });
    const p = createProduct({ product_code: 'T8P', product_name: 'T8 Product' });
    const lengths = [...Array(4).fill(29), ...Array(10).fill(30), ...Array(6).fill(31), ...Array(5).fill(32)];
    const tx = createInwardTransaction({ godownId: g.id, productId: p.id, rollLengthsMeters: lengths });
    expect(tx.rolls).toHaveLength(25);
    expect(getProductById(p.id, g.id).total_available_meters).toBe(762);
  });

  // Test 9: Decimal lengths preserved
  test('Test 9: Decimal lengths (29.5, 30.0, 31.25) stored correctly in mm', () => {
    const g = createGodown({ name: 'Decimal T9', address: 'T9' });
    const p = createProduct({ product_code: 'T9P', product_name: 'T9 Product' });
    const tx = createInwardTransaction({ godownId: g.id, productId: p.id, rollLengthsMeters: [29.5, 30.0, 31.25] });
    expect(tx.rolls[0].original_length_meters).toBe(29.5);
    expect(tx.rolls[2].original_length_meters).toBe(31.25);
    const db = getDb();
    const r = db.prepare('SELECT original_length_mm FROM rolls WHERE id = ?').get(tx.rolls[2].id);
    expect(r.original_length_mm).toBe(31250);
  });

  // Test 10: verifyBillItemWithRolls links rolls to bill, updates status to verified
  test('Test 10: verifyBillItemWithRolls creates rolls and marks item verified', () => {
    const g = createGodown({ name: 'Verify T10', address: 'T10' });
    const p = createProduct({ product_code: 'T10P', product_name: 'T10 Product' });
    const bill = createSupplierBill({ godownId: g.id, billNumber: 'VER-001', items: [{ productId: p.id, supplierTotalMeters: 762, supplierTotalRolls: 25 }] });
    const billItemId = bill.items![0].id;
    const lengths = [...Array(4).fill(29), ...Array(10).fill(30), ...Array(6).fill(31), ...Array(5).fill(32)];
    const result = verifyBillItemWithRolls({ billItemId, godownId: g.id, rollLengthsMeters: lengths });
    expect(result.verifiedRolls).toBe(25);
    expect(result.verifiedMeters).toBe(762);
    expect(result.rollCountDiff).toBe(0);
    expect(result.status).toBe('verified');
    const updatedBill = getSupplierBillById(bill.id);
    expect(updatedBill.items[0].verification_status).toBe('verified');
    expect(getProductById(p.id, g.id).available_rolls).toBe(25);
  });

  // Test 11: Meter discrepancy shows as discrepancy status
  test('Test 11: Meter discrepancy is detected and status set to discrepancy', () => {
    const g = createGodown({ name: 'Discrepancy T11', address: 'T11' });
    const p = createProduct({ product_code: 'T11P', product_name: 'T11 Product' });
    const bill = createSupplierBill({ godownId: g.id, items: [{ productId: p.id, supplierTotalMeters: 7000, supplierTotalRolls: 100 }] });
    const result = verifyBillItemWithRolls({ billItemId: bill.items![0].id, godownId: g.id, rollLengthsMeters: Array(100).fill(69.5) });
    expect(result.verifiedRolls).toBe(100);
    expect(result.rollCountDiff).toBe(0);
    expect(result.status).toBe('discrepancy');
    // Supplier figures unchanged
    expect(getSupplierBillById(bill.id).items[0].supplier_total_meters).toBe(7000);
  });

  // Test 12: Cannot verify the same bill item twice
  test('Test 12: verifyBillItemWithRolls prevents double-verification', () => {
    const g = createGodown({ name: 'No Double T12', address: 'T12' });
    const p = createProduct({ product_code: 'T12P', product_name: 'T12 Product' });
    const bill = createSupplierBill({ godownId: g.id, items: [{ productId: p.id, supplierTotalMeters: 500, supplierTotalRolls: 10 }] });
    const billItemId = bill.items![0].id;
    verifyBillItemWithRolls({ billItemId, godownId: g.id, rollLengthsMeters: Array(10).fill(50) });
    expect(() => verifyBillItemWithRolls({ billItemId, godownId: g.id, rollLengthsMeters: Array(10).fill(50) }))
      .toThrow(/already has actual rolls/i);
    expect(getProductById(p.id, g.id).available_rolls).toBe(10);
  });

  // Test 13: listSupplierBills filters by godown
  test('Test 13: listSupplierBills is scoped to the requested godown', () => {
    const gA = createGodown({ name: 'Bill A T13', address: 'A' });
    const gB = createGodown({ name: 'Bill B T13', address: 'B' });
    const p  = createProduct({ product_code: 'T13P', product_name: 'T13 Product' });
    createSupplierBill({ godownId: gA.id, billNumber: 'A-001', items: [{ productId: p.id, supplierTotalMeters: 100, supplierTotalRolls: 2 }] });
    createSupplierBill({ godownId: gB.id, billNumber: 'B-001', items: [{ productId: p.id, supplierTotalMeters: 200, supplierTotalRolls: 4 }] });
    expect(listSupplierBills({ godownId: gA.id })).toHaveLength(1);
    expect(listSupplierBills({ godownId: gB.id })[0].bill_number).toBe('B-001');
  });

  // Test 14: Roll breakdown uses actual lengths, not inferred
  test('Test 14: Roll-length breakdown reflects actual stored mm values', () => {
    const g = createGodown({ name: 'Breakdown T14', address: 'T14' });
    const p = createProduct({ product_code: 'T14P', product_name: 'T14 Product' });
    createInwardTransaction({ godownId: g.id, productId: p.id, rollLengthsMeters: [...Array(4).fill(29), ...Array(10).fill(30), ...Array(6).fill(31)] });
    const db = getDb();
    const breakdown = db.prepare('SELECT original_length_mm, COUNT(*) as cnt FROM rolls WHERE product_id = ? AND godown_id = ? GROUP BY original_length_mm ORDER BY original_length_mm').all(p.id, g.id);
    expect(breakdown[0]).toMatchObject({ original_length_mm: 29000, cnt: 4 });
    expect(breakdown[1]).toMatchObject({ original_length_mm: 30000, cnt: 10 });
    expect(breakdown[2]).toMatchObject({ original_length_mm: 31000, cnt: 6 });
  });

  // Test 15: Failed transaction rolls back completely
  test('Test 15: Invalid roll length causes full transaction rollback', () => {
    const g = createGodown({ name: 'Rollback T15', address: 'T15' });
    const p = createProduct({ product_code: 'T15P', product_name: 'T15 Product' });
    const db = getDb();
    const before = db.prepare('SELECT count(*) as cnt FROM rolls').get().cnt;
    expect(() => createInwardTransaction({ godownId: g.id, productId: p.id, rollLengthsMeters: [50, -10, 30] })).toThrow();
    expect(db.prepare('SELECT count(*) as cnt FROM rolls').get().cnt).toBe(before);
  });

  // Test 16: Supplier bill requires godownId
  test('Test 16: createSupplierBill throws without godownId', () => {
    const p = createProduct({ product_code: 'T16P', product_name: 'T16 Product' });
    expect(() => createSupplierBill({ godownId: null, items: [{ productId: p.id, supplierTotalMeters: 100, supplierTotalRolls: 2 }] })).toThrow(/godown/i);
  });

  // Test 17: Supplier bill requires at least one item
  test('Test 17: createSupplierBill throws with empty items', () => {
    const g = createGodown({ name: 'Empty T17', address: 'T17' });
    expect(() => createSupplierBill({ godownId: g.id, items: [] })).toThrow(/at least one/i);
  });

  // Test 18: Pending bill stock not counted as verified
  test('Test 18: Pending bill items are NOT counted in verified roll stock', () => {
    const g = createGodown({ name: 'Honest T18', address: 'T18' });
    const p = createProduct({ product_code: 'T18P', product_name: 'T18 Product' });
    createSupplierBill({ godownId: g.id, items: [{ productId: p.id, supplierTotalMeters: 5000, supplierTotalRolls: 80 }] });
    createInwardTransaction({ godownId: g.id, productId: p.id, rollLengthsMeters: [30, 30, 30, 30, 30] });
    const stock = getProductById(p.id, g.id);
    expect(stock.available_rolls).toBe(5);
    expect(stock.total_available_meters).toBe(150);
  });

  // Test 19: Pricing section records rate_per_meter and total_price correctly
  test('Test 19: Inward transaction persists rate_per_meter and total_price', () => {
    const g = createGodown({ name: 'Price T19', address: 'T19' });
    const p = createProduct({ product_code: 'T19P', product_name: 'T19 Product' });
    const tx = createInwardTransaction({
      godownId: g.id,
      productId: p.id,
      rollLengthsMeters: [50, 50, 50], // 150m total
      ratePerMeter: 400,
      totalPrice: 60000,
    });
    expect(tx.rate_per_meter).toBe(400);
    expect(tx.total_price).toBe(60000);

    const saved = getInwardTransactionById(tx.id);
    expect(saved.rate_per_meter).toBe(400);
    expect(saved.total_price).toBe(60000);
    expect(saved.items[0].rate_per_meter).toBe(400);
  });
});
