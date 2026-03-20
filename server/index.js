const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');
const dataRoutes = require('./routes/data');
const webhookRoutes = require('./routes/webhook');
const xmlRoutes = require('./routes/xml');
const metaRoutes = require('./routes/meta');

const app = express();
const PORT = process.env.PORT || 3456;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:894291802448b50603a3ca64f5f43f01@localhost:5432/bancodedadospioli'
});

// Make pool available to routes
app.locals.pool = pool;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// API Routes
app.use('/api/data', dataRoutes);
app.use('/api/webhook', webhookRoutes);
app.use('/api/xml', xmlRoutes);
app.use('/api/meta', metaRoutes);

// Health check
app.get('/api/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ status: 'ok', timestamp: result.rows[0].now });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Serve React frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

// Initialize database and start server
async function init() {
  try {
    // Create metadata table for tracking managed tables
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
    `);

    // Create webhook log table
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
    `);

    console.log('Database initialized successfully');
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Frontend: http://localhost:${PORT}`);
      console.log(`API: http://localhost:${PORT}/api`);
    });
  } catch (err) {
    console.error('Failed to initialize database:', err.message);
    process.exit(1);
  }
}

init();
