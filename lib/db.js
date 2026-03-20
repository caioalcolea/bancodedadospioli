import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:894291802448b50603a3ca64f5f43f01@localhost:5432/bancodedadospioli',
  max: 20,
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

export default pool
