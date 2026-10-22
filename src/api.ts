/**
 * Typed wrapper around window.electronAPI.invoke()
 * Provides typed responses and consistent error handling for multi-godown leather inventory.
 */

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ─── Domain Types ─────────────────────────────────────────────────────────────

export interface Godown {
  id: number;
  name: string;
  address: string;
  is_active: boolean;
  created_at: string;
  available_rolls?: number;
  total_available_meters?: number;
}

export interface Product {
  id: number;
  product_code: string;
  product_name: string;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  available_rolls: number;
  total_available_meters: number;
}

export interface Roll {
  id: number;
  roll_code: string;
  product_id: number;
  product_code?: string;
  product_name?: string;
  godown_id?: number;
  godown_name?: string;
  original_length_meters: number;
  remaining_length_meters: number;
  original_length_mm: number;
  remaining_length_mm: number;
  status: 'available' | 'fully_issued';
  inward_transaction_id: number;
  received_at: string;
  notes: string;
  purchase_rate?: number;
}

export interface RollHistoryItem {
  id: number;
  roll_id: number;
  godown_id: number;
  godown_name: string;
  transaction_type: 'inward' | 'outward';
  transaction_id: number;
  slip_number: string;
  event_timestamp: string;
  length_involved_mm: number;
  length_involved_meters: number;
  recipient_reference: string;
  notes: string;
}

export interface RollHistoryData {
  roll: Roll;
  events: RollHistoryItem[];
}

export interface InwardTransaction {
  id: number;
  godown_id: number;
  godown_name?: string;
  godown_address?: string;
  slip_number: string;
  transaction_date: string;
  reference_note: string;
  notes: string;
  rate_per_meter?: number;
  total_price?: number;
  created_at: string;
  roll_count?: number;
  total_received_meters?: number;
  items?: InwardTransactionItem[];
}

export interface InwardTransactionItem {
  id: number;
  inward_transaction_id: number;
  roll_id: number;
  roll_code: string;
  product_id: number;
  product_code: string;
  product_name: string;
  received_length_mm: number;
  received_length_meters: number;
  remaining_length_mm: number;
  remaining_length_meters: number;
  original_length_meters?: number;
  status: string;
  rate_per_meter?: number;
  total_price?: number;
}

// ─── Supplier Bill Types ──────────────────────────────────────────────────────

export type VerificationStatus = 'pending' | 'partial' | 'verified' | 'discrepancy';

export interface SupplierBillItem {
  id: number;
  supplier_bill_id: number;
  product_id: number;
  product_code: string;
  product_name: string;
  supplier_total_meters: number;
  supplier_total_rolls: number;
  verification_status: VerificationStatus;
  verified_rolls: number;
  verified_meters: number;
  inward_transaction_id: number | null;
  verified_slip_number?: string;
  notes: string;
}

export interface SupplierBill {
  id: number;
  godown_id: number;
  godown_name?: string;
  bill_number: string;
  bill_date: string;
  notes: string;
  created_at: string;
  item_count?: number;
  grand_total_meters?: number;
  grand_total_rolls?: number;
  items?: SupplierBillItem[];
}

export interface ProductStockSummary {
  verifiedRolls: number;
  verifiedMeters: number;
  pendingRolls: number;
  pendingMeters: number;
  rollBreakdown: Array<{ length_meters: number; count: number }>;
}

// ─── Other Types ──────────────────────────────────────────────────────────────

export interface OutwardTransaction {
  id: number;
  godown_id: number;
  godown_name?: string;
  godown_address?: string;
  slip_number: string;
  transaction_date: string;
  recipient_reference: string;
  notes: string;
  rate_per_meter?: number;
  total_price?: number;
  created_at: string;
  roll_count?: number;
  total_issued_meters?: number;
  items?: OutwardTransactionItem[];
}

export interface OutwardTransactionItem {
  id: number;
  outward_transaction_id: number;
  roll_id: number;
  roll_code: string;
  product_id: number;
  product_code: string;
  product_name: string;
  issued_length_mm: number;
  issued_length_meters: number;
  original_length_mm: number;
  original_length_meters: number;
  rate_per_meter?: number;
  total_price?: number;
  status: string;
}

export interface GodownBreakdown {
  id: number;
  name: string;
  address: string;
  available_rolls: number;
  total_available_meters: number;
  product_count: number;
}

export interface DashboardData {
  godownId: number | 'all';
  godownName: string;
  isOverall?: boolean;
  totalAvailableRolls: number;
  totalAvailableMeters: number;
  godownsBreakdown?: GodownBreakdown[];
  byProduct: Array<{
    id: number;
    product_code: string;
    product_name: string;
    available_rolls: number;
    total_available_meters: number;
    godown_counts?: Record<number, { rolls: number; meters: number }>;
  }>;
  todayInwardCount: number;
  todayOutwardCount: number;
  recentInward: Array<{
    id?: number;
    roll_code: string;
    original_length_meters: number;
    received_at: string;
    product_name: string;
    product_code: string;
    slip_number: string;
    godown_name?: string;
  }>;
  recentOutward: Array<{
    id?: number;
    roll_code: string;
    issued_length_meters: number;
    transaction_date: string;
    product_name: string;
    product_code: string;
    slip_number: string;
    recipient_reference: string;
    godown_name?: string;
  }>;
}

export interface HistoryRow {
  type: 'inward' | 'outward';
  transaction_id: number;
  godown_id?: number;
  godown_name?: string;
  slip_number: string;
  transaction_date: string;
  reference: string;
  roll_id: number;
  roll_code: string;
  length_mm: number;
  length_meters: number;
  product_id: number;
  product_code: string;
  product_name: string;
}

export interface AppSettings {
  shop_name: string;
  shop_address: string;
  shop_contact: string;
  print_mode?: string;
  date_format: string;
}

// ─── API Invoker ──────────────────────────────────────────────────────────────

async function invoke<T>(channel: string, ...args: unknown[]): Promise<ApiResponse<T>> {
  try {
    const result = await window.electronAPI.invoke(channel, ...args) as ApiResponse<T>;
    return result;
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export const api = {
  // Godowns
  godowns: {
    list: (includeInactive = false) =>
      invoke<Godown[]>('godowns:list', includeInactive),
    getById: (id: number) =>
      invoke<Godown>('godowns:getById', id),
    create: (data: { name: string; address?: string }) =>
      invoke<Godown>('godowns:create', data),
    update: (id: number, data: Partial<Pick<Godown, 'name' | 'address' | 'is_active'>>) =>
      invoke<Godown>('godowns:update', { id, ...data }),
  },

  // Products
  products: {
    list: (options?: boolean | { includeInactive?: boolean; godownId?: number }) => {
      const opts = typeof options === 'boolean' ? { includeInactive: options } : (options || {});
      return invoke<Product[]>('products:list', opts);
    },
    getById: (id: number, godownId?: number) =>
      invoke<Product>('products:getById', { id, godownId }),
    create: (data: { product_code: string; product_name: string; description?: string }) =>
      invoke<Product>('products:create', data),
    update: (id: number, data: Partial<Pick<Product, 'product_name' | 'description' | 'is_active'>>) =>
      invoke<Product>('products:update', { id, ...data }),
  },

  // Rolls
  rolls: {
    listByProduct: (params: {
      productId: number;
      godownId?: number;
      status?: 'all' | 'available' | 'fully_issued';
      exactLengthMeters?: number;
      minLengthMeters?: number;
      maxLengthMeters?: number;
    }) => invoke<Roll[]>('rolls:listByProduct', params),

    listAvailable: (params?: {
      productId?: number;
      godownId?: number;
      exactLengthMeters?: number;
      minLengthMeters?: number;
      maxLengthMeters?: number;
      rollCode?: string;
    }) => invoke<Roll[]>('rolls:listAvailable', params || {}),

    getById: (id: number) =>
      invoke<Roll>('rolls:getById', id),

    getByCode: (rollCode: string) =>
      invoke<Roll>('rolls:getByCode', rollCode),

    getHistory: (rollIdOrCode: number | string) =>
      invoke<RollHistoryData>('rolls:getHistory', rollIdOrCode),
  },

  // Inward
  inward: {
    create: (params: {
      godownId: number;
      productId: number;
      rollLengthsMeters: number[];
      referenceNote?: string;
      notes?: string;
      transactionDate?: string;
      ratePerMeter?: number;
      totalPrice?: number;
    }) => invoke<InwardTransaction>('inward:create', params),

    list: (filters?: {
      godownId?: number;
      productId?: number;
      slipNumber?: string;
      dateFrom?: string;
      dateTo?: string;
    }) => invoke<InwardTransaction[]>('inward:list', filters || {}),

    getById: (id: number) =>
      invoke<InwardTransaction>('inward:getById', id),

    // Mode A — Supplier Bill Summary
    createBill: (params: {
      godownId: number;
      billNumber?: string;
      billDate?: string;
      notes?: string;
      items: Array<{
        productId: number;
        supplierTotalMeters: number;
        supplierTotalRolls: number;
        notes?: string;
      }>;
    }) => invoke<SupplierBill>('inward:createBill', params),

    listBills: (filters?: {
      godownId?: number;
      billNumber?: string;
      verificationStatus?: string;
    }) => invoke<SupplierBill[]>('inward:listBills', filters || {}),

    getBillById: (id: number) =>
      invoke<SupplierBill>('inward:getBillById', id),

    // Mode B → Bill verification link
    verifyBillItem: (params: {
      billItemId: number;
      godownId: number;
      rollLengthsMeters: number[];
      notes?: string;
    }) => invoke<{
      transaction: InwardTransaction;
      billItemId: number;
      verifiedRolls: number;
      verifiedMeters: number;
      supplierRolls: number;
      supplierMeters: number;
      rollCountDiff: number;
      meterDiff: number;
      status: VerificationStatus;
    }>('inward:verifyBillItem', params),

    // Live stock summary for product+godown
    productStock: (productId: number, godownId: number) =>
      invoke<ProductStockSummary>('inward:productStock', { productId, godownId }),
  },

  // Outward
  outward: {
    create: (params: {
      rollId?: number;
      rollIds?: number[];
      godownId: number;
      recipientReference?: string;
      notes?: string;
      transactionDate?: string;
      ratePerMeter?: number;
      totalPrice?: number;
    }) => invoke<OutwardTransaction>('outward:create', params),
    list: (filters?: {
      godownId?: number;
      productId?: number;
      slipNumber?: string;
      dateFrom?: string;
      dateTo?: string;
    }) => invoke<OutwardTransaction[]>('outward:list', filters || {}),
    getById: (id: number) =>
      invoke<OutwardTransaction>('outward:getById', id),
  },

  // Stock
  stock: {
    dashboard: (godownId?: number | 'all') =>
      invoke<DashboardData>('stock:dashboard', { godownId }),
    summary: (godownId?: number) =>
      invoke<Product[]>('stock:summary', { godownId }),
    rollInventory: (filters?: {
      godownId?: number;
      productId?: number;
      status?: 'all' | 'available' | 'fully_issued';
      rollCode?: string;
      exactLengthMeters?: number;
      minLengthMeters?: number;
      maxLengthMeters?: number;
    }) => invoke<Roll[]>('stock:rollInventory', filters || {}),
    updateBatchRate: (params: { rollIds: number[]; ratePerMeter: number }) =>
      invoke<{ success: boolean }>('stock:updateBatchRate', params),
  },

  // History
  history: {
    list: (filters?: {
      godownId?: number;
      type?: 'all' | 'inward' | 'outward';
      productId?: number;
      rollCode?: string;
      slipNumber?: string;
      dateFrom?: string;
      dateTo?: string;
    }) => invoke<HistoryRow[]>('history:list', filters || {}),
    getBySlip: (params: { type: 'inward' | 'outward'; slipNumber: string }) =>
      invoke<InwardTransaction | OutwardTransaction>('history:getBySlip', params),
  },

  // Settings
  settings: {
    get: () => invoke<AppSettings>('settings:get'),
    set: (updates: Partial<AppSettings>) =>
      invoke<AppSettings>('settings:set', updates),
    factoryReset: (options?: { clearProducts?: boolean; resetGodowns?: boolean; resetSettings?: boolean }) =>
      invoke<{ message: string; safetyBackupPath?: string }>('settings:factoryReset', options || {}),
  },

  // Backup
  backup: {
    create: () => invoke<{ filePath: string; sizeBytes: number }>('backup:create'),
    restore: () => invoke<{ message: string; safetyBackupPath: string }>('backup:restore'),
  },

  // Print
  print: {
    inwardSlip: (transactionId: number) =>
      invoke<void>('print:inwardSlip', transactionId),
    outwardSlip: (transactionId: number) =>
      invoke<void>('print:outwardSlip', transactionId),
  },
};
