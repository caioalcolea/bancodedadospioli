const express = require('express');
const router = express.Router();

// POST /api/webhook/:table - Receive webhook and upsert data
router.post('/:table', async (req, res) => {
  const pool = req.app.locals.pool;
  const { table } = req.params;
  const { match_field, ...data } = req.body;
  const ip = req.ip || req.connection.remoteAddress;

  try {
    // Verify table exists
    const tableCheck = await pool.query(
      'SELECT table_name FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2',
      ['public', table]
    );
    if (tableCheck.rows.length === 0) {
      await logWebhook(pool, table, 'upsert', req.body, ip, 'error', `Table "${table}" not found`);
      return res.status(404).json({ error: `Table "${table}" not found` });
    }

    let result;
    const payload = { ...data };
    delete payload.match_field;

    if (match_field && payload[match_field] !== undefined) {
      // Try to find existing record by match_field
      const existing = await pool.query(
        `SELECT id FROM "${table}" WHERE "${match_field}" = $1 LIMIT 1`,
        [payload[match_field]]
      );

      if (existing.rows.length > 0) {
        // Update existing record
        const keys = Object.keys(payload);
        const values = Object.values(payload);
        const setClause = keys.map((k, i) => `"${k}" = $${i + 1}`).join(', ');
        values.push(existing.rows[0].id);

        result = await pool.query(
          `UPDATE "${table}" SET ${setClause} WHERE id = $${values.length} RETURNING *`,
          values
        );
        await logWebhook(pool, table, 'update', req.body, ip, 'success');
        return res.json({ action: 'updated', record: result.rows[0] });
      }
    }

    // Insert new record
    const keys = Object.keys(payload);
    const values = Object.values(payload);
    const placeholders = keys.map((_, i) => `$${i + 1}`);

    result = await pool.query(
      `INSERT INTO "${table}" (${keys.map(k => `"${k}"`).join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
      values
    );

    await logWebhook(pool, table, 'insert', req.body, ip, 'success');
    res.status(201).json({ action: 'created', record: result.rows[0] });
  } catch (err) {
    await logWebhook(pool, table, 'error', req.body, ip, 'error', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/webhook/:table/batch - Receive batch webhook data
router.post('/:table/batch', async (req, res) => {
  const pool = req.app.locals.pool;
  const { table } = req.params;
  const { records, match_field } = req.body;
  const ip = req.ip || req.connection.remoteAddress;

  if (!Array.isArray(records)) {
    return res.status(400).json({ error: 'Body must contain a "records" array' });
  }

  const results = { inserted: 0, updated: 0, errors: [] };

  for (const record of records) {
    try {
      if (match_field && record[match_field] !== undefined) {
        const existing = await pool.query(
          `SELECT id FROM "${table}" WHERE "${match_field}" = $1 LIMIT 1`,
          [record[match_field]]
        );

        if (existing.rows.length > 0) {
          const keys = Object.keys(record);
          const values = Object.values(record);
          const setClause = keys.map((k, i) => `"${k}" = $${i + 1}`).join(', ');
          values.push(existing.rows[0].id);
          await pool.query(`UPDATE "${table}" SET ${setClause} WHERE id = $${values.length}`, values);
          results.updated++;
          continue;
        }
      }

      const keys = Object.keys(record);
      const values = Object.values(record);
      const placeholders = keys.map((_, i) => `$${i + 1}`);
      await pool.query(
        `INSERT INTO "${table}" (${keys.map(k => `"${k}"`).join(', ')}) VALUES (${placeholders.join(', ')})`,
        values
      );
      results.inserted++;
    } catch (err) {
      results.errors.push({ record, error: err.message });
    }
  }

  await logWebhook(pool, table, 'batch', { total: records.length }, ip, 'success');
  res.json(results);
});

// GET /api/webhook/logs - View webhook logs
router.get('/logs/all', async (req, res) => {
  const pool = req.app.locals.pool;
  const { page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    const countResult = await pool.query('SELECT COUNT(*) FROM _webhook_logs');
    const result = await pool.query(
      'SELECT * FROM _webhook_logs ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [parseInt(limit), offset]
    );
    res.json({
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count),
        pages: Math.ceil(parseInt(countResult.rows[0].count) / parseInt(limit))
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function logWebhook(pool, table, action, payload, ip, status, error = null) {
  try {
    await pool.query(
      'INSERT INTO _webhook_logs (table_name, action, payload, ip_address, status, error_message) VALUES ($1, $2, $3, $4, $5, $6)',
      [table, action, JSON.stringify(payload), ip, status, error]
    );
  } catch (e) {
    console.error('Failed to log webhook:', e.message);
  }
}

module.exports = router;
