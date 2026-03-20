import { NextResponse } from 'next/server'
import pool, { ensureInit, safeError } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

export async function GET(request) {
  const authErr = requireAuth(request)
  if (authErr) return authErr

  try {
    await ensureInit()
    const [tablesResult, webhooksResult, recentWebhooks, metaTables] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM _meta_tables'),
      pool.query('SELECT COUNT(*) FROM _webhook_logs'),
      pool.query("SELECT COUNT(*) FROM _webhook_logs WHERE created_at > NOW() - INTERVAL '24 hours'"),
      pool.query('SELECT table_name FROM _meta_tables')
    ])

    let totalRecords = 0
    for (const t of metaTables.rows) {
      try {
        const c = await pool.query(`SELECT COUNT(*) FROM "${t.table_name}"`)
        totalRecords += parseInt(c.rows[0].count)
      } catch (e) { /* ignore */ }
    }

    return NextResponse.json({
      tables: parseInt(tablesResult.rows[0].count),
      total_records: totalRecords,
      total_webhooks: parseInt(webhooksResult.rows[0].count),
      webhooks_24h: parseInt(recentWebhooks.rows[0].count)
    })
  } catch (err) {
    return NextResponse.json({ error: safeError(err) }, { status: 500 })
  }
}
