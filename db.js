require('dotenv').config();
const { Pool, Client } = require('pg');
const bcrypt = require('bcryptjs');

const ADMIN_PG_URL = process.env.ADMIN_PG_URL || 'postgresql://postgres@127.0.0.1:5432/postgres';
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres@127.0.0.1:5432/finvault_b20';
const TARGET_DB_NAME = 'finvault_b20';

const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000
});

const SEED_USERS = [
  {
    username: 'admin',
    password: 'AdminVault#2026',
    fullName: 'Admin FinVault',
    email: 'admin@finvault.local',
    accountNumber: '8800-0001-99',
    balance: 250000000,
    role: 'admin'
  },
  {
    username: 'danish',
    password: 'DanishPass123',
    fullName: 'Danish Al Fayyadh',
    email: 'danish@finvault.local',
    accountNumber: '8800-1024-01',
    balance: 12500000,
    role: 'customer'
  },
  {
    username: 'raihan',
    password: 'rehanwangsaf67',
    fullName: 'Raihan Muhammad',
    email: 'raihan@finvault.local',
    accountNumber: '8800-1024-02',
    balance: 4750000,
    role: 'customer'
  },
  {
    username: 'siti',
    password: 'SitiSecure123',
    fullName: 'Siti Rahmawati',
    email: 'siti@finvault.local',
    accountNumber: '8800-1024-03',
    balance: 19200000,
    role: 'customer'
  }
];

const SEED_TRANSACTIONS = [
  {
    username: 'admin',
    txCode: 'TX-20261120-001',
    type: 'CREDIT',
    amount: 100000000,
    description: 'Treasury liquidity allocation'
  },
  {
    username: 'danish',
    txCode: 'TX-20261120-002',
    type: 'CREDIT',
    amount: 15000000,
    description: 'Payroll disbursement November'
  },
  {
    username: 'danish',
    txCode: 'TX-20261120-003',
    type: 'DEBIT',
    amount: 2500000,
    description: 'Cloud infrastructure settlement'
  },
  {
    username: 'raihan',
    txCode: 'TX-20261120-004',
    type: 'CREDIT',
    amount: 5500000,
    description: 'Merchant settlement batch'
  },
  {
    username: 'raihan',
    txCode: 'TX-20261120-005',
    type: 'DEBIT',
    amount: 750000,
    description: 'QRIS transfer to Siti Rahmawati'
  },
  {
    username: 'siti',
    txCode: 'TX-20261120-006',
    type: 'CREDIT',
    amount: 19200000,
    description: 'Vendor invoice payout'
  }
];

/**
 * Ensures the target PostgreSQL database exists, initializes schema tables,
 * and seeds initial demo data if the users table is empty.
 */
async function initDatabase() {
  const adminClient = new Client({ connectionString: ADMIN_PG_URL });
  try {
    await adminClient.connect();
    const dbCheck = await adminClient.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [TARGET_DB_NAME]
    );
    if (dbCheck.rowCount === 0) {
      await adminClient.query(`CREATE DATABASE ${TARGET_DB_NAME}`);
    }
  } finally {
    await adminClient.end();
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL,
      account_number TEXT NOT NULL,
      balance BIGINT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'customer')),
      password_hash TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      tx_code TEXT UNIQUE NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('CREDIT', 'DEBIT')),
      amount BIGINT NOT NULL,
      description TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      security_mode TEXT NOT NULL,
      client_ip TEXT NOT NULL,
      actor_username TEXT NOT NULL,
      http_method TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      status_code INTEGER NOT NULL,
      detail TEXT NOT NULL
    );
  `);

  const { rows } = await pool.query('SELECT COUNT(*)::int AS total FROM users');
  if (rows[0].total === 0) {
    await resetAndSeedDatabase();
  }
}

/**
 * Truncates all FinVault tables inside a single transaction and restores
 * deterministic seed accounts and transactions without closing the pool.
 */
async function resetAndSeedDatabase() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('TRUNCATE transactions, audit_logs, users RESTART IDENTITY CASCADE');

    const userIdByUsername = new Map();
    for (const user of SEED_USERS) {
      const passwordHash = await bcrypt.hash(user.password, 10);
      const inserted = await client.query(
        `INSERT INTO users (username, full_name, email, account_number, balance, role, password_hash)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, username`,
        [
          user.username,
          user.fullName,
          user.email,
          user.accountNumber,
          user.balance,
          user.role,
          passwordHash
        ]
      );
      userIdByUsername.set(inserted.rows[0].username, inserted.rows[0].id);
    }

    for (const tx of SEED_TRANSACTIONS) {
      const userId = userIdByUsername.get(tx.username);
      await client.query(
        `INSERT INTO transactions (user_id, tx_code, type, amount, description)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, tx.txCode, tx.type, tx.amount, tx.description]
      );
    }

    await client.query('COMMIT');
    return {
      seededUsers: SEED_USERS.length,
      seededTransactions: SEED_TRANSACTIONS.length
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  initDatabase,
  resetAndSeedDatabase
};
