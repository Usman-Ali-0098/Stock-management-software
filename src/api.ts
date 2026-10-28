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
  bulk_rolls: number;
  bulk_meters: number;
  has_bulk: boolean;
}

// ─── Stock Variant (product + godown + roll size + price -> quantity) ────────

export interface Variant {
  id: number;
  product_id: number;
  product_code?: string;
  product_name?: string;
  godown_id: number;
  godown_name?: string;
  length_mm: number;
  length_meters: number;
  rate_per_meter: number;
  quantity: number;
  created_at: string;
  updated_at: string;
}

export interface StockMovement {
  id: number;
  variant_id: number;
  movement_type: 'inward' | 'outward';
  transaction_id: number;
  slip_number: string;
  quantity: number;
  rate_per_meter: number;
  event_timestamp: string;
  reference: string;
  notes: string;
  length_meters: number;
}

export interface VariantMovements {
  variant: Variant;
  movements: StockMovement[];
}

// ─── Bulk Lot (product + godown + price -> total meters + roll count, no fixed roll size) ──

export interface BulkLot {
  id: number;
  product_id: number;
  product_code?: string;
  product_name?: string;
  godown_id: number;
  godown_name?: string;
  total_length_mm: number;
  total_length_meters: number;
  rate_per_meter: number;
  quantity: number;
  created_at: string;
  updated_at: string;
}

export interface BulkStockMovement {
  id: number;
  bulk_lot_id: number;
  movement_type: 'inward' | 'outward';
  transaction_id: number;
  slip_number: string;
  quantity: number;
  length_mm: number;
  length_meters: number;
  rate_per_meter: number;
  event_timestamp: string;
  reference: string;
  notes: string;
}

export interface BulkLotMovements {
  lot: BulkLot;
  movements: BulkStockMovement[];
}

export type LowStockItem =
  | (Variant & { is_bulk: false })
  | (BulkLot & { is_bulk: true });

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
  rate_is_uniform?: boolean;
  created_at: string;
  roll_count?: number;
  total_received_meters?: number;
  lines?: InwardLine[];
}

export interface InwardLine {
  id: number;
  inward_transaction_id: number;
  variant_id?: number;
  bulk_lot_id?: number;
  is_bulk?: boolean;
  product_id: number;
  product_code: string;
  product_name: string;
  quantity: number;
  length_mm: number;
  length_meters: number;
  rate_per_meter: number;
  total_price: number;
}

export interface ProductStockSummary {
  verifiedRolls: number;
  verifiedMeters: number;
  rollBreakdown: Array<{ length_meters: number; count: number }>;
  bulkBreakdown?: Array<{ total_length_meters: number; count: number }>;
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
  lines?: OutwardLine[];
}

export interface OutwardLine {
  id: number;
  outward_transaction_id: number;
  variant_id?: number;
  bulk_lot_id?: number;
  is_bulk?: boolean;
  product_id: number;
  product_code: string;
  product_name: string;
  quantity: number;
  length_mm: number;
  length_meters: number;
  rate_per_meter: number;
  total_price: number;
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
}

export interface HistoryRow {
  type: 'inward' | 'outward';
  transaction_id: number;
  godown_id?: number;
  godown_name?: string;
  slip_number: string;
  transaction_date: string;
  reference: string;
  variant_id?: number;
  bulk_lot_id?: number;
  is_bulk?: boolean;
  quantity: number;
  length_mm: number;
  length_meters: number;
  rate_per_meter?: number;
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

  // Stock variants (product + godown + roll size + price -> quantity)
  variants: {
    listByProduct: (params: { productId: number; godownId?: number; includeZero?: boolean }) =>
      invoke<Variant[]>('variants:listByProduct', params),

    listAll: (params?: { godownId?: number; productId?: number; includeZero?: boolean }) =>
      invoke<Variant[]>('variants:listAll', params || {}),

    getById: (id: number) =>
      invoke<Variant>('variants:getById', id),

    updateRate: (params: { variantId: number; ratePerMeter: number }) =>
      invoke<Variant>('variants:updateRate', params),

    getMovements: (variantId: number) =>
      invoke<VariantMovements>('variants:getMovements', variantId),
  },

  // Bulk lots (product + godown + price -> total meters + roll count, no fixed roll size)
  bulk: {
    listByProduct: (params: { productId: number; godownId?: number; includeZero?: boolean }) =>
      invoke<BulkLot[]>('bulk:listByProduct', params),

    listAll: (params?: { godownId?: number; productId?: number; includeZero?: boolean }) =>
      invoke<BulkLot[]>('bulk:listAll', params || {}),

    getById: (id: number) =>
      invoke<BulkLot>('bulk:getById', id),

    updateRate: (params: { bulkLotId: number; ratePerMeter: number }) =>
      invoke<BulkLot>('bulk:updateRate', params),

    getMovements: (bulkLotId: number) =>
      invoke<BulkLotMovements>('bulk:getMovements', bulkLotId),
  },

  // Inward
  inward: {
    create: (params: {
      godownId: number;
      productId: number;
      batches: Array<{ lengthMeters: number; quantity: number; ratePerMeter: number }>;
      referenceNote?: string;
      notes?: string;
      transactionDate?: string;
    }) => invoke<InwardTransaction>('inward:create', params),

    createBulk: (params: {
      godownId: number;
      productId: number;
      totalMeters: number;
      quantity: number;
      ratePerMeter?: number;
      referenceNote?: string;
      notes?: string;
      transactionDate?: string;
    }) => invoke<InwardTransaction>('inward:createBulk', params),

    list: (filters?: {
      godownId?: number;
      productId?: number;
      slipNumber?: string;
      dateFrom?: string;
      dateTo?: string;
    }) => invoke<InwardTransaction[]>('inward:list', filters || {}),

    getById: (id: number) =>
      invoke<InwardTransaction>('inward:getById', id),

    // Live stock summary for product+godown
    productStock: (productId: number, godownId: number) =>
      invoke<ProductStockSummary>('inward:productStock', { productId, godownId }),
  },

  // Outward
  outward: {
    create: (params: {
      items: Array<
        { variantId: number; quantity: number; bulkLotId?: never; lengthMeters?: never }
        | { bulkLotId: number; quantity: number; lengthMeters: number; variantId?: never }
      >;
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
    lowStock: (threshold?: number, bulkThresholdMeters?: number) =>
      invoke<LowStockItem[]>('stock:lowStock', { threshold, bulkThresholdMeters }),
  },

  // History
  history: {
    list: (filters?: {
      godownId?: number;
      type?: 'all' | 'inward' | 'outward';
      productId?: number;
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
