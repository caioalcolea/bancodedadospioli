import { Pool } from 'pg'

if (!process.env.DATABASE_URL) {
  console.warn('WARNING: DATABASE_URL not set, using default connection string')
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
})

pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err.message)
})

// Initialize meta tables on first import
let initialized = false
export async function ensureInit() {
  if (initialized) return
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS _meta_tables (
        id SERIAL PRIMARY KEY,
        table_name VARCHAR(255) UNIQUE NOT NULL,
        display_name VARCHAR(255),
        description TEXT,
        columns JSONB NOT NULL DEFAULT '[]',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS _webhook_logs (
        id SERIAL PRIMARY KEY,
        table_name VARCHAR(255),
        action VARCHAR(50),
        payload JSONB,
        ip_address VARCHAR(45),
        status VARCHAR(20) DEFAULT 'success',
        error_message TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    initialized = true
  } catch (e) {
    console.error('DB init error:', e.message)
  }
}

/**
 * Validates a table name exists in our managed tables.
 * Returns true if valid, false if not.
 */
export async function isValidTable(tableName) {
  if (!tableName || !/^[a-z_][a-z0-9_]*$/i.test(tableName)) return false
  const result = await pool.query(
    'SELECT table_name FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2',
    ['public', tableName]
  )
  return result.rows.length > 0
}

/**
 * Returns valid column names for a table.
 */
export async function getTableColumns(tableName) {
  const result = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
    [tableName]
  )
  return result.rows.map(r => r.column_name)
}

/**
 * Filters object keys to only include valid columns for a table.
 */
export function filterValidColumns(data, validColumns) {
  const filtered = {}
  for (const [key, value] of Object.entries(data)) {
    if (validColumns.includes(key)) {
      filtered[key] = value
    }
  }
  return filtered
}

/**
 * Sanitize error messages for client responses.
 */
export function safeError(err) {
  if (process.env.NODE_ENV === 'production') {
    console.error('API Error:', err.message)
    return 'Internal server error'
  }
  return err.message
}

export default pool
