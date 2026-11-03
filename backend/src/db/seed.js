// Seed script.
//   Branches + counters, 4 demo users, 5 suppliers, 15 medicines (2 controlled).
//   Idempotent per table — skips a table if any rows already exist, so you can safely
//   run `npm run seed` more than once. Use `npm run db:reset` to wipe and reseed.

import bcrypt from 'bcryptjs';
import { pool } from './pool.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

const BRANCHES = [
  {
    code: 'MOG-01',
    name: 'Mogadishu Central',
    city: 'Mogadishu',
    phone: '+252-61-1234567',
    address: 'KM4, Hodan District',
  },
  {
    code: 'HGS-01',
    name: 'Hargeisa Main',
    city: 'Hargeisa',
    phone: '+252-63-4567890',
    address: 'Jigjiga Yar Road',
  },
  {
    code: 'GRO-01',
    name: 'Garowe Branch',
    city: 'Garowe',
    phone: '+252-90-1122334',
    address: 'Main Street',
  },
];

const USERS = [
  {
    full_name: 'Abdirahman Owner',
    email: 'owner@pharmacy.so',
    password: 'Owner@123',
    role: 'OWNER',
    branchCode: null,
  },
  {
    full_name: 'Fatima Manager',
    email: 'manager.mog@pharmacy.so',
    password: 'Manager@123',
    role: 'MANAGER',
    branchCode: 'MOG-01',
  },
  {
    full_name: 'Ahmed Pharmacist',
    email: 'pharm.mog@pharmacy.so',
    password: 'Pharm@123',
    role: 'PHARMACIST',
    branchCode: 'MOG-01',
  },
  {
    full_name: 'Khadija Manager',
    email: 'manager.hgs@pharmacy.so',
    password: 'Manager@123',
    role: 'MANAGER',
    branchCode: 'HGS-01',
  },
];

const SUPPLIERS = [
  {
    name: 'Baraka Pharmaceuticals',
    phone: '+252-61-111-2222',
    address: 'Industrial Rd, Mogadishu',
    payment_terms: 'NET 30',
  },
  {
    name: 'Horn Pharma Distributors',
    phone: '+252-63-333-4444',
    address: 'Jigjiga Yar, Hargeisa',
    payment_terms: 'NET 15',
  },
  {
    name: 'Mogadishu Medical Supplies',
    phone: '+252-61-555-6666',
    address: 'Hamarweyne, Mogadishu',
    payment_terms: 'COD',
  },
  {
    name: 'Puntland Pharma Wholesale',
    phone: '+252-90-777-8888',
    address: 'Main Street, Garowe',
    payment_terms: 'NET 45',
  },
  {
    name: 'East Africa Medi-Trade',
    phone: '+252-61-999-0000',
    address: 'Airport Road, Mogadishu',
    payment_terms: 'NET 30',
  },
];

const MEDICINES = [
  // Analgesics / antipyretics
  {
    generic_name: 'Paracetamol',
    brand_name: 'Panadol',
    form: 'TABLET',
    strength: '500 mg',
    unit_label: 'Box of 100',
    category: 'Analgesic',
    barcode: '5000158105003',
    selling_price: 3.5,
    is_controlled: 0,
  },
  {
    generic_name: 'Paracetamol',
    brand_name: 'Generic',
    form: 'TABLET',
    strength: '500 mg',
    unit_label: 'Box of 100',
    category: 'Analgesic',
    barcode: null,
    selling_price: 2.0,
    is_controlled: 0,
  },
  {
    generic_name: 'Ibuprofen',
    brand_name: 'Brufen',
    form: 'TABLET',
    strength: '400 mg',
    unit_label: 'Box of 24',
    category: 'NSAID',
    barcode: '5000158200012',
    selling_price: 2.5,
    is_controlled: 0,
  },
  {
    generic_name: 'Diclofenac',
    brand_name: 'Voltaren',
    form: 'TABLET',
    strength: '50 mg',
    unit_label: 'Box of 30',
    category: 'NSAID',
    barcode: null,
    selling_price: 4.0,
    is_controlled: 0,
  },

  // Antibiotics
  {
    generic_name: 'Amoxicillin',
    brand_name: 'Amoxil',
    form: 'CAPSULE',
    strength: '500 mg',
    unit_label: 'Box of 50',
    category: 'Antibiotic',
    barcode: '5000158300021',
    selling_price: 8.5,
    is_controlled: 0,
  },
  {
    generic_name: 'Amoxicillin',
    brand_name: 'Amoxil',
    form: 'SYRUP',
    strength: '250 mg/5 ml',
    unit_label: 'Bottle 100 ml',
    category: 'Antibiotic',
    barcode: null,
    selling_price: 5.5,
    is_controlled: 0,
  },
  {
    generic_name: 'Azithromycin',
    brand_name: 'Zithromax',
    form: 'TABLET',
    strength: '500 mg',
    unit_label: 'Box of 6',
    category: 'Antibiotic',
    barcode: '5000158300045',
    selling_price: 7.0,
    is_controlled: 0,
  },

  // Chronic conditions
  {
    generic_name: 'Metformin',
    brand_name: 'Glucophage',
    form: 'TABLET',
    strength: '500 mg',
    unit_label: 'Box of 60',
    category: 'Antidiabetic',
    barcode: null,
    selling_price: 6.0,
    is_controlled: 0,
  },
  {
    generic_name: 'Amlodipine',
    brand_name: 'Norvasc',
    form: 'TABLET',
    strength: '5 mg',
    unit_label: 'Box of 30',
    category: 'Antihypertensive',
    barcode: null,
    selling_price: 5.0,
    is_controlled: 0,
  },
  {
    generic_name: 'Atorvastatin',
    brand_name: 'Lipitor',
    form: 'TABLET',
    strength: '20 mg',
    unit_label: 'Box of 30',
    category: 'Statin',
    barcode: null,
    selling_price: 9.0,
    is_controlled: 0,
  },
  {
    generic_name: 'Omeprazole',
    brand_name: 'Losec',
    form: 'CAPSULE',
    strength: '20 mg',
    unit_label: 'Box of 30',
    category: 'PPI',
    barcode: null,
    selling_price: 6.5,
    is_controlled: 0,
  },

  // Allergy / respiratory
  {
    generic_name: 'Cetirizine',
    brand_name: 'Zyrtec',
    form: 'TABLET',
    strength: '10 mg',
    unit_label: 'Box of 20',
    category: 'Antihistamine',
    barcode: null,
    selling_price: 2.0,
    is_controlled: 0,
  },
  {
    generic_name: 'Salbutamol',
    brand_name: 'Ventolin',
    form: 'OTHER',
    strength: '100 mcg/dose',
    unit_label: 'Inhaler 200 doses',
    category: 'Bronchodilator',
    barcode: null,
    selling_price: 12.0,
    is_controlled: 0,
  },

  // Controlled drugs (require pharmacist + prescription at sale — enforced on Day 4)
  {
    generic_name: 'Morphine Sulfate',
    brand_name: 'Morphine',
    form: 'INJECTION',
    strength: '10 mg/ml',
    unit_label: 'Vial 1 ml',
    category: 'Opioid analgesic',
    barcode: null,
    selling_price: 25.0,
    is_controlled: 1,
  },
  {
    generic_name: 'Codeine Phosphate',
    brand_name: 'Codeine',
    form: 'TABLET',
    strength: '30 mg',
    unit_label: 'Box of 20',
    category: 'Opioid analgesic',
    barcode: null,
    selling_price: 18.0,
    is_controlled: 1,
  },
];

async function seedBranches(conn) {
  const [[row]] = await conn.query('SELECT COUNT(*) AS n FROM branches');
  if (row.n > 0) {
    logger.info(`branches: ${row.n} present, skipping`);
    return;
  }
  for (const b of BRANCHES) {
    await conn.execute(
      'INSERT INTO branches (code, name, city, phone, address) VALUES (?, ?, ?, ?, ?)',
      [b.code, b.name, b.city, b.phone, b.address]
    );
  }
  const [branches] = await conn.query('SELECT id FROM branches');
  for (const row of branches) {
    await conn.execute('INSERT INTO branch_counters (branch_id) VALUES (?)', [row.id]);
  }
  logger.info(`branches: seeded ${BRANCHES.length}`);
}

async function seedUsers(conn) {
  const [[row]] = await conn.query('SELECT COUNT(*) AS n FROM users');
  if (row.n > 0) {
    logger.info(`users: ${row.n} present, skipping`);
    return;
  }
  const [branches] = await conn.query('SELECT id, code FROM branches');
  const byCode = Object.fromEntries(branches.map((b) => [b.code, b.id]));

  for (const u of USERS) {
    const hash = await bcrypt.hash(u.password, env.BCRYPT_ROUNDS);
    const branchId = u.branchCode ? byCode[u.branchCode] : null;
    await conn.execute(
      'INSERT INTO users (full_name, email, password_hash, role, branch_id) VALUES (?, ?, ?, ?, ?)',
      [u.full_name, u.email, hash, u.role, branchId]
    );
  }
  logger.info(`users: seeded ${USERS.length}`);
}

async function seedSuppliers(conn) {
  const [[row]] = await conn.query('SELECT COUNT(*) AS n FROM suppliers');
  if (row.n > 0) {
    logger.info(`suppliers: ${row.n} present, skipping`);
    return;
  }
  for (const s of SUPPLIERS) {
    await conn.execute(
      'INSERT INTO suppliers (name, phone, address, payment_terms) VALUES (?, ?, ?, ?)',
      [s.name, s.phone, s.address, s.payment_terms]
    );
  }
  logger.info(`suppliers: seeded ${SUPPLIERS.length}`);
}

async function seedMedicines(conn) {
  const [[row]] = await conn.query('SELECT COUNT(*) AS n FROM medicines');
  if (row.n > 0) {
    logger.info(`medicines: ${row.n} present, skipping`);
    return;
  }
  for (const m of MEDICINES) {
    await conn.execute(
      `INSERT INTO medicines
         (generic_name, brand_name, form, strength, unit_label, category, barcode,
          selling_price, is_controlled)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        m.generic_name,
        m.brand_name,
        m.form,
        m.strength,
        m.unit_label,
        m.category,
        m.barcode,
        m.selling_price,
        m.is_controlled,
      ]
    );
  }
  logger.info(`medicines: seeded ${MEDICINES.length}`);
}

async function main() {
  const conn = await pool.getConnection();
  try {
    await seedBranches(conn);
    await seedUsers(conn);
    await seedSuppliers(conn);
    await seedMedicines(conn);
  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch((err) => {
  logger.error({ err }, 'seed failed');
  process.exit(1);
});
