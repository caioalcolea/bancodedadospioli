import { NextResponse } from 'next/server'
import pool, { ensureInit, safeError } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

export async function GET(request) {
  const authErr = requireAuth(request)
  if (authErr) return authErr

  try {
    await ensureInit()
    const metaTables = await pool.query('SELECT table_name, display_name FROM _meta_tables')
    const baseUrl = new URL(request.url).origin

    const endpoints = [
      {
        category: 'Sistema',
        items: [
          { method: 'GET', path: '/api/health', description: 'Health check do sistema (sem autenticacao)' },
          { method: 'GET', path: '/api/meta/stats', description: 'Estatisticas gerais' },
          { method: 'GET', path: '/api/meta/tables', description: 'Listar todas as tabelas gerenciadas' },
          { method: 'GET', path: '/api/meta/endpoints', description: 'Listar todos os endpoints disponiveis' },
        ]
      },
      {
        category: 'XML Import/Export',
        items: [
          { method: 'POST', path: '/api/xml/import', description: 'Importar dados via XML (cria tabela se necessario)', body: 'multipart/form-data com campo "file"' },
          { method: 'POST', path: '/api/xml/import-update', description: 'Importar XML com atualizacao (upsert). Query param: match_field', body: 'multipart/form-data com campo "file"' },
          { method: 'GET', path: '/api/xml/export/:table', description: 'Exportar tabela como XML' },
        ]
      },
      {
        category: 'Webhook Logs',
        items: [
          { method: 'GET', path: '/api/webhook/logs', description: 'Ver logs de webhooks recebidos. Params: page, limit' },
        ]
      },
    ]

    for (const t of metaTables.rows) {
      endpoints.push({
        category: `Tabela: ${t.display_name || t.table_name}`,
        table: t.table_name,
        items: [
          { method: 'GET', path: `/api/data/${t.table_name}`, description: 'Listar registros. Params: page, limit, sort, order, search, ou filtros por coluna', example: `${baseUrl}/api/data/${t.table_name}?page=1&limit=10&search=termo` },
          { method: 'GET', path: `/api/data/${t.table_name}/:id`, description: 'Buscar registro por ID' },
          { method: 'POST', path: `/api/data/${t.table_name}`, description: 'Criar novo registro', body: 'JSON com campos da tabela' },
          { method: 'PUT', path: `/api/data/${t.table_name}/:id`, description: 'Atualizar registro', body: 'JSON com campos a atualizar' },
          { method: 'DELETE', path: `/api/data/${t.table_name}/:id`, description: 'Deletar registro' },
          { method: 'POST', path: `/api/webhook/${t.table_name}`, description: 'Webhook: inserir ou atualizar. Envie match_field para upsert', body: '{ "match_field": "campo", "campo": "valor", ... }' },
          { method: 'POST', path: `/api/webhook/${t.table_name}/batch`, description: 'Webhook batch (max 1000 registros)', body: '{ "match_field": "campo", "records": [...] }' },
        ]
      })
    }

    return NextResponse.json({ base_url: baseUrl, endpoints })
  } catch (err) {
    return NextResponse.json({ error: safeError(err) }, { status: 500 })
  }
}
