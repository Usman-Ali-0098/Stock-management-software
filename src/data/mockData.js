// Initial Mock Data for Shalmi Rexine Trader POS

export const INITIAL_CATEGORIES = [
  { id: 'all', name: 'All Materials', nameUrdu: 'تمام مال', count: 12 },
  { id: 'sofa', name: 'Sofa Rexine', nameUrdu: 'صوفہ ریگزین', count: 4 },
  { id: 'auto', name: 'Auto & Bike Rexine', nameUrdu: 'گاڑی اور بائیک ریگزین', count: 3 },
  { id: 'car', name: 'Car Dashboard Leatherette', nameUrdu: 'ڈیش بورڈ لیدر', count: 2 },
  { id: 'pvc', name: 'PVC Clear Sheet', nameUrdu: 'پی وی سی شیٹ', count: 2 },
  { id: 'lining', name: 'Foam & Lining Fabric', nameUrdu: 'فوم استر کپڑا', count: 2 },
];

export const INITIAL_PRODUCTS = [
  {
    id: 'REX-001',
    name: 'Sofa Rexine Texture 0.9mm',
    nameUrdu: 'صوفہ ریگزین ٹیکسچر 0.9 ملی',
    category: 'sofa',
    color: 'Dark Brown',
    colorHex: '#4A2C11',
    pattern: 'Leather Grain #402',
    thickness: '0.9 mm',
    rollLengthMeters: 50, // Standard Thaan length
    rollsInStock: 18,     // Thaan
    looseMetersInStock: 24, // Loose cut meters
    purchaseRateRoll: 14500, // PKR per roll
    wholesaleRateRoll: 18200, // PKR per roll (Thaan)
    wholesaleRateMeter: 410,  // PKR per meter / guz
    minAlertRolls: 5,
    sku: 'SOFA-BRN-09'
  },
  {
    id: 'REX-002',
    name: 'Sofa Rexine Texture 0.9mm',
    nameUrdu: 'صوفہ ریگزین ٹیکسچر 0.9 ملی',
    category: 'sofa',
    color: 'Jet Black',
    colorHex: '#18181B',
    pattern: 'Matte Pebble Grain',
    thickness: '0.9 mm',
    rollLengthMeters: 50,
    rollsInStock: 26,
    looseMetersInStock: 38,
    purchaseRateRoll: 14500,
    wholesaleRateRoll: 18200,
    wholesaleRateMeter: 410,
    minAlertRolls: 6,
    sku: 'SOFA-BLK-09'
  },
  {
    id: 'REX-003',
    name: 'Sofa Rexine Texture 0.9mm',
    nameUrdu: 'صوفہ ریگزین ٹیکسچر 0.9 ملی',
    category: 'sofa',
    color: 'Cream Beige',
    colorHex: '#D4C3A3',
    pattern: 'Royal Chesterfield Texture',
    thickness: '0.9 mm',
    rollLengthMeters: 50,
    rollsInStock: 3, // LOW STOCK ALERT
    looseMetersInStock: 12,
    purchaseRateRoll: 14800,
    wholesaleRateRoll: 18500,
    wholesaleRateMeter: 420,
    minAlertRolls: 5,
    sku: 'SOFA-BGE-09'
  },
  {
    id: 'REX-004',
    name: 'Diamond Rexine Heavy 1.0mm',
    nameUrdu: 'ڈائمنڈ ریگزین ہیوی 1.0 ملی',
    category: 'sofa',
    color: 'Tan Camel',
    colorHex: '#B27038',
    pattern: 'Heavy Embossed Diamond',
    thickness: '1.0 mm',
    rollLengthMeters: 45,
    rollsInStock: 14,
    looseMetersInStock: 19,
    purchaseRateRoll: 16000,
    wholesaleRateRoll: 20500,
    wholesaleRateMeter: 510,
    minAlertRolls: 4,
    sku: 'DIA-TAN-10'
  },
  {
    id: 'REX-005',
    name: 'Motorbike Seat Cover Rexine',
    nameUrdu: 'موٹر بائیک سیٹ ریگزین ہیوی',
    category: 'auto',
    color: 'Grip Black Diamond',
    colorHex: '#27272A',
    pattern: 'Anti-Slip Honda/Yamaha Grade',
    thickness: '1.1 mm (Heavy Duty)',
    rollLengthMeters: 50,
    rollsInStock: 32,
    looseMetersInStock: 45,
    purchaseRateRoll: 12500,
    wholesaleRateRoll: 15800,
    wholesaleRateMeter: 350,
    minAlertRolls: 8,
    sku: 'BIKE-BLK-11'
  },
  {
    id: 'REX-006',
    name: 'Motorbike Seat Rexine Dual-Tone',
    nameUrdu: 'موٹر بائیک سیٹ ریگزین ریڈ-بلیک',
    category: 'auto',
    color: 'Racing Red & Carbon',
    colorHex: '#991B1B',
    pattern: 'Carbon Fibre Textured',
    thickness: '1.0 mm',
    rollLengthMeters: 50,
    rollsInStock: 4, // LOW STOCK
    looseMetersInStock: 8,
    purchaseRateRoll: 13200,
    wholesaleRateRoll: 16900,
    wholesaleRateMeter: 380,
    minAlertRolls: 5,
    sku: 'BIKE-RED-10'
  },
  {
    id: 'REX-007',
    name: 'Auto Rexine Heavy 1.2mm',
    nameUrdu: 'آٹو رکشہ اور وین ریگزین',
    category: 'auto',
    color: 'Dark Maroon',
    colorHex: '#581C28',
    pattern: 'High Durability Ribbed',
    thickness: '1.2 mm',
    rollLengthMeters: 40,
    rollsInStock: 11,
    looseMetersInStock: 15,
    purchaseRateRoll: 15200,
    wholesaleRateRoll: 19400,
    wholesaleRateMeter: 540,
    minAlertRolls: 4,
    sku: 'AUTO-MRN-12'
  },
  {
    id: 'REX-008',
    name: 'Car Dashboard Leatherette',
    nameUrdu: 'کار ڈیش بورڈ پریمیم لیدر',
    category: 'car',
    color: 'Ultra Matte Black',
    colorHex: '#09090B',
    pattern: 'Soft Touch German Grain',
    thickness: '0.85 mm',
    rollLengthMeters: 30,
    rollsInStock: 9,
    looseMetersInStock: 16,
    purchaseRateRoll: 17500,
    wholesaleRateRoll: 22800,
    wholesaleRateMeter: 820,
    minAlertRolls: 3,
    sku: 'CAR-MBLK-08'
  },
  {
    id: 'REX-009',
    name: 'Car Dashboard Leatherette',
    nameUrdu: 'کار ڈیش بورڈ پریمیم لیدر',
    category: 'car',
    color: 'Toyota Beige/Sand',
    colorHex: '#C5B59E',
    pattern: 'UV Treated Anti-Crack',
    thickness: '0.85 mm',
    rollLengthMeters: 30,
    rollsInStock: 7,
    looseMetersInStock: 5,
    purchaseRateRoll: 17500,
    wholesaleRateRoll: 22800,
    wholesaleRateMeter: 820,
    minAlertRolls: 3,
    sku: 'CAR-BGE-08'
  },
  {
    id: 'REX-010',
    name: 'Transparent PVC Sheet Roll',
    nameUrdu: 'شفاف پی وی سی شیٹ رول',
    category: 'pvc',
    color: 'Super Clear Transparent',
    colorHex: '#93C5FD',
    pattern: 'Glass Clear Table Cover Grade',
    thickness: '0.50 mm',
    rollLengthMeters: 30,
    rollsInStock: 22,
    looseMetersInStock: 14,
    purchaseRateRoll: 8900,
    wholesaleRateRoll: 11500,
    wholesaleRateMeter: 420,
    minAlertRolls: 6,
    sku: 'PVC-CLR-05'
  },
  {
    id: 'REX-011',
    name: 'Heavy PVC Curtain Sheet Roll',
    nameUrdu: 'موٹی پی وی سی پردہ شیٹ',
    category: 'pvc',
    color: 'Clear Tinted Blue',
    colorHex: '#60A5FA',
    pattern: 'Strip Curtain Industrial 1.5mm',
    thickness: '1.50 mm',
    rollLengthMeters: 25,
    rollsInStock: 2, // CRITICAL LOW STOCK
    looseMetersInStock: 7,
    purchaseRateRoll: 14000,
    wholesaleRateRoll: 18000,
    wholesaleRateMeter: 780,
    minAlertRolls: 4,
    sku: 'PVC-IND-15'
  },
  {
    id: 'REX-012',
    name: 'Foam Laminated Lining Fabric',
    nameUrdu: 'فوم لیمینیشن استر کپڑا 3 ملی',
    category: 'lining',
    color: 'Charcoal Grey',
    colorHex: '#374151',
    pattern: '3mm High Density Foam Backed',
    thickness: '3.0 mm Foam',
    rollLengthMeters: 50,
    rollsInStock: 16,
    looseMetersInStock: 30,
    purchaseRateRoll: 9800,
    wholesaleRateRoll: 12900,
    wholesaleRateMeter: 290,
    minAlertRolls: 5,
    sku: 'FOAM-3MM-GRY'
  }
];

export const INITIAL_CUSTOMERS = [
  {
    id: 'CUST-001',
    name: 'Gujranwala Sofa Maker',
    contactPerson: 'Haji Aslam Sb',
    phone: '0301-7654321',
    city: 'Gujranwala',
    address: 'Near Sialkot Bypass, Small Industrial Estate',
    marketReputation: 'A+ (Regular wholesale buyer)',
    balanceDue: 145000,
    creditLimit: 300000,
    history: [
      { id: 'TX-101', date: '2026-10-01', type: 'Invoice', ref: 'GP-4902', amount: 182000, status: 'Credit' },
      { id: 'TX-102', date: '2026-10-02', type: 'Payment', ref: 'Cash-Shalmi', amount: -37000, status: 'Received' }
    ]
  },
  {
    id: 'CUST-002',
    name: 'Lahore Auto Seats & Covers',
    contactPerson: 'Mian Tariq',
    phone: '0321-4455667',
    city: 'Lahore',
    address: 'Montgomery Road Auto Market, Shop #18',
    marketReputation: 'High Volume Buyer',
    balanceDue: 85000,
    creditLimit: 250000,
    history: [
      { id: 'TX-201', date: '2026-09-28', type: 'Invoice', ref: 'GP-4881', amount: 158000, status: 'Credit' },
      { id: 'TX-202', date: '2026-09-30', type: 'Payment', ref: 'Online HBL', amount: -73000, status: 'Received' }
    ]
  },
  {
    id: 'CUST-003',
    name: 'Faisalabad Luxury Furnishers',
    contactPerson: 'Sheikh Naeem',
    phone: '0300-8651234',
    city: 'Faisalabad',
    address: 'D-Ground Commercial Market, Factory Jhang Rd',
    marketReputation: 'Large Furniture Mill',
    balanceDue: 320000,
    creditLimit: 500000,
    history: [
      { id: 'TX-301', date: '2026-09-25', type: 'Invoice', ref: 'GP-4840', amount: 320000, status: 'Credit' }
    ]
  },
  {
    id: 'CUST-004',
    name: 'Multan Rexine & Foam Center',
    contactPerson: 'Malik Zafar Iqbal',
    phone: '0302-9988776',
    city: 'Multan',
    address: 'Chungi No. 9, Bosan Road Rexine Gali',
    marketReputation: 'Wholesale Stockist',
    balanceDue: 210000,
    creditLimit: 400000,
    history: [
      { id: 'TX-401', date: '2026-09-29', type: 'Invoice', ref: 'GP-4890', amount: 210000, status: 'Credit' }
    ]
  },
  {
    id: 'CUST-005',
    name: 'Rawalpindi Rexine Traders',
    contactPerson: 'Chaudhry Rashid',
    phone: '0333-5123890',
    city: 'Rawalpindi',
    address: 'Raja Bazar, Ganj Mandi Chowk',
    marketReputation: 'Zero Due (Cash Buyer)',
    balanceDue: 0,
    creditLimit: 200000,
    history: [
      { id: 'TX-501', date: '2026-09-20', type: 'Invoice', ref: 'GP-4811', amount: 95000, status: 'Credit' },
      { id: 'TX-502', date: '2026-09-21', type: 'Payment', ref: 'Cash-Counter', amount: -95000, status: 'Received' }
    ]
  },
  {
    id: 'CUST-006',
    name: 'Sialkot Sports & Leather Works',
    contactPerson: 'Mirza Kamran',
    phone: '0345-6677889',
    city: 'Sialkot',
    address: 'Defence Road, Near Paris Road',
    marketReputation: 'Regular Goods Maker',
    balanceDue: 68000,
    creditLimit: 200000,
    history: [
      { id: 'TX-601', date: '2026-10-01', type: 'Invoice', ref: 'GP-4905', amount: 68000, status: 'Credit' }
    ]
  }
];

export const INITIAL_RECENT_BILLS = [
  {
    id: 'GP-4910',
    gatePassNo: 'GP-4910',
    date: '2026-10-02 18:40',
    customerName: 'Lahore Auto Seats & Covers',
    city: 'Lahore',
    truckDriver: 'Rehri No. 14 / Muhammad Akram',
    biltyNo: 'Direct Hand-Cart',
    paymentMode: 'Cash', // 'Cash' | 'Credit' | 'Split'
    amountPaid: 63200,
    amountDue: 0,
    totalAmount: 63200,
    totalRolls: 4,
    totalMeters: 200,
    items: [
      {
        id: 'REX-005',
        name: 'Motorbike Seat Cover Rexine',
        color: 'Grip Black Diamond',
        unitType: 'roll',
        quantity: 4,
        rollLength: 50,
        rate: 15800,
        total: 63200
      }
    ]
  },
  {
    id: 'GP-4909',
    gatePassNo: 'GP-4909',
    date: '2026-10-02 16:15',
    customerName: 'Gujranwala Sofa Maker',
    city: 'Gujranwala',
    truckDriver: 'Mazda Loader LHR-7819 / Driver Rafiq',
    biltyNo: 'Bilal Goods Shalmi #9921',
    paymentMode: 'Credit',
    amountPaid: 0,
    amountDue: 72800,
    totalAmount: 72800,
    totalRolls: 4,
    totalMeters: 200,
    items: [
      {
        id: 'REX-001',
        name: 'Sofa Rexine Texture 0.9mm',
        color: 'Dark Brown',
        unitType: 'roll',
        quantity: 4,
        rollLength: 50,
        rate: 18200,
        total: 72800
      }
    ]
  },
  {
    id: 'GP-4908',
    gatePassNo: 'GP-4908',
    date: '2026-10-02 14:05',
    customerName: 'Walk-in Workshop Cash Buyer',
    city: 'Lahore (Shalmi Bazar)',
    truckDriver: 'By Hand Customer Pickup',
    biltyNo: 'N/A (Self Carry)',
    paymentMode: 'Cash',
    amountPaid: 10250,
    amountDue: 0,
    totalAmount: 10250,
    totalRolls: 0,
    totalMeters: 25,
    items: [
      {
        id: 'REX-002',
        name: 'Sofa Rexine Texture 0.9mm',
        color: 'Jet Black',
        unitType: 'meter',
        quantity: 25,
        rollLength: 0,
        rate: 410,
        total: 10250
      }
    ]
  }
];
