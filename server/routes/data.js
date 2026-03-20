const express = require('express');
const router = express.Router();

// GET /api/data/:table - List all records with optional filters
router.get('/:table', async (req, res) => {
  const pool = req.app.locals.pool;
  const { table } = req.params;
  const { page = 1, limit = 50, sort, order = 'asc', search, ...filters } = req.query;

  try {
    // Verify table exists
    const tableCheck = await pool.query(
      'SELECT table_name FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2',
      ['public', table]
    );
    if (tableCheck.rows.length === 0) {
      return res.status(404).json({ error: `Table "${table}" not found` });
    }

    // Build query
    let query = `SELECT * FROM "${table}"`;
    const values = [];
    const conditions = [];
    let paramIdx = 1;

    // Apply filters
    for (const [key, value] of Object.entries(filters)) {
      conditions.push(`"${key}"::text ILIKE $${paramIdx}`);
      values.push(`%${value}%`);
      paramIdx++;
    }

    // Apply search across all text columns
    if (search) {
      const cols = await pool.query(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
        [table]
      );
      const searchConditions = cols.rows.map(col => {
        values.push(`%${search}%`);
        return `"${col.column_name}"::text ILIKE $${paramIdx++}`;
      });
      if (searchConditions.length > 0) {
        conditions.push(`(${searchConditions.join(' OR ')})`);
      }
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    // Count total
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM "${table}"${conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : ''}`,
      values
    );
    const total = parseInt(countResult.rows[0].count);

    // Sort
    if (sort) {
      const direction = order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
      query += ` ORDER BY "${sort}" ${direction}`;
    } else {
      query += ` ORDER BY id ASC`;
    }

    // Paginate
    const offset = (parseInt(page) - 1) * parseInt(limit);
    query += ` LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
    values.push(parseInt(limit), offset);

    const result = await pool.query(query, values);

    res.json({
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/data/:table/:id - Get single record
router.get('/:table/:id', async (req, res) => {
  const pool = req.app.locals.pool;
  const { table, id } = req.params;

  try {
    const result = await pool.query(`SELECT * FROM "${table}" WHERE id = $1`, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Record not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/data/:table - Create record
router.post('/:table', async (req, res) => {
  const pool = req.app.locals.pool;
  const { table } = req.params;
  const data = req.body;

  try {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map((_, i) => `$${i + 1}`);

    const result = await pool.query(
      `INSERT INTO "${table}" (${keys.map(k => `"${k}"`).join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
      values
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/data/:table/:id - Update record
router.put('/:table/:id', async (req, res) => {
  const pool = req.app.locals.pool;
  const { table, id } = req.params;
  const data = req.body;

  try {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const setClause = keys.map((k, i) => `"${k}" = $${i + 1}`).join(', ');
    values.push(id);

    const result = await pool.query(
      `UPDATE "${table}" SET ${setClause} WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Record not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/data/:table/:id - Delete record
router.delete('/:table/:id', async (req, res) => {
  const pool = req.app.locals.pool;
  const { table, id } = req.params;

  try {
    const result = await pool.query(`DELETE FROM "${table}" WHERE id = $1 RETURNING *`, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Record not found' });
    }
    res.json({ message: 'Deleted', record: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
