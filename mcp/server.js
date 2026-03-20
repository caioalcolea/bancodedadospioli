import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'

const BASE_URL = process.env.PIOLI_API_URL || 'https://pioli.talkhub.me'
const API_KEY = process.env.PIOLI_API_KEY || ''

async function apiRequest(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (API_KEY) headers['x-api-key'] = API_KEY

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers: { ...headers, ...options.headers } })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

const server = new Server(
  { name: 'pioli-db', version: '1.0.0' },
  { capabilities: { tools: {}, resources: {} } }
)

// --- LIST TOOLS ---
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'search_records',
        description: 'Buscar registros em uma tabela do banco de dados Pioli. Permite busca por texto livre ou filtros por campo especifico. Use para encontrar planos, clientes, contratos.',
        inputSchema: {
          type: 'object',
          properties: {
            table: { type: 'string', description: 'Nome da tabela (ex: planos)' },
            search: { type: 'string', description: 'Texto para buscar em todos os campos' },
            filters: {
              type: 'object',
              description: 'Filtros por campo especifico (ex: {"cidade": "Rio Claro", "estado": "SP"})',
              additionalProperties: { type: 'string' }
            },
            page: { type: 'number', description: 'Pagina (default: 1)' },
            limit: { type: 'number', description: 'Registros por pagina (default: 20, max: 100)' },
            sort: { type: 'string', description: 'Campo para ordenar' },
            order: { type: 'string', enum: ['asc', 'desc'], description: 'Ordem (asc ou desc)' }
          },
          required: ['table']
        }
      },
      {
        name: 'get_record',
        description: 'Buscar um registro especifico por ID.',
        inputSchema: {
          type: 'object',
          properties: {
            table: { type: 'string', description: 'Nome da tabela' },
            id: { type: 'number', description: 'ID do registro' }
          },
          required: ['table', 'id']
        }
      },
      {
        name: 'create_record',
        description: 'Criar um novo registro em uma tabela.',
        inputSchema: {
          type: 'object',
          properties: {
            table: { type: 'string', description: 'Nome da tabela' },
            data: { type: 'object', description: 'Dados do registro (campos e valores)', additionalProperties: true }
          },
          required: ['table', 'data']
        }
      },
      {
        name: 'update_record',
        description: 'Atualizar um registro existente por ID.',
        inputSchema: {
          type: 'object',
          properties: {
            table: { type: 'string', description: 'Nome da tabela' },
            id: { type: 'number', description: 'ID do registro' },
            data: { type: 'object', description: 'Campos para atualizar', additionalProperties: true }
          },
          required: ['table', 'id', 'data']
        }
      },
      {
        name: 'delete_record',
        description: 'Deletar um registro por ID.',
        inputSchema: {
          type: 'object',
          properties: {
            table: { type: 'string', description: 'Nome da tabela' },
            id: { type: 'number', description: 'ID do registro' }
          },
          required: ['table', 'id']
        }
      },
      {
        name: 'list_tables',
        description: 'Listar todas as tabelas disponiveis no banco de dados e a quantidade de registros em cada uma.',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'get_table_columns',
        description: 'Ver as colunas/campos de uma tabela.',
        inputSchema: {
          type: 'object',
          properties: {
            table: { type: 'string', description: 'Nome da tabela' }
          },
          required: ['table']
        }
      },
      {
        name: 'get_stats',
        description: 'Obter estatisticas gerais do banco de dados (total de tabelas, registros, webhooks).',
        inputSchema: { type: 'object', properties: {} }
      }
    ]
  }
})

// --- CALL TOOL ---
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  try {
    let result

    switch (name) {
      case 'search_records': {
        const params = new URLSearchParams()
        params.set('page', String(args.page || 1))
        params.set('limit', String(Math.min(args.limit || 20, 100)))
        if (args.search) params.set('search', args.search)
        if (args.sort) params.set('sort', args.sort)
        if (args.order) params.set('order', args.order)
        if (args.filters) {
          for (const [key, value] of Object.entries(args.filters)) {
            params.set(key, value)
          }
        }
        result = await apiRequest(`/api/data/${args.table}?${params}`)
        break
      }

      case 'get_record':
        result = await apiRequest(`/api/data/${args.table}/${args.id}`)
        break

      case 'create_record':
        result = await apiRequest(`/api/data/${args.table}`, {
          method: 'POST', body: JSON.stringify(args.data)
        })
        break

      case 'update_record':
        result = await apiRequest(`/api/data/${args.table}/${args.id}`, {
          method: 'PUT', body: JSON.stringify(args.data)
        })
        break

      case 'delete_record':
        result = await apiRequest(`/api/data/${args.table}/${args.id}`, { method: 'DELETE' })
        break

      case 'list_tables':
        result = await apiRequest('/api/meta/tables')
        break

      case 'get_table_columns':
        result = await apiRequest(`/api/meta/tables/${args.table}/columns`)
        break

      case 'get_stats':
        result = await apiRequest('/api/meta/stats')
        break

      default:
        throw new Error(`Unknown tool: ${name}`)
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
    }
  } catch (err) {
    return {
      content: [{ type: 'text', text: `Error: ${err.message}` }],
      isError: true
    }
  }
})

// --- LIST RESOURCES ---
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  try {
    const tables = await apiRequest('/api/meta/tables')
    return {
      resources: tables.map(t => ({
        uri: `pioli://tables/${t.table_name}`,
        mimeType: 'application/json',
        name: t.display_name || t.table_name,
        description: `Tabela ${t.display_name || t.table_name} com ${t.row_count} registros`
      }))
    }
  } catch (err) {
    return { resources: [] }
  }
})

// --- READ RESOURCE ---
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params
  const match = uri.match(/^pioli:\/\/tables\/(.+)$/)

  if (!match) throw new Error(`Unknown resource: ${uri}`)

  const table = match[1]
  const [columns, data] = await Promise.all([
    apiRequest(`/api/meta/tables/${table}/columns`),
    apiRequest(`/api/data/${table}?limit=5`)
  ])

  const content = {
    table,
    columns: columns.map(c => ({ name: c.column_name, type: c.data_type })),
    sample_data: data.data,
    total_records: data.pagination.total
  }

  return {
    contents: [{
      uri,
      mimeType: 'application/json',
      text: JSON.stringify(content, null, 2)
    }]
  }
})

// --- START ---
async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('Pioli MCP Server running on stdio')
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
