/**
 * QA / Performance Seed
 *
 * Populates an isolated PostgreSQL database with production-grade, realistic SMB
 * data for QA, demos, and performance-testing purposes.
 *
 * Target volumes:
 *   ~120 organizations  |  ~1,500 users  |  ~600 locations  |  ~55,000 products
 *   ~60,000 customers   |  ~55,000 inventory levels          |  ~1.2M orders
 *
 * Run with:
 *   make qa-seed
 * or directly:
 *   cd backend && DATABASE_URL="postgres://..." npx tsx prisma/seed.demo.ts
 *
 * The script is idempotent: it exits early if ≥100 orgs are already present.
 * To reseed from scratch, remove the QA volume and rerun `make qa-migrate`
 * plus `make qa-seed`.
 */

import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaClient } from './generated/client';
import { PrismaPg } from '@prisma/adapter-pg';

// ─── Client setup ────────────────────────────────────────────────────────────

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// ─── Progress logger ─────────────────────────────────────────────────────────

const START_TIME = Date.now();
function log(msg: string): void {
  const elapsed = ((Date.now() - START_TIME) / 1000).toFixed(1);
  console.log(`[${elapsed}s] ${msg}`);
}

// ─── RNG (Linear Congruential Generator — no external libraries) ──────────────

let _lcgSeed = Number(process.hrtime.bigint() % BigInt(2 ** 32));

function rng(): number {
  _lcgSeed = (_lcgSeed * 1664525 + 1013904223) & 0xffffffff;
  return (_lcgSeed >>> 0) / 0x100000000;
}

function rngInt(min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function rngPick<T>(arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function rngPickWeighted<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

function rngBool(probability = 0.5): boolean {
  return rng() < probability;
}

// ─── Static data pools ───────────────────────────────────────────────────────

const FIRST_NAMES = [
  'James',
  'Maria',
  'David',
  'Sophie',
  'Carlos',
  'Aisha',
  'Kevin',
  'Priya',
  'Thomas',
  'Elena',
  'Marcus',
  'Fatima',
  'Ryan',
  'Mei',
  'Jordan',
  'Amara',
  'Tyler',
  'Nadia',
  'Chris',
  'Isabel',
  'Daniel',
  'Yuki',
  'Alex',
  'Zara',
  'Michael',
  'Leila',
  'Sam',
  'Clara',
  'Patrick',
  'Sana',
  'Nathan',
  'Olivia',
  'Aaron',
  'Hana',
  'Ethan',
  'Maya',
  'Lucas',
  'Rina',
  'Eric',
  'Diane',
];

const LAST_NAMES = [
  'Smith',
  'Johnson',
  'Williams',
  'Brown',
  'Jones',
  'Garcia',
  'Miller',
  'Davis',
  'Martinez',
  'Lopez',
  'Wilson',
  'Anderson',
  'Taylor',
  'Thomas',
  'Hernandez',
  'Moore',
  'Jackson',
  'Martin',
  'Lee',
  'Perez',
  'Thompson',
  'White',
  'Harris',
  'Sanchez',
  'Clark',
  'Ramirez',
  'Lewis',
  'Robinson',
  'Walker',
  'Young',
  'Allen',
  'King',
  'Wright',
  'Scott',
  'Torres',
  'Nguyen',
  'Hill',
  'Flores',
  'Green',
  'Adams',
  'Nelson',
  'Baker',
  'Hall',
  'Rivera',
];

const COMPANY_PREFIXES = [
  'North',
  'South',
  'East',
  'West',
  'Central',
  'Highland',
  'Valley',
  'Urban',
  'Metro',
  'Pacific',
  'Atlantic',
  'Coastal',
  'Summit',
  'Ridgeline',
  'Birchwood',
  'Mapleton',
  'Riverside',
  'Cedar',
  'Oakwood',
  'Lakeside',
  'Silver',
  'Golden',
  'Blue',
  'Red',
  'Green',
  'Black',
  'Bright',
  'Swift',
];

interface CityInfo {
  city: string;
  province: string;
  postalPrefix: string;
}

const CANADIAN_CITIES: CityInfo[] = [
  { city: 'Toronto', province: 'ON', postalPrefix: 'M5' },
  { city: 'Vancouver', province: 'BC', postalPrefix: 'V6' },
  { city: 'Montreal', province: 'QC', postalPrefix: 'H3' },
  { city: 'Calgary', province: 'AB', postalPrefix: 'T2' },
  { city: 'Ottawa', province: 'ON', postalPrefix: 'K1' },
  { city: 'Edmonton', province: 'AB', postalPrefix: 'T5' },
  { city: 'Winnipeg', province: 'MB', postalPrefix: 'R3' },
  { city: 'Quebec City', province: 'QC', postalPrefix: 'G1' },
  { city: 'Hamilton', province: 'ON', postalPrefix: 'L8' },
  { city: 'Kitchener', province: 'ON', postalPrefix: 'N2' },
  { city: 'London', province: 'ON', postalPrefix: 'N6' },
  { city: 'Victoria', province: 'BC', postalPrefix: 'V8' },
  { city: 'Halifax', province: 'NS', postalPrefix: 'B3' },
  { city: 'Saskatoon', province: 'SK', postalPrefix: 'S7' },
  { city: 'Regina', province: 'SK', postalPrefix: 'S4' },
];

const STREET_NAMES = [
  'Main St',
  'King St',
  'Queen St',
  'Yonge St',
  'Bloor St',
  'Dundas St W',
  'College St',
  'Robson St',
  'Granville St',
  'Ste-Catherine',
  'Peel Ave',
  'Bay St',
  'Spadina Ave',
  'Wellington St',
  'Portage Ave',
  'Jasper Ave',
  'Rideau St',
  'Bank St',
  'Barrington St',
  'Spring Garden Rd',
];

const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

function rngChar(): string {
  return ALPHA[Math.floor(rng() * ALPHA.length)];
}

function generatePostalCode(prefix: string): string {
  return `${prefix}${rngChar()}${rngInt(1, 9)} ${rngInt(1, 9)}${rngChar()}${rngInt(1, 9)}`;
}

function generateAddress(): {
  addressLine1: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  countryCode: string;
} {
  const loc = rngPick(CANADIAN_CITIES);
  return {
    addressLine1: `${rngInt(100, 9999)} ${rngPick(STREET_NAMES)}`,
    city: loc.city,
    stateProvince: loc.province,
    postalCode: generatePostalCode(loc.postalPrefix),
    countryCode: 'CA',
  };
}

// ─── Business type catalog ────────────────────────────────────────────────────

interface PriceBand {
  min: number;
  max: number;
}

interface BusinessType {
  code: string;
  orgNameSuffixes: string[];
  locationType: 'STORE' | 'WAREHOUSE' | 'POP_UP' | 'OTHER';
  categories: string[];
  productNamesByCategory: Record<string, string[]>;
  priceBands: Record<string, PriceBand>;
  productCount: { min: number; max: number };
  ordersPerLocationPerTier: {
    small: PriceBand;
    medium: PriceBand;
    large: PriceBand;
  };
}

const BUSINESS_TYPES: BusinessType[] = [
  {
    code: 'APP',
    orgNameSuffixes: ['Apparel', 'Clothing Co.', 'Fashion', 'Wear', 'Boutique'],
    locationType: 'STORE',
    categories: ['Tops', 'Bottoms', 'Outerwear', 'Footwear', 'Accessories'],
    productNamesByCategory: {
      Tops: [
        'Classic Tee',
        'Slim Fit Shirt',
        'Linen Button-Down',
        'Graphic Tee',
        'Tank Top',
        'Henley',
        'Polo Shirt',
        'Cropped Top',
        'V-Neck Tee',
        'Muscle Tee',
        'Oxford Shirt',
        'Flannel Shirt',
      ],
      Bottoms: [
        'Slim Chino',
        'Relaxed Denim',
        'Cargo Pants',
        'Jogger Pant',
        'Tailored Trouser',
        'Linen Short',
        'Athletic Short',
        'Mini Skirt',
        'Midi Skirt',
        'Straight Leg Jean',
      ],
      Outerwear: [
        'Puffer Jacket',
        'Trench Coat',
        'Fleece Hoodie',
        'Bomber Jacket',
        'Rain Shell',
        'Wool Overcoat',
        'Denim Jacket',
        'Windbreaker',
        'Quilted Vest',
        'Shearling Coat',
      ],
      Footwear: [
        'Canvas Sneaker',
        'Leather Derby',
        'Running Shoe',
        'Chelsea Boot',
        'Sandal',
        'Loafer',
        'High-Top Sneaker',
        'Ankle Boot',
        'Mule',
        'Platform Sneaker',
      ],
      Accessories: [
        'Leather Belt',
        'Knit Beanie',
        'Baseball Cap',
        'Canvas Tote',
        'Wool Scarf',
        'Sunglasses',
        'Canvas Backpack',
        'Leather Wallet',
        'Hair Clip Set',
        'Socks 3-Pack',
      ],
    },
    priceBands: {
      Tops: { min: 1800, max: 8900 },
      Bottoms: { min: 2500, max: 12000 },
      Outerwear: { min: 6000, max: 28000 },
      Footwear: { min: 4500, max: 22000 },
      Accessories: { min: 800, max: 5500 },
    },
    productCount: { min: 200, max: 500 },
    ordersPerLocationPerTier: {
      small: { min: 1200, max: 2000 },
      medium: { min: 2000, max: 3500 },
      large: { min: 3500, max: 5000 },
    },
  },
  {
    code: 'CAF',
    orgNameSuffixes: ['Coffee', 'Café', 'Roasters', 'Brew Bar', 'Coffee Co.'],
    locationType: 'STORE',
    categories: [
      'Espresso Drinks',
      'Brewed Coffee',
      'Cold Drinks',
      'Food',
      'Retail Beans',
      'Merchandise',
    ],
    productNamesByCategory: {
      'Espresso Drinks': [
        'Espresso',
        'Americano',
        'Cappuccino',
        'Flat White',
        'Latte',
        'Macchiato',
        'Cortado',
        'Oat Latte',
        'Matcha Latte',
      ],
      'Brewed Coffee': [
        'House Drip',
        'Pour Over',
        'French Press',
        'Cold Brew',
        'Nitro Cold Brew',
      ],
      'Cold Drinks': [
        'Iced Latte',
        'Iced Matcha',
        'Sparkling Water',
        'Fresh Juice',
        'Iced Tea',
      ],
      Food: [
        'Croissant',
        'Almond Croissant',
        'Blueberry Muffin',
        'Banana Bread',
        'Avocado Toast',
        'Grain Bowl',
        'Cookie',
        'Granola Bar',
      ],
      'Retail Beans': [
        'House Blend 250g',
        'Single Origin Ethiopia 250g',
        'Single Origin Colombia 250g',
        'Dark Roast 250g',
        'Decaf 250g',
      ],
      Merchandise: [
        'Travel Mug 16oz',
        'Ceramic Mug',
        'Tote Bag',
        'Branded T-Shirt',
        'Reusable Cup',
      ],
    },
    priceBands: {
      'Espresso Drinks': { min: 375, max: 750 },
      'Brewed Coffee': { min: 300, max: 600 },
      'Cold Drinks': { min: 450, max: 850 },
      Food: { min: 350, max: 1600 },
      'Retail Beans': { min: 1800, max: 2800 },
      Merchandise: { min: 1200, max: 4500 },
    },
    productCount: { min: 80, max: 160 },
    ordersPerLocationPerTier: {
      small: { min: 2500, max: 4000 },
      medium: { min: 4000, max: 6000 },
      large: { min: 6000, max: 9000 },
    },
  },
  {
    code: 'BKS',
    orgNameSuffixes: ['Books', 'Bookshop', 'Reading Room', 'Pages', 'Book Co.'],
    locationType: 'STORE',
    categories: [
      'Fiction',
      'Non-Fiction',
      'Children',
      'Science',
      'History',
      'Self-Help',
      'Stationery',
    ],
    productNamesByCategory: {
      Fiction: [
        'The Last Light',
        'Borrowed Time',
        'Quiet Roads',
        'Salt and Shadow',
        'The Hollow Hours',
        'After the Rain',
        'Glass Mountains',
        'A Thousand Doors',
        'Wild Hours',
        'The River Dark',
      ],
      'Non-Fiction': [
        'The Mind Reset',
        'Future Work',
        'Atlas of Ideas',
        'Slow Down',
        'The Art of Noticing',
        'Deep Focus',
        'On Writing Well',
        'The Body Keeps Score',
      ],
      Children: [
        'The Dragon Who Counted',
        'Stars Above the Lake',
        'Felix and the Fog',
        'Good Morning Moon',
        'The Clever Fox',
        'Adventures Underground',
        'Biscuit the Dog',
      ],
      Science: [
        'The Elegant Universe',
        'A Short History of Nearly Everything',
        'The Code Book',
        'How Minds Work',
        'The Gene',
        'Six Easy Pieces',
      ],
      History: [
        'The Fall of Empires',
        'Silk Road',
        'The Age of Revolution',
        'Pacific',
        'The Ottoman Empire',
        'Northern Lights',
      ],
      'Self-Help': [
        'Atomic Habits',
        'The Power of Now',
        'Mindset',
        'Deep Work',
        'The Subtle Art',
        'Range',
        'Essentialism',
      ],
      Stationery: [
        'Hardcover Notebook A5',
        'Softcover Notebook A5',
        'Bullet Journal',
        'Fountain Pen Set',
        'Washi Tape Set',
        'Sticky Notes Pack',
        'Pencil Set',
      ],
    },
    priceBands: {
      Fiction: { min: 1800, max: 3500 },
      'Non-Fiction': { min: 2200, max: 4000 },
      Children: { min: 1200, max: 2800 },
      Science: { min: 2000, max: 4500 },
      History: { min: 1800, max: 3800 },
      'Self-Help': { min: 1800, max: 3200 },
      Stationery: { min: 600, max: 3500 },
    },
    productCount: { min: 300, max: 700 },
    ordersPerLocationPerTier: {
      small: { min: 800, max: 1500 },
      medium: { min: 1500, max: 2500 },
      large: { min: 2500, max: 4000 },
    },
  },
  {
    code: 'ELX',
    orgNameSuffixes: [
      'Tech',
      'Electronics',
      'Gadgets',
      'Tech Supply',
      'Digital',
    ],
    locationType: 'STORE',
    categories: [
      'Cables & Adapters',
      'Audio',
      'Phone Cases',
      'Chargers',
      'Keyboards & Mice',
      'Storage',
      'Webcams',
    ],
    productNamesByCategory: {
      'Cables & Adapters': [
        'USB-C to USB-A Cable 1m',
        'USB-C to USB-A Cable 2m',
        'HDMI 2.1 Cable 2m',
        'USB-C Hub 7-in-1',
        'Lightning Cable 1m',
        'DisplayPort Cable 1.8m',
        'Ethernet Adapter USB-C',
      ],
      Audio: [
        'Wired Earbuds',
        'Over-Ear Headphones',
        'Bluetooth Speaker Compact',
        'Bluetooth Speaker Large',
        'USB Microphone',
        'Studio Monitor Headphones',
      ],
      'Phone Cases': [
        'iPhone 15 Clear Case',
        'iPhone 15 Pro Wallet Case',
        'Samsung S24 Slim Case',
        'Pixel 8 Rugged Case',
        'Universal Folio Case',
      ],
      Chargers: [
        '65W USB-C Charger',
        '30W USB-C Charger',
        'MagSafe Charger',
        'Wireless Charging Pad 15W',
        '4-Port USB Charging Hub',
      ],
      'Keyboards & Mice': [
        'Wireless Keyboard',
        'Mechanical Keyboard Compact',
        'Ergonomic Mouse',
        'Wireless Mouse',
        'Mouse Pad XL',
      ],
      Storage: [
        'USB-A Flash Drive 64GB',
        'USB-A Flash Drive 128GB',
        'USB-C Flash Drive 128GB',
        'Portable SSD 500GB',
        'Portable SSD 1TB',
        'MicroSD Card 256GB',
      ],
      Webcams: [
        '1080p Webcam',
        '4K Webcam',
        'Ring Light 10in',
        'Webcam Privacy Cover 3-Pack',
      ],
    },
    priceBands: {
      'Cables & Adapters': { min: 1200, max: 5500 },
      Audio: { min: 2500, max: 19000 },
      'Phone Cases': { min: 1500, max: 5500 },
      Chargers: { min: 2000, max: 8500 },
      'Keyboards & Mice': { min: 2500, max: 15000 },
      Storage: { min: 1200, max: 14000 },
      Webcams: { min: 3500, max: 18000 },
    },
    productCount: { min: 120, max: 350 },
    ordersPerLocationPerTier: {
      small: { min: 900, max: 1600 },
      medium: { min: 1600, max: 2800 },
      large: { min: 2800, max: 4500 },
    },
  },
  {
    code: 'HLT',
    orgNameSuffixes: [
      'Beauty',
      'Wellness',
      'Skin Co.',
      'Apothecary',
      'Health Store',
    ],
    locationType: 'STORE',
    categories: [
      'Skincare',
      'Hair Care',
      'Body',
      'Cosmetics',
      'Supplements',
      'Fragrance',
    ],
    productNamesByCategory: {
      Skincare: [
        'Gentle Cleanser 150ml',
        'Hydrating Toner 200ml',
        'Vitamin C Serum 30ml',
        'Retinol Night Serum 30ml',
        'SPF 50 Daily Moisturizer 50ml',
        'Eye Cream 15ml',
        'Clay Mask 75ml',
        'Exfoliating Scrub 100ml',
      ],
      'Hair Care': [
        'Hydrating Shampoo 300ml',
        'Repair Conditioner 300ml',
        'Leave-In Conditioner 150ml',
        'Hair Oil 100ml',
        'Curl Cream 200ml',
        'Dry Shampoo 200ml',
        'Hair Mask 200ml',
      ],
      Body: [
        'Body Wash Citrus 350ml',
        'Body Lotion Unscented 400ml',
        'Body Scrub 300g',
        'Deodorant Roll-On 50ml',
        'Hand Cream 75ml',
        'Foot Cream 100ml',
      ],
      Cosmetics: [
        'Foundation SPF 15',
        'Concealer',
        'Mascara Lengthening',
        'Eyeshadow Palette Neutrals',
        'Lipstick Satin',
        'Tinted Lip Balm',
        'Setting Powder',
        'Blush',
      ],
      Supplements: [
        'Vitamin D3 60 caps',
        'Magnesium 90 caps',
        'Omega-3 60 softgels',
        'Probiotics 30 caps',
        'Collagen Powder 300g',
        'Ashwagandha 60 caps',
      ],
      Fragrance: [
        'Eau de Parfum 50ml',
        'Eau de Parfum 100ml',
        'Eau de Toilette 50ml',
        'Reed Diffuser 100ml',
        'Scented Candle 250g',
      ],
    },
    priceBands: {
      Skincare: { min: 1800, max: 9500 },
      'Hair Care': { min: 1200, max: 5500 },
      Body: { min: 900, max: 4000 },
      Cosmetics: { min: 1200, max: 8500 },
      Supplements: { min: 2000, max: 7500 },
      Fragrance: { min: 2500, max: 18000 },
    },
    productCount: { min: 200, max: 450 },
    ordersPerLocationPerTier: {
      small: { min: 1200, max: 2000 },
      medium: { min: 2000, max: 3500 },
      large: { min: 3500, max: 5500 },
    },
  },
  {
    code: 'SPT',
    orgNameSuffixes: [
      'Sports',
      'Athletics',
      'Outdoor Co.',
      'Sport Supply',
      'Active',
    ],
    locationType: 'STORE',
    categories: [
      'Footwear',
      'Apparel',
      'Equipment',
      'Nutrition',
      'Recovery',
      'Bags',
    ],
    productNamesByCategory: {
      Footwear: [
        'Trail Runner',
        'Road Runner',
        'Cross-Trainer',
        'Basketball Shoe',
        'Hiking Boot',
        'Water Shoe',
        'Cleats Soccer',
        'Slip-On Active',
      ],
      Apparel: [
        'Compression Tee',
        'Performance Tank',
        'Running Short',
        'Legging Full-Length',
        '1/4 Zip Pullover',
        'Training Hoodie',
        'Sports Bra Medium Support',
      ],
      Equipment: [
        'Resistance Bands Set',
        'Jump Rope',
        'Foam Roller',
        'Kettlebell 8kg',
        'Kettlebell 16kg',
        'Yoga Mat',
        'Pull-Up Bar',
        'Ab Wheel',
      ],
      Nutrition: [
        'Whey Protein Chocolate 1kg',
        'Whey Protein Vanilla 1kg',
        'Plant Protein 700g',
        'BCAA Powder 300g',
        'Pre-Workout 300g',
        'Electrolyte Tablets 20-pack',
      ],
      Recovery: [
        'Ice Pack Large',
        'Compression Sleeve Knee',
        'Massage Gun',
        'Epsom Salt 1kg',
        'KT Tape Roll',
      ],
      Bags: [
        'Drawstring Bag',
        'Gym Duffel 40L',
        'Running Belt',
        'Hydration Vest 10L',
        'Cycling Backpack 20L',
      ],
    },
    priceBands: {
      Footwear: { min: 5500, max: 22000 },
      Apparel: { min: 2500, max: 9500 },
      Equipment: { min: 1500, max: 18000 },
      Nutrition: { min: 2500, max: 8500 },
      Recovery: { min: 1200, max: 22000 },
      Bags: { min: 1500, max: 12000 },
    },
    productCount: { min: 150, max: 400 },
    ordersPerLocationPerTier: {
      small: { min: 1000, max: 1800 },
      medium: { min: 1800, max: 3200 },
      large: { min: 3200, max: 5000 },
    },
  },
  {
    code: 'HOM',
    orgNameSuffixes: ['Home', 'Living', 'Interiors', 'Home Co.', 'Décor'],
    locationType: 'STORE',
    categories: ['Kitchen', 'Bedding', 'Storage', 'Lighting', 'Décor', 'Bath'],
    productNamesByCategory: {
      Kitchen: [
        'Chef Knife 20cm',
        'Cutting Board Bamboo',
        'Cast Iron Skillet 26cm',
        'Ceramic Mixing Bowl Set',
        'Coffee Pour-Over Kit',
        'French Press 600ml',
        'Beeswax Wraps 3-Pack',
        'Glass Food Container Set',
      ],
      Bedding: [
        'Cotton Duvet Cover Queen',
        'Cotton Pillow Case Set',
        'Linen Flat Sheet Queen',
        'Down Pillow Medium',
        'Weighted Blanket 7kg',
        'Mattress Protector Queen',
      ],
      Storage: [
        'Bamboo Shelf 3-Tier',
        'Cotton Basket Small',
        'Cotton Basket Large',
        'Glass Jar Set 4-Pack',
        'Over-Door Organizer',
        'Shoe Rack 3-Tier',
      ],
      Lighting: [
        'Pendant Light White',
        'Table Lamp Ceramic',
        'LED Strip 5m',
        'Clip-On Reading Light',
        'Candle Holder Set',
        'String Lights 10m',
      ],
      Décor: [
        'Terracotta Planter 15cm',
        'Terracotta Planter 25cm',
        'Macramé Wall Hanging',
        'Abstract Print 30x40cm',
        'Wooden Tray Large',
        'Bud Vase Set',
      ],
      Bath: [
        'Organic Cotton Towel Set',
        'Bamboo Bath Mat',
        'Shower Curtain Linen',
        'Soap Dish Marble',
        'Toothbrush Holder',
        'Body Loofah',
      ],
    },
    priceBands: {
      Kitchen: { min: 1200, max: 18000 },
      Bedding: { min: 2500, max: 18000 },
      Storage: { min: 1500, max: 12000 },
      Lighting: { min: 1800, max: 15000 },
      Décor: { min: 800, max: 9000 },
      Bath: { min: 1200, max: 8500 },
    },
    productCount: { min: 180, max: 500 },
    ordersPerLocationPerTier: {
      small: { min: 800, max: 1500 },
      medium: { min: 1500, max: 2800 },
      large: { min: 2800, max: 4500 },
    },
  },
  {
    code: 'PET',
    orgNameSuffixes: [
      'Pet Co.',
      'Pet Supply',
      'Paws',
      'Animal Care',
      'Pet Shop',
    ],
    locationType: 'STORE',
    categories: [
      'Dog Food',
      'Cat Food',
      'Toys',
      'Grooming',
      'Health',
      'Accessories',
    ],
    productNamesByCategory: {
      'Dog Food': [
        'Adult Dry Kibble Chicken 5kg',
        'Adult Dry Kibble Lamb 5kg',
        'Puppy Dry Kibble 3kg',
        'Wet Food Beef 400g',
        'Grain-Free Salmon 2kg',
        'Senior Formula 5kg',
      ],
      'Cat Food': [
        'Indoor Cat Dry 2kg',
        'Kitten Dry 1.5kg',
        'Tuna Wet Food 85g',
        'Chicken Pâté 85g',
        'Grain-Free Rabbit 2kg',
        'Sensitive Digestion 1.5kg',
      ],
      Toys: [
        'Rope Toy Large',
        'Tennis Ball 3-Pack',
        'Squeaky Plush Duck',
        'Interactive Puzzle Feeder',
        'Laser Pointer',
        'Feather Wand',
        'Crinkle Ball Set',
      ],
      Grooming: [
        'Slicker Brush',
        'Deshedding Tool',
        'Dog Shampoo 500ml',
        'Cat Shampoo 300ml',
        'Nail Trimmer',
        'Ear Cleaning Wipes 50-Pack',
        'Dental Chews 20-Pack',
      ],
      Health: [
        'Flea & Tick Spot-On Small',
        'Flea & Tick Spot-On Large',
        'Joint Support Chews 60-Pack',
        'Probiotic Powder 100g',
        'Calming Treats 30-Pack',
      ],
      Accessories: [
        'Adjustable Collar Medium',
        'Adjustable Collar Large',
        'Retractable Leash 5m',
        'Standard Leash 1.5m',
        'Harness No-Pull Medium',
        'Cat Carrier Soft',
      ],
    },
    priceBands: {
      'Dog Food': { min: 1800, max: 9500 },
      'Cat Food': { min: 900, max: 5500 },
      Toys: { min: 500, max: 3500 },
      Grooming: { min: 800, max: 5500 },
      Health: { min: 1500, max: 7500 },
      Accessories: { min: 1200, max: 8500 },
    },
    productCount: { min: 150, max: 350 },
    ordersPerLocationPerTier: {
      small: { min: 1200, max: 2000 },
      medium: { min: 2000, max: 3500 },
      large: { min: 3500, max: 5500 },
    },
  },
  {
    code: 'GRO',
    orgNameSuffixes: ['Market', 'Grocery', 'Fresh Market', 'Foods', 'Co-op'],
    locationType: 'STORE',
    categories: [
      'Produce',
      'Bakery',
      'Dairy',
      'Snacks',
      'Beverages',
      'Pantry',
      'Frozen',
    ],
    productNamesByCategory: {
      Produce: [
        'Organic Apples 1kg',
        'Bananas 1kg',
        'Broccoli Head',
        'Spinach 200g',
        'Avocado Each',
        'Cherry Tomatoes 250g',
        'Carrot Bag 1kg',
        'Bell Pepper Each',
      ],
      Bakery: [
        'Sourdough Loaf',
        'Multigrain Loaf',
        'Croissant Each',
        'Cinnamon Bun',
        'Baguette',
        'Chocolate Brownie',
        'Blueberry Scone',
        'Focaccia',
      ],
      Dairy: [
        'Whole Milk 2L',
        '2% Milk 2L',
        'Greek Yogurt 500g',
        'Aged Cheddar 200g',
        'Mozzarella 200g',
        'Butter 454g',
        'Sour Cream 500ml',
        'Cream Cheese 250g',
      ],
      Snacks: [
        'Kettle Chips Sea Salt 200g',
        'Tortilla Chips 300g',
        'Mixed Nuts 200g',
        'Dark Chocolate 85g',
        'Granola Bar 6-Pack',
        'Rice Cakes 130g',
        'Trail Mix 250g',
      ],
      Beverages: [
        'Sparkling Water 6-Pack',
        'Orange Juice 1L',
        'Green Tea 20 bags',
        'Black Coffee Drip 250g',
        'Kombucha Ginger 473ml',
        'Oat Milk 1L',
        'Coconut Water 1L',
      ],
      Pantry: [
        'Pasta Penne 500g',
        'Jasmine Rice 2kg',
        'Olive Oil 500ml',
        'Canned Tomatoes 796ml',
        'Black Beans 540ml',
        'Honey 500g',
        'Maple Syrup 250ml',
      ],
      Frozen: [
        'Frozen Peas 750g',
        'Frozen Mixed Berries 600g',
        'Frozen Pizza Margherita',
        'Chicken Breast 1kg',
        'Edamame 500g',
        'Veggie Burger 4-Pack',
      ],
    },
    priceBands: {
      Produce: { min: 99, max: 899 },
      Bakery: { min: 199, max: 1400 },
      Dairy: { min: 199, max: 1400 },
      Snacks: { min: 299, max: 1400 },
      Beverages: { min: 199, max: 1800 },
      Pantry: { min: 199, max: 1800 },
      Frozen: { min: 299, max: 2500 },
    },
    productCount: { min: 400, max: 800 },
    ordersPerLocationPerTier: {
      small: { min: 2500, max: 4000 },
      medium: { min: 4000, max: 7000 },
      large: { min: 7000, max: 12000 },
    },
  },
];

// ─── Org tiers ────────────────────────────────────────────────────────────────

interface OrgTier {
  label: 'small' | 'medium' | 'large';
  locationMin: number;
  locationMax: number;
  userMin: number;
  userMax: number;
  customerMin: number;
  customerMax: number;
  weight: number;
}

const ORG_TIERS: OrgTier[] = [
  {
    label: 'small',
    locationMin: 2,
    locationMax: 4,
    userMin: 3,
    userMax: 6,
    customerMin: 200,
    customerMax: 500,
    weight: 70,
  },
  {
    label: 'medium',
    locationMin: 5,
    locationMax: 9,
    userMin: 7,
    userMax: 13,
    customerMin: 500,
    customerMax: 1000,
    weight: 25,
  },
  {
    label: 'large',
    locationMin: 10,
    locationMax: 15,
    userMin: 14,
    userMax: 20,
    customerMin: 1000,
    customerMax: 2000,
    weight: 5,
  },
];

const ORG_TIER_WEIGHTS = ORG_TIERS.map((t) => t.weight);

// ─── Bulk insert helper ───────────────────────────────────────────────────────
//
// PostgreSQL caps bind parameters at 65,535 per query.
// With batchSize=4000 and up to 13 columns → 52,000 params — safely under limit.

async function bulkInsert(
  table: string,
  columns: string[],
  castMap: Record<string, string>, // columnName → pg enum type name
  rows: unknown[][],
  conflictTarget: string,
  batchSize = 4000,
): Promise<number> {
  if (rows.length === 0) return 0;
  let inserted = 0;

  for (let offset = 0; offset < rows.length; offset += batchSize) {
    const batch = rows.slice(offset, offset + batchSize);
    const params: unknown[] = [];
    let pIdx = 1;

    const placeholders = batch.map((row) => {
      const slots = columns.map((col, ci) => {
        const enumType = castMap[col];
        const slot = enumType ? `$${pIdx}::"${enumType}"` : `$${pIdx}`;
        pIdx++;
        params.push(row[ci]);
        return slot;
      });
      return `(${slots.join(', ')})`;
    });

    const colList = columns.map((c) => `"${c}"`).join(', ');
    const sql = `INSERT INTO "${table}" (${colList})\nVALUES ${placeholders.join(',\n')}\nON CONFLICT ${conflictTarget} DO NOTHING`;

    await prisma.$executeRawUnsafe(sql, ...params);
    inserted += batch.length;
  }

  return inserted;
}

// ─── Timestamp helpers ────────────────────────────────────────────────────────

const TWO_YEARS_MS = 730 * 24 * 60 * 60 * 1000;
const NOW = Date.now();
const TWO_YEARS_AGO = NOW - TWO_YEARS_MS;

function randomOrderDate(): Date {
  // 30% of orders fall in Q4 (Oct-Dec) for seasonal bias
  if (rngBool(0.3)) {
    const year = rngBool(0.5)
      ? new Date(NOW).getFullYear() - 1
      : new Date(NOW).getFullYear();
    const month = rngInt(9, 11); // 0-indexed: Oct=9, Nov=10, Dec=11
    const day = rngInt(1, 28);
    const hour = rngInt(8, 21);
    return new Date(year, month, day, hour, rngInt(0, 59), rngInt(0, 59));
  }
  const ts = TWO_YEARS_AGO + rng() * TWO_YEARS_MS;
  const d = new Date(ts);
  d.setHours(rngInt(8, 21), rngInt(0, 59), rngInt(0, 59), 0);
  return d;
}

// ─── Order math helpers ───────────────────────────────────────────────────────

const ORDER_STATUSES = ['FULFILLED', 'PENDING', 'CONFIRMED', 'CANCELLED'];
const ORDER_STATUS_WEIGHTS = [68, 10, 15, 7];

const CONFIRMED_PAYMENT_SCENARIOS = [
  'UNPAID',
  'PENDING_CARD',
  'FAILED_CARD',
  'PAID_CARD',
  'PAID_CASH',
] as const;
const CONFIRMED_PAYMENT_SCENARIO_WEIGHTS = [35, 15, 15, 20, 15];

const FULFILLED_PAYMENT_SCENARIOS = [
  'PAID_CARD',
  'PAID_CASH',
  'REFUNDED',
  'REFUND_PENDING_CARD',
  'REFUND_FAILED_CARD',
] as const;
const FULFILLED_PAYMENT_SCENARIO_WEIGHTS = [55, 20, 10, 7, 8];

const CANCELLED_PAYMENT_SCENARIOS = [
  'PRE_CONFIRMATION',
  'UNPAID_AFTER_CONFIRMATION',
  'REFUNDED_AFTER_PAYMENT',
] as const;
const CANCELLED_PAYMENT_SCENARIO_WEIGHTS = [35, 40, 25];

const ITEMS_PER_ORDER_CHOICES = [1, 2, 3, 4, 5];
const ITEMS_PER_ORDER_WEIGHTS = [40, 30, 15, 10, 5];

const TAX_RATE = 0.13; // 13% HST
const CAD_CURRENCY_CODE = 'CAD';
const PAYMENT_FAILURE_MESSAGES = [
  'Card was declined by the issuer',
  'Authentication expired before payment completed',
  'Payment attempt was cancelled before completion',
];
const REFUND_FAILURE_MESSAGES = [
  'Stripe could not process the refund request',
  'Refund is temporarily unavailable for this payment',
  'Issuer rejected the refund request',
];

type SeedOrderStatus = (typeof ORDER_STATUSES)[number];
type SeedPaymentMethod = 'CARD' | 'CASH' | null;
type SeedPaymentStatus = 'UNPAID' | 'PENDING' | 'FAILED' | 'PAID';
type SeedRefundStatus = 'NONE' | 'REQUESTED' | 'PENDING' | 'FAILED' | 'REFUNDED';
type SeedPaymentAttemptStatus =
  | 'PENDING'
  | 'REQUIRES_ACTION'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELED';

interface SeedPaymentBundle {
  orderStatus: SeedOrderStatus;
  orderUpdatedAt: Date;
  placedAt: Date | null;
  cancelledAt: Date | null;
  paymentRow: unknown[] | null;
  paymentAttemptRows: unknown[][];
}

function addMinutes(date: Date, minMinutes: number, maxMinutes: number): Date {
  return new Date(
    date.getTime() + rngInt(minMinutes, maxMinutes) * 60 * 1000,
  );
}

function addHours(date: Date, minHours: number, maxHours: number): Date {
  return addMinutes(date, minHours * 60, maxHours * 60);
}

function randomStripeId(prefix: 'pi' | 're'): string {
  return `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 24)}`;
}

function randomStripeClientSecret(paymentIntentId: string): string {
  return `${paymentIntentId}_secret_${randomUUID().replace(/-/g, '').slice(0, 24)}`;
}

function createPaymentAttemptRow(args: {
  paymentId: string;
  amountCents: number;
  status: SeedPaymentAttemptStatus;
  createdAt: Date;
  updatedAt: Date;
  lastFailure?: string | null;
}) {
  const stripePaymentIntentId = randomStripeId('pi');

  return [
    randomUUID(),
    args.paymentId,
    stripePaymentIntentId,
    args.status,
    randomStripeClientSecret(stripePaymentIntentId),
    args.amountCents,
    CAD_CURRENCY_CODE,
    args.lastFailure ?? null,
    args.createdAt,
    args.updatedAt,
  ];
}

function createPaymentRow(args: {
  paymentId: string;
  organizationId: string;
  orderId: string;
  method: SeedPaymentMethod;
  paymentStatus: SeedPaymentStatus;
  refundStatus: SeedRefundStatus;
  amountCents: number;
  createdAt: Date;
  updatedAt: Date;
  stripeRefundId?: string | null;
  paidAt?: Date | null;
  refundRequestedAt?: Date | null;
  refundedAt?: Date | null;
  refundFailedAt?: Date | null;
  refundReason?: string | null;
  lastPaymentFailure?: string | null;
  lastRefundFailure?: string | null;
}) {
  return [
    args.paymentId,
    args.organizationId,
    args.orderId,
    args.method,
    args.paymentStatus,
    args.refundStatus,
    args.amountCents,
    CAD_CURRENCY_CODE,
    args.stripeRefundId ?? null,
    args.paidAt ?? null,
    args.refundRequestedAt ?? null,
    args.refundedAt ?? null,
    args.refundFailedAt ?? null,
    args.refundReason ?? null,
    args.lastPaymentFailure ?? null,
    args.lastRefundFailure ?? null,
    args.createdAt,
    args.updatedAt,
  ];
}

function buildSeedPaymentBundle(args: {
  orderId: string;
  organizationId: string;
  totalCents: number;
  createdAt: Date;
  status: SeedOrderStatus;
}): SeedPaymentBundle {
  if (args.status === 'PENDING') {
    return {
      orderStatus: args.status,
      orderUpdatedAt: addHours(args.createdAt, 0, 4),
      placedAt: null,
      cancelledAt: null,
      paymentRow: null,
      paymentAttemptRows: [],
    };
  }

  if (args.status === 'CONFIRMED') {
    const placedAt = addMinutes(args.createdAt, 5, 24 * 60);
    const paymentId = randomUUID();
    const scenario = rngPickWeighted(
      [...CONFIRMED_PAYMENT_SCENARIOS],
      CONFIRMED_PAYMENT_SCENARIO_WEIGHTS,
    );

    if (scenario === 'UNPAID') {
      return {
        orderStatus: args.status,
        orderUpdatedAt: placedAt,
        placedAt,
        cancelledAt: null,
        paymentRow: createPaymentRow({
          paymentId,
          organizationId: args.organizationId,
          orderId: args.orderId,
          method: null,
          paymentStatus: 'UNPAID',
          refundStatus: 'NONE',
          amountCents: args.totalCents,
          createdAt: placedAt,
          updatedAt: placedAt,
        }),
        paymentAttemptRows: [],
      };
    }

    if (scenario === 'PENDING_CARD') {
      const attemptCreatedAt = addMinutes(placedAt, 1, 60);
      const attemptStatus = rngBool(0.25) ? 'REQUIRES_ACTION' : 'PENDING';

      return {
        orderStatus: args.status,
        orderUpdatedAt: placedAt,
        placedAt,
        cancelledAt: null,
        paymentRow: createPaymentRow({
          paymentId,
          organizationId: args.organizationId,
          orderId: args.orderId,
          method: 'CARD',
          paymentStatus: 'PENDING',
          refundStatus: 'NONE',
          amountCents: args.totalCents,
          createdAt: placedAt,
          updatedAt: attemptCreatedAt,
        }),
        paymentAttemptRows: [
          createPaymentAttemptRow({
            paymentId,
            amountCents: args.totalCents,
            status: attemptStatus,
            createdAt: attemptCreatedAt,
            updatedAt: attemptCreatedAt,
          }),
        ],
      };
    }

    if (scenario === 'FAILED_CARD') {
      const attemptCreatedAt = addMinutes(placedAt, 1, 45);
      const failure = rngPick(PAYMENT_FAILURE_MESSAGES);

      return {
        orderStatus: args.status,
        orderUpdatedAt: placedAt,
        placedAt,
        cancelledAt: null,
        paymentRow: createPaymentRow({
          paymentId,
          organizationId: args.organizationId,
          orderId: args.orderId,
          method: 'CARD',
          paymentStatus: 'FAILED',
          refundStatus: 'NONE',
          amountCents: args.totalCents,
          createdAt: placedAt,
          updatedAt: attemptCreatedAt,
          lastPaymentFailure: failure,
        }),
        paymentAttemptRows: [
          createPaymentAttemptRow({
            paymentId,
            amountCents: args.totalCents,
            status: 'FAILED',
            createdAt: attemptCreatedAt,
            updatedAt: attemptCreatedAt,
            lastFailure: failure,
          }),
        ],
      };
    }

    if (scenario === 'PAID_CARD') {
      const attemptCreatedAt = addMinutes(placedAt, 1, 45);
      const paidAt = addMinutes(attemptCreatedAt, 1, 30);

      return {
        orderStatus: args.status,
        orderUpdatedAt: placedAt,
        placedAt,
        cancelledAt: null,
        paymentRow: createPaymentRow({
          paymentId,
          organizationId: args.organizationId,
          orderId: args.orderId,
          method: 'CARD',
          paymentStatus: 'PAID',
          refundStatus: 'NONE',
          amountCents: args.totalCents,
          createdAt: placedAt,
          updatedAt: paidAt,
          paidAt,
        }),
        paymentAttemptRows: [
          createPaymentAttemptRow({
            paymentId,
            amountCents: args.totalCents,
            status: 'SUCCEEDED',
            createdAt: attemptCreatedAt,
            updatedAt: paidAt,
          }),
        ],
      };
    }

    const paidAt = addMinutes(placedAt, 1, 90);
    return {
      orderStatus: args.status,
      orderUpdatedAt: placedAt,
      placedAt,
      cancelledAt: null,
      paymentRow: createPaymentRow({
        paymentId,
        organizationId: args.organizationId,
        orderId: args.orderId,
        method: 'CASH',
        paymentStatus: 'PAID',
        refundStatus: 'NONE',
        amountCents: args.totalCents,
        createdAt: placedAt,
        updatedAt: paidAt,
        paidAt,
      }),
      paymentAttemptRows: [],
    };
  }

  if (args.status === 'FULFILLED') {
    const placedAt = addMinutes(args.createdAt, 5, 24 * 60);
    const paymentId = randomUUID();
    const scenario = rngPickWeighted(
      [...FULFILLED_PAYMENT_SCENARIOS],
      FULFILLED_PAYMENT_SCENARIO_WEIGHTS,
    );

    if (scenario === 'PAID_CARD') {
      const attemptCreatedAt = addMinutes(placedAt, 1, 45);
      const paidAt = addMinutes(attemptCreatedAt, 1, 30);
      const fulfilledAt = addMinutes(paidAt, 10, 48 * 60);

      return {
        orderStatus: args.status,
        orderUpdatedAt: fulfilledAt,
        placedAt,
        cancelledAt: null,
        paymentRow: createPaymentRow({
          paymentId,
          organizationId: args.organizationId,
          orderId: args.orderId,
          method: 'CARD',
          paymentStatus: 'PAID',
          refundStatus: 'NONE',
          amountCents: args.totalCents,
          createdAt: placedAt,
          updatedAt: paidAt,
          paidAt,
        }),
        paymentAttemptRows: [
          createPaymentAttemptRow({
            paymentId,
            amountCents: args.totalCents,
            status: 'SUCCEEDED',
            createdAt: attemptCreatedAt,
            updatedAt: paidAt,
          }),
        ],
      };
    }

    if (scenario === 'PAID_CASH') {
      const paidAt = addMinutes(placedAt, 1, 90);
      const fulfilledAt = addMinutes(paidAt, 10, 48 * 60);

      return {
        orderStatus: args.status,
        orderUpdatedAt: fulfilledAt,
        placedAt,
        cancelledAt: null,
        paymentRow: createPaymentRow({
          paymentId,
          organizationId: args.organizationId,
          orderId: args.orderId,
          method: 'CASH',
          paymentStatus: 'PAID',
          refundStatus: 'NONE',
          amountCents: args.totalCents,
          createdAt: placedAt,
          updatedAt: paidAt,
          paidAt,
        }),
        paymentAttemptRows: [],
      };
    }

    const refundReason = rngPick([
      'Customer returned the order',
      'Manager approved a full refund',
      'Inventory issue required reversal',
    ]);

    if (scenario === 'REFUNDED') {
      const method: SeedPaymentMethod = rngBool(0.3) ? 'CASH' : 'CARD';
      const paymentAttemptRows: unknown[][] = [];
      let paidAt: Date;

      if (method === 'CARD') {
        const attemptCreatedAt = addMinutes(placedAt, 1, 45);
        paidAt = addMinutes(attemptCreatedAt, 1, 30);
        paymentAttemptRows.push(
          createPaymentAttemptRow({
            paymentId,
            amountCents: args.totalCents,
            status: 'SUCCEEDED',
            createdAt: attemptCreatedAt,
            updatedAt: paidAt,
          }),
        );
      } else {
        paidAt = addMinutes(placedAt, 1, 90);
      }

      const fulfilledAt = addMinutes(paidAt, 10, 48 * 60);
      const refundRequestedAt = addHours(fulfilledAt, 1, 96);
      const refundedAt = addMinutes(refundRequestedAt, 5, 180);

      return {
        orderStatus: args.status,
        orderUpdatedAt: fulfilledAt,
        placedAt,
        cancelledAt: null,
        paymentRow: createPaymentRow({
          paymentId,
          organizationId: args.organizationId,
          orderId: args.orderId,
          method,
          paymentStatus: 'PAID',
          refundStatus: 'REFUNDED',
          amountCents: args.totalCents,
          createdAt: placedAt,
          updatedAt: refundedAt,
          stripeRefundId: method === 'CARD' ? randomStripeId('re') : null,
          paidAt,
          refundRequestedAt,
          refundedAt,
          refundReason,
        }),
        paymentAttemptRows,
      };
    }

    if (scenario === 'REFUND_PENDING_CARD') {
      const attemptCreatedAt = addMinutes(placedAt, 1, 45);
      const paidAt = addMinutes(attemptCreatedAt, 1, 30);
      const fulfilledAt = addMinutes(paidAt, 10, 48 * 60);
      const refundRequestedAt = addHours(fulfilledAt, 1, 72);

      return {
        orderStatus: args.status,
        orderUpdatedAt: fulfilledAt,
        placedAt,
        cancelledAt: null,
        paymentRow: createPaymentRow({
          paymentId,
          organizationId: args.organizationId,
          orderId: args.orderId,
          method: 'CARD',
          paymentStatus: 'PAID',
          refundStatus: 'PENDING',
          amountCents: args.totalCents,
          createdAt: placedAt,
          updatedAt: refundRequestedAt,
          stripeRefundId: randomStripeId('re'),
          paidAt,
          refundRequestedAt,
          refundReason,
        }),
        paymentAttemptRows: [
          createPaymentAttemptRow({
            paymentId,
            amountCents: args.totalCents,
            status: 'SUCCEEDED',
            createdAt: attemptCreatedAt,
            updatedAt: paidAt,
          }),
        ],
      };
    }

    const attemptCreatedAt = addMinutes(placedAt, 1, 45);
    const paidAt = addMinutes(attemptCreatedAt, 1, 30);
    const fulfilledAt = addMinutes(paidAt, 10, 48 * 60);
    const refundRequestedAt = addHours(fulfilledAt, 1, 72);
    const refundFailedAt = addMinutes(refundRequestedAt, 5, 180);
    const failure = rngPick(REFUND_FAILURE_MESSAGES);

    return {
      orderStatus: args.status,
      orderUpdatedAt: fulfilledAt,
      placedAt,
      cancelledAt: null,
      paymentRow: createPaymentRow({
        paymentId,
        organizationId: args.organizationId,
        orderId: args.orderId,
        method: 'CARD',
        paymentStatus: 'PAID',
        refundStatus: 'FAILED',
        amountCents: args.totalCents,
        createdAt: placedAt,
        updatedAt: refundFailedAt,
        paidAt,
        refundRequestedAt,
        refundFailedAt,
        refundReason,
        lastRefundFailure: failure,
      }),
      paymentAttemptRows: [
        createPaymentAttemptRow({
          paymentId,
          amountCents: args.totalCents,
          status: 'SUCCEEDED',
          createdAt: attemptCreatedAt,
          updatedAt: paidAt,
        }),
      ],
    };
  }

  const cancelledScenario = rngPickWeighted(
    [...CANCELLED_PAYMENT_SCENARIOS],
    CANCELLED_PAYMENT_SCENARIO_WEIGHTS,
  );

  if (cancelledScenario === 'PRE_CONFIRMATION') {
    const cancelledAt = addHours(args.createdAt, 1, 72);

    return {
      orderStatus: args.status,
      orderUpdatedAt: cancelledAt,
      placedAt: null,
      cancelledAt,
      paymentRow: null,
      paymentAttemptRows: [],
    };
  }

  if (cancelledScenario === 'UNPAID_AFTER_CONFIRMATION') {
    const placedAt = addMinutes(args.createdAt, 5, 24 * 60);
    const cancelledAt = addHours(placedAt, 1, 48);
    const paymentId = randomUUID();

    if (rngBool(0.3)) {
      const attemptCreatedAt = addMinutes(placedAt, 1, 45);
      const failure = 'Payment attempt was cancelled before completion';

      return {
        orderStatus: args.status,
        orderUpdatedAt: cancelledAt,
        placedAt,
        cancelledAt,
        paymentRow: createPaymentRow({
          paymentId,
          organizationId: args.organizationId,
          orderId: args.orderId,
          method: 'CARD',
          paymentStatus: 'FAILED',
          refundStatus: 'NONE',
          amountCents: args.totalCents,
          createdAt: placedAt,
          updatedAt: attemptCreatedAt,
          lastPaymentFailure: failure,
        }),
        paymentAttemptRows: [
          createPaymentAttemptRow({
            paymentId,
            amountCents: args.totalCents,
            status: 'CANCELED',
            createdAt: attemptCreatedAt,
            updatedAt: attemptCreatedAt,
            lastFailure: failure,
          }),
        ],
      };
    }

    return {
      orderStatus: args.status,
      orderUpdatedAt: cancelledAt,
      placedAt,
      cancelledAt,
      paymentRow: createPaymentRow({
        paymentId,
        organizationId: args.organizationId,
        orderId: args.orderId,
        method: null,
        paymentStatus: 'UNPAID',
        refundStatus: 'NONE',
        amountCents: args.totalCents,
        createdAt: placedAt,
        updatedAt: placedAt,
      }),
      paymentAttemptRows: [],
    };
  }

  const placedAt = addMinutes(args.createdAt, 5, 24 * 60);
  const paymentId = randomUUID();
  const method: SeedPaymentMethod = rngBool(0.35) ? 'CASH' : 'CARD';
  const paymentAttemptRows: unknown[][] = [];
  let paidAt: Date;

  if (method === 'CARD') {
    const attemptCreatedAt = addMinutes(placedAt, 1, 45);
    paidAt = addMinutes(attemptCreatedAt, 1, 30);
    paymentAttemptRows.push(
      createPaymentAttemptRow({
        paymentId,
        amountCents: args.totalCents,
        status: 'SUCCEEDED',
        createdAt: attemptCreatedAt,
        updatedAt: paidAt,
      }),
    );
  } else {
    paidAt = addMinutes(placedAt, 1, 90);
  }

  const refundRequestedAt = addHours(paidAt, 1, 48);
  const refundedAt = addMinutes(refundRequestedAt, 5, 180);
  const cancelledAt = addMinutes(refundedAt, 1, 30);

  return {
    orderStatus: args.status,
    orderUpdatedAt: cancelledAt,
    placedAt,
    cancelledAt,
    paymentRow: createPaymentRow({
      paymentId,
      organizationId: args.organizationId,
      orderId: args.orderId,
      method,
      paymentStatus: 'PAID',
      refundStatus: 'REFUNDED',
      amountCents: args.totalCents,
      createdAt: placedAt,
      updatedAt: refundedAt,
      stripeRefundId: method === 'CARD' ? randomStripeId('re') : null,
      paidAt,
      refundRequestedAt,
      refundedAt,
      refundReason: rngPick([
        'Customer cancelled after payment',
        'Order refunded before fulfillment',
        'Manager approved pre-fulfillment refund',
      ]),
    }),
    paymentAttemptRows,
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // Idempotency guard
  const existingOrgs = await prisma.organization.count();
  if (existingOrgs >= 100) {
    log(`QA DB already contains ${existingOrgs} organizations. Skipping seed.`);
    log(
      'Delete the QA database volume, then rerun `make qa-migrate` and `make qa-seed` to reseed from scratch.',
    );
    return;
  }

  log('Starting QA seed...');

  // Hash shared password once — reused for all demo users
  log('Hashing shared password...');
  const sharedPasswordHash = await bcrypt.hash('DemoPass123!', 10);

  const now = new Date();

  // ── Phase 1: Organizations ────────────────────────────────────────────────

  log('Phase 1: Generating organizations...');

  const NUM_ORGS = 120;

  interface OrgMeta {
    id: string;
    tier: OrgTier;
    bizType: BusinessType;
    locationCount: number;
    userCount: number;
    customerCount: number;
    slug: string;
  }

  const orgRows: unknown[][] = [];
  const orgMetas: OrgMeta[] = [];

  for (let i = 0; i < NUM_ORGS; i++) {
    const tier = rngPickWeighted(ORG_TIERS, ORG_TIER_WEIGHTS);
    const bizType = rngPick(BUSINESS_TYPES);
    const prefix = rngPick(COMPANY_PREFIXES);
    const suffix = rngPick(bizType.orgNameSuffixes);
    const name = `${prefix} ${suffix}`;
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-');
    const id = randomUUID();

    orgRows.push([id, name, now, now]);
    orgMetas.push({
      id,
      tier,
      bizType,
      locationCount: rngInt(tier.locationMin, tier.locationMax),
      userCount: rngInt(tier.userMin, tier.userMax),
      customerCount: rngInt(tier.customerMin, tier.customerMax),
      slug,
    });
  }

  await bulkInsert(
    'Organization',
    ['id', 'name', 'createdAt', 'updatedAt'],
    {},
    orgRows,
    '("id")',
  );
  log(`  Created ${NUM_ORGS} organizations`);

  // ── Phase 2: Users ────────────────────────────────────────────────────────

  log('Phase 2: Generating users...');

  interface UserMeta {
    id: string;
    email: string;
  }

  // Pre-allocate user slots per org
  const orgUserMetas: Map<string, UserMeta[]> = new Map();
  const allUserRows: unknown[][] = [];
  const usedEmails = new Set<string>();

  for (const org of orgMetas) {
    const users: UserMeta[] = [];
    for (let u = 0; u < org.userCount; u++) {
      let email: string;
      let attempts = 0;
      do {
        const fn = rngPick(FIRST_NAMES).toLowerCase();
        const ln = rngPick(LAST_NAMES).toLowerCase();
        const n = rngInt(1, 999);
        email = `${fn}.${ln}${n}@${org.slug}.demo`;
        attempts++;
        if (attempts > 20)
          email = `user-${randomUUID().slice(0, 8)}@${org.slug}.demo`;
      } while (usedEmails.has(email) && attempts <= 20);
      usedEmails.add(email);

      const id = randomUUID();
      const firstName = rngPick(FIRST_NAMES);
      const lastName = rngPick(LAST_NAMES);
      allUserRows.push([
        id,
        email,
        sharedPasswordHash,
        firstName,
        lastName,
        true,
        now,
        now,
      ]);
      users.push({ id, email });
    }
    orgUserMetas.set(org.id, users);
  }

  await bulkInsert(
    'User',
    [
      'id',
      'email',
      'passwordHash',
      'firstName',
      'lastName',
      'isActive',
      'createdAt',
      'updatedAt',
    ],
    {},
    allUserRows,
    '("email")',
  );
  log(`  Created ${allUserRows.length} users`);

  // ── Phase 3: Memberships ──────────────────────────────────────────────────

  log('Phase 3: Generating memberships...');

  interface MembershipMeta {
    id: string;
    orgId: string;
    userId: string;
    role: string;
  }

  const membershipRows: unknown[][] = [];
  const membershipMetas: MembershipMeta[] = [];
  const ROLES_POOL = [
    'CASHIER',
    'CASHIER',
    'CASHIER',
    'INVENTORY_CLERK',
    'INVENTORY_CLERK',
    'SUPPORT',
    'MANAGER',
  ];

  for (const org of orgMetas) {
    const users = orgUserMetas.get(org.id) ?? [];
    for (let u = 0; u < users.length; u++) {
      const user = users[u];
      let role: string;
      if (u === 0) role = 'OWNER';
      else if (u === 1) role = 'MANAGER';
      else role = rngPick(ROLES_POOL);

      const id = randomUUID();
      membershipRows.push([id, org.id, user.id, role, 'ACTIVE', now, now]);
      membershipMetas.push({ id, orgId: org.id, userId: user.id, role });
    }
  }

  await bulkInsert(
    'Membership',
    [
      'id',
      'organizationId',
      'userId',
      'role',
      'status',
      'createdAt',
      'updatedAt',
    ],
    { role: 'Role', status: 'MembershipStatus' },
    membershipRows,
    '("organizationId", "userId")',
  );
  log(`  Created ${membershipRows.length} memberships`);

  // ── Phase 4: Locations ────────────────────────────────────────────────────

  log('Phase 4: Generating locations...');

  interface LocationMeta {
    id: string;
    orgId: string;
    tier: OrgTier;
  }

  const locationRows: unknown[][] = [];
  const locationMetas: LocationMeta[] = [];
  const orgLocationMetas: Map<string, LocationMeta[]> = new Map();

  const LOCATION_TYPES = ['STORE', 'STORE', 'STORE', 'WAREHOUSE', 'POP_UP'];

  for (const org of orgMetas) {
    const locs: LocationMeta[] = [];
    for (let l = 0; l < org.locationCount; l++) {
      const addr = generateAddress();
      const locType =
        l === 0 ? 'STORE' : rngPickWeighted(LOCATION_TYPES, [60, 20, 10, 7, 3]);
      const code = `${org.bizType.code}-${String(l + 1).padStart(3, '0')}`;
      // Location name must be unique per org
      const name = `${addr.city} #${l + 1}`;
      const id = randomUUID();

      locationRows.push([
        id,
        org.id,
        name,
        code,
        locType,
        'ACTIVE',
        addr.addressLine1,
        addr.city,
        addr.stateProvince,
        addr.postalCode,
        addr.countryCode,
        now,
        now,
      ]);
      locs.push({ id, orgId: org.id, tier: org.tier });
    }
    orgLocationMetas.set(org.id, locs);
    locationMetas.push(...locs);
  }

  await bulkInsert(
    'Location',
    [
      'id',
      'organizationId',
      'name',
      'code',
      'type',
      'status',
      'addressLine1',
      'city',
      'stateProvince',
      'postalCode',
      'countryCode',
      'createdAt',
      'updatedAt',
    ],
    { type: 'LocationType', status: 'LocationStatus' },
    locationRows,
    '("organizationId", "name")',
  );
  log(`  Created ${locationRows.length} locations`);

  // ── Phase 5: MembershipLocations (owners/managers get all; others get random subset) ──

  log('Phase 5: Generating membership-location assignments...');

  const membershipLocationRows: unknown[][] = [];

  for (const mem of membershipMetas) {
    const locs = orgLocationMetas.get(mem.orgId) ?? [];
    if (locs.length === 0) continue;

    if (mem.role === 'OWNER' || mem.role === 'MANAGER') {
      // Full access — assign all locations
      for (const loc of locs) {
        membershipLocationRows.push([randomUUID(), mem.id, loc.id, now]);
      }
    } else {
      // Restricted: assign 1 to N locations
      const count = rngInt(1, Math.max(1, Math.floor(locs.length * 0.6)));
      const shuffled = [...locs].sort(() => rng() - 0.5);
      for (let i = 0; i < Math.min(count, shuffled.length); i++) {
        membershipLocationRows.push([
          randomUUID(),
          mem.id,
          shuffled[i].id,
          now,
        ]);
      }
    }
  }

  await bulkInsert(
    'MembershipLocation',
    ['id', 'membershipId', 'locationId', 'createdAt'],
    {},
    membershipLocationRows,
    '("membershipId", "locationId")',
  );
  log(`  Created ${membershipLocationRows.length} membership-location links`);

  // ── Phase 6–11: Per-org loop ───────────────────────────────────────────────

  log('Phase 6-11: Per-org product/customer/inventory/order generation...');

  let totalProducts = 0;
  let totalCustomers = 0;
  let totalInventoryLevels = 0;
  let totalInventoryAdjustments = 0;
  let totalOrders = 0;
  let totalOrderItems = 0;
  let totalPayments = 0;
  let totalPaymentAttempts = 0;

  for (let orgIdx = 0; orgIdx < orgMetas.length; orgIdx++) {
    const org = orgMetas[orgIdx];
    const locs = orgLocationMetas.get(org.id) ?? [];
    const users = orgUserMetas.get(org.id) ?? [];
    const ownerUserId = users[0]?.id;

    log(
      `  Org ${orgIdx + 1}/${NUM_ORGS}: ${org.bizType.code} (${org.tier.label}, ${locs.length} locations)`,
    );

    // ── Products ───────────────────────────────────────────────────────────

    const numProducts = rngInt(
      org.bizType.productCount.min,
      org.bizType.productCount.max,
    );
    const productRows: unknown[][] = [];

    interface ProductRef {
      id: string;
      name: string;
      sku: string;
      priceCents: number;
    }
    const productRefs: ProductRef[] = [];

    let productSeq = 0;
    const categories = org.bizType.categories;

    // Distribute products evenly-ish across categories
    const productsPerCategory = Math.max(
      1,
      Math.floor(numProducts / categories.length),
    );

    for (const category of categories) {
      const namesForCat = org.bizType.productNamesByCategory[category] ?? [
        'Item',
      ];
      const priceBand = org.bizType.priceBands[category] ?? {
        min: 500,
        max: 5000,
      };
      const catCode = category
        .replace(/[^A-Z]/gi, '')
        .toUpperCase()
        .slice(0, 4);
      const count =
        category === categories[categories.length - 1]
          ? numProducts - productSeq // give remainder to last category
          : productsPerCategory;

      for (let p = 0; p < count; p++) {
        const baseName = rngPick(namesForCat);
        const variant = rngBool(0.4)
          ? ` ${rngPick(['S', 'M', 'L', 'XL', 'Black', 'White', 'Navy', 'Grey', 'Green', 'Natural'])}`
          : '';
        const name = `${baseName}${variant}`;
        const sku = `${org.bizType.code}-${catCode}-${String(productSeq + 1).padStart(4, '0')}`;
        const priceCents = rngInt(priceBand.min, priceBand.max);
        const reorderThreshold = rngInt(5, 25);
        const id = randomUUID();

        productRows.push([
          id,
          org.id,
          name,
          category,
          sku,
          priceCents,
          reorderThreshold,
          true,
          now,
          now,
        ]);
        productRefs.push({ id, name, sku, priceCents });
        productSeq++;
      }
    }

    await bulkInsert(
      'Product',
      [
        'id',
        'organizationId',
        'name',
        'category',
        'sku',
        'priceCents',
        'reorderThreshold',
        'active',
        'createdAt',
        'updatedAt',
      ],
      {},
      productRows,
      '("organizationId", "sku")',
    );
    totalProducts += productRows.length;

    // ── Customers ──────────────────────────────────────────────────────────

    const customerRows: unknown[][] = [];
    const customerIds: string[] = [];

    for (let c = 0; c < org.customerCount; c++) {
      const id = randomUUID();
      const fn = rngPick(FIRST_NAMES);
      const ln = rngPick(LAST_NAMES);
      const n = rngInt(1, 9999);
      const email = `${fn.toLowerCase()}.${ln.toLowerCase()}${n}@example.com`;
      const phone = `${rngInt(200, 999)}-${rngInt(200, 999)}-${rngInt(1000, 9999)}`;
      const status = rngPickWeighted(
        ['ACTIVE', 'INACTIVE', 'BLOCKED'] as const,
        [88, 10, 2],
      );
      customerRows.push([
        id,
        org.id,
        `${fn} ${ln}`,
        email,
        phone,
        status,
        now,
        now,
      ]);
      customerIds.push(id);
    }

    await bulkInsert(
      'Customer',
      [
        'id',
        'organizationId',
        'name',
        'email',
        'phone',
        'status',
        'createdAt',
        'updatedAt',
      ],
      { status: 'CustomerStatus' },
      customerRows,
      '("id")',
    );
    totalCustomers += customerRows.length;

    // ── Inventory Levels + Adjustments ─────────────────────────────────────

    const inventoryLevelRows: unknown[][] = [];
    const inventoryAdjRows: unknown[][] = [];

    for (const loc of locs) {
      for (const product of productRefs) {
        const quantity = rngInt(0, 200);
        const levelId = randomUUID();
        inventoryLevelRows.push([
          levelId,
          product.id,
          loc.id,
          quantity,
          now,
          now,
        ]);
        if (quantity > 0) {
          inventoryAdjRows.push([
            randomUUID(),
            org.id,
            product.id,
            loc.id,
            ownerUserId ?? null,
            quantity,
            'INITIAL_STOCK',
            'demo-seed-initial',
            now,
          ]);
        }
      }
    }

    await bulkInsert(
      'InventoryLevel',
      ['id', 'productId', 'locationId', 'quantity', 'createdAt', 'updatedAt'],
      {},
      inventoryLevelRows,
      '("productId", "locationId")',
    );
    totalInventoryLevels += inventoryLevelRows.length;

    await bulkInsert(
      'InventoryAdjustment',
      [
        'id',
        'organizationId',
        'productId',
        'locationId',
        'actorUserId',
        'delta',
        'reason',
        'note',
        'createdAt',
      ],
      { reason: 'InventoryAjustmentReason' },
      inventoryAdjRows,
      '("id")',
    );
    totalInventoryAdjustments += inventoryAdjRows.length;

    // ── Orders + OrderItems (per location) ─────────────────────────────────

    for (const loc of locs) {
      const tierKey = org.tier.label;
      const band = org.bizType.ordersPerLocationPerTier[tierKey];
      const numOrders = rngInt(band.min, band.max);

      const orderRows: unknown[][] = [];
      const orderItemRows: unknown[][] = [];
      const paymentRows: unknown[][] = [];
      const paymentAttemptRows: unknown[][] = [];

      const flushOrderBatch = async () => {
        if (orderRows.length === 0) {
          return;
        }

        await bulkInsert(
          'Order',
          [
            'id',
            'organizationId',
            'customerId',
            'locationId',
            'status',
            'subtotalCents',
            'taxCents',
            'discountCents',
            'totalCents',
            'createdAt',
            'updatedAt',
            'placedAt',
            'cancelledAt',
          ],
          { status: 'OrderStatus' },
          orderRows,
          '("id", "organizationId")',
        );
        totalOrders += orderRows.length;
        orderRows.length = 0;

        await bulkInsert(
          'OrderItem',
          [
            'id',
            'orderId',
            'productId',
            'organizationId',
            'productName',
            'sku',
            'qty',
            'unitPriceCents',
            'lineSubtotalCents',
            'discountCents',
            'taxCents',
            'lineTotalCents',
          ],
          {},
          orderItemRows,
          '("id")',
        );
        totalOrderItems += orderItemRows.length;
        orderItemRows.length = 0;

        if (paymentRows.length > 0) {
          await bulkInsert(
            'Payment',
            [
              'id',
              'organizationId',
              'orderId',
              'method',
              'paymentStatus',
              'refundStatus',
              'amountCents',
              'currencyCode',
              'stripeRefundId',
              'paidAt',
              'refundRequestedAt',
              'refundedAt',
              'refundFailedAt',
              'refundReason',
              'lastPaymentFailure',
              'lastRefundFailure',
              'createdAt',
              'updatedAt',
            ],
            {
              method: 'PaymentMethod',
              paymentStatus: 'PaymentStatus',
              refundStatus: 'RefundStatus',
            },
            paymentRows,
            '("orderId")',
          );
          totalPayments += paymentRows.length;
          paymentRows.length = 0;
        }

        if (paymentAttemptRows.length > 0) {
          await bulkInsert(
            'PaymentAttempt',
            [
              'id',
              'paymentId',
              'stripePaymentIntentId',
              'status',
              'clientSecret',
              'amountCents',
              'currencyCode',
              'lastFailure',
              'createdAt',
              'updatedAt',
            ],
            { status: 'PaymentAttemptStatus' },
            paymentAttemptRows,
            '("id")',
          );
          totalPaymentAttempts += paymentAttemptRows.length;
          paymentAttemptRows.length = 0;
        }
      };

      for (let o = 0; o < numOrders; o++) {
        const orderId = randomUUID();
        const status = rngPickWeighted(
          ORDER_STATUSES,
          ORDER_STATUS_WEIGHTS,
        ) as SeedOrderStatus;
        const customerId =
          rngBool(0.7) && customerIds.length > 0 ? rngPick(customerIds) : null;
        const createdAt = randomOrderDate();

        // Build items
        const numItems = rngPickWeighted(
          ITEMS_PER_ORDER_CHOICES,
          ITEMS_PER_ORDER_WEIGHTS,
        );
        let subtotalCents = 0;

        for (let it = 0; it < numItems; it++) {
          const product = rngPick(productRefs);
          const qty = rngInt(1, 5);
          const unitPriceCents = product.priceCents;
          const lineSubtotal = qty * unitPriceCents;
          const lineTax = Math.round(lineSubtotal * TAX_RATE);
          const lineTotal = lineSubtotal + lineTax;
          subtotalCents += lineSubtotal;

          orderItemRows.push([
            randomUUID(),
            orderId,
            product.id,
            org.id,
            product.name,
            product.sku,
            qty,
            unitPriceCents,
            lineSubtotal,
            0,
            lineTax,
            lineTotal,
          ]);
        }

        const taxCents = Math.round(subtotalCents * TAX_RATE);
        const totalCents = subtotalCents + taxCents;
        const paymentBundle = buildSeedPaymentBundle({
          orderId,
          organizationId: org.id,
          totalCents,
          createdAt,
          status,
        });

        orderRows.push([
          orderId,
          org.id,
          customerId,
          loc.id,
          paymentBundle.orderStatus,
          subtotalCents,
          taxCents,
          0,
          totalCents,
          createdAt,
          paymentBundle.orderUpdatedAt,
          paymentBundle.placedAt,
          paymentBundle.cancelledAt,
        ]);

        if (paymentBundle.paymentRow) {
          paymentRows.push(paymentBundle.paymentRow);
        }

        if (paymentBundle.paymentAttemptRows.length > 0) {
          paymentAttemptRows.push(...paymentBundle.paymentAttemptRows);
        }

        // Flush in batches to keep memory bounded
        if (orderRows.length >= 4000) {
          await flushOrderBatch();
        }
      }

      await flushOrderBatch();
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────

  const elapsed = ((Date.now() - START_TIME) / 1000).toFixed(1);
  log('');
  log('=== Demo seed complete ===');
  log(`  Organizations:         ${NUM_ORGS.toLocaleString()}`);
  log(`  Users:                 ${allUserRows.length.toLocaleString()}`);
  log(`  Memberships:           ${membershipRows.length.toLocaleString()}`);
  log(`  Locations:             ${locationRows.length.toLocaleString()}`);
  log(
    `  MembershipLocations:   ${membershipLocationRows.length.toLocaleString()}`,
  );
  log(`  Products:              ${totalProducts.toLocaleString()}`);
  log(`  Customers:             ${totalCustomers.toLocaleString()}`);
  log(`  Inventory Levels:      ${totalInventoryLevels.toLocaleString()}`);
  log(`  Inventory Adjustments: ${totalInventoryAdjustments.toLocaleString()}`);
  log(`  Orders:                ${totalOrders.toLocaleString()}`);
  log(`  Order Items:           ${totalOrderItems.toLocaleString()}`);
  log(`  Payments:              ${totalPayments.toLocaleString()}`);
  log(`  Payment Attempts:      ${totalPaymentAttempts.toLocaleString()}`);
  log(`  Total time:            ${elapsed}s`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
