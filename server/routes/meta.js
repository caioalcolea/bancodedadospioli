const express = require('express');
const router = express.Router();

// GET /api/meta/tables - List all managed tables
router.get('/tables', async (req, res) => {
  const pool = req.app.locals.pool;

  try {
    const result = await pool.query(`
      SELECT t.table_name, t.display_name, t.description, t.columns, t.created_at, t.updated_at,
             (SELECT COUNT(*) FROM information_schema.tables ist
              WHERE ist.table_schema = 'public' AND ist.table_name = t.table_name) as exists_in_db
      FROM _meta_tables t
      ORDER BY t.table_name
    `);

    // Also get row counts
    const tables = [];
    for (const row of result.rows) {
      let rowCount = 0;
      try {
        const countResult = await pool.query(`SELECT COUNT(*) FROM "${row.table_name}"`);
        rowCount = parseInt(countResult.rows[0].count);
      } catch (e) { /* table might not exist */ }

      tables.push({
        ...row,
        row_count: rowCount
      });
    }

    res.json(tables);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/meta/tables/:table/columns - Get table columns
router.get('/tables/:table/columns', async (req, res) => {
  const pool = req.app.locals.pool;
  const { table } = req.params;

  try {
    const result = await pool.query(
      `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1
       ORDER BY ordinal_position`,
      [table]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/meta/stats - System stats
router.get('/stats', async (req, res) => {
  const pool = req.app.locals.pool;

  try {
    const tablesResult = await pool.query('SELECT COUNT(*) FROM _meta_tables');
    const webhooksResult = await pool.query('SELECT COUNT(*) FROM _webhook_logs');
    const recentWebhooks = await pool.query(
      "SELECT COUNT(*) FROM _webhook_logs WHERE created_at > NOW() - INTERVAL '24 hours'"
    );

    let totalRecords = 0;
    const metaTables = await pool.query('SELECT table_name FROM _meta_tables');
    for (const t of metaTables.rows) {
      try {
        const c = await pool.query(`SELECT COUNT(*) FROM "${t.table_name}"`);
        totalRecords += parseInt(c.rows[0].count);
      } catch (e) { /* ignore */ }
    }

    res.json({
      tables: parseInt(tablesResult.rows[0].count),
      total_records: totalRecords,
      total_webhooks: parseInt(webhooksResult.rows[0].count),
      webhooks_24h: parseInt(recentWebhooks.rows[0].count)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/meta/endpoints - List all available API endpoints
router.get('/endpoints', async (req, res) => {
  const pool = req.app.locals.pool;

  try {
    const metaTables = await pool.query('SELECT table_name, display_name FROM _meta_tables');
    const baseUrl = `${req.protocol}://${req.get('host')}`;

    const endpoints = [
      {
        category: 'Sistema',
        items: [
          { method: 'GET', path: '/api/health', description: 'Health check do sistema' },
          { method: 'GET', path: '/api/meta/stats', description: 'Estatisticas gerais' },
          { method: 'GET', path: '/api/meta/tables', description: 'Listar todas as tabelas' },
          { method: 'GET', path: '/api/meta/endpoints', description: 'Listar todos os endpoints' }
        ]
      },
      {
        category: 'XML Import/Export',
        items: [
          { method: 'POST', path: '/api/xml/import', description: 'Importar dados via XML (cria tabela se necessario)', body: 'multipart/form-data com campo "file" ou JSON com campo "xml"' },
          { method: 'POST', path: '/api/xml/import-update', description: 'Importar XML com atualizacao (upsert). Use query param match_field', body: 'multipart/form-data com campo "file"' },
          { method: 'GET', path: '/api/xml/export/:table', description: 'Exportar tabela como XML' }
        ]
      },
      {
        category: 'Webhook Logs',
        items: [
          { method: 'GET', path: '/api/webhook/logs/all', description: 'Ver logs de webhooks recebidos' }
        ]
      }
    ];

    // Add per-table endpoints
    for (const t of metaTables.rows) {
      endpoints.push({
        category: `Tabela: ${t.display_name || t.table_name}`,
        table: t.table_name,
        items: [
          { method: 'GET', path: `/api/data/${t.table_name}`, description: `Listar registros. Params: page, limit, sort, order, search, ou filtros por coluna`, example: `${baseUrl}/api/data/${t.table_name}?page=1&limit=10&search=termo` },
          { method: 'GET', path: `/api/data/${t.table_name}/:id`, description: 'Buscar registro por ID' },
          { method: 'POST', path: `/api/data/${t.table_name}`, description: 'Criar novo registro', body: 'JSON com campos da tabela' },
          { method: 'PUT', path: `/api/data/${t.table_name}/:id`, description: 'Atualizar registro', body: 'JSON com campos a atualizar' },
          { method: 'DELETE', path: `/api/data/${t.table_name}/:id`, description: 'Deletar registro' },
          { method: 'POST', path: `/api/webhook/${t.table_name}`, description: 'Webhook: inserir ou atualizar registro. Envie match_field no body para upsert', body: '{ "match_field": "campo", "campo": "valor", ... }' },
          { method: 'POST', path: `/api/webhook/${t.table_name}/batch`, description: 'Webhook batch: inserir/atualizar multiplos registros', body: '{ "match_field": "campo", "records": [...] }' }
        ]
      });
    }

    res.json({ base_url: baseUrl, endpoints });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/meta/tables/:table - Drop a managed table
router.delete('/tables/:table', async (req, res) => {
  const pool = req.app.locals.pool;
  const { table } = req.params;

  try {
    await pool.query(`DROP TABLE IF EXISTS "${table}"`);
    await pool.query('DELETE FROM _meta_tables WHERE table_name = $1', [table]);
    res.json({ message: `Table "${table}" deleted` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
