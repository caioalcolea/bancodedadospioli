import { NextResponse } from 'next/server'
import pool, { ensureInit } from '@/lib/db'

export async function GET() {
  try {
    await ensureInit()
    const tablesResult = await pool.query('SELECT COUNT(*) FROM _meta_tables')
    const webhooksResult = await pool.query('SELECT COUNT(*) FROM _webhook_logs')
    const recentWebhooks = await pool.query(
      "SELECT COUNT(*) FROM _webhook_logs WHERE created_at > NOW() - INTERVAL '24 hours'"
    )

    let totalRecords = 0
    const metaTables = await pool.query('SELECT table_name FROM _meta_tables')
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
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
