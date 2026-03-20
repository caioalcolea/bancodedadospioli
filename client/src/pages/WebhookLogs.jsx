import { useState, useEffect } from 'react'
import { Webhook, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import { api } from '../lib/api'

const statusColors = {
  success: 'bg-green-100 text-green-700',
  error: 'bg-red-100 text-red-700',
}

const actionColors = {
  insert: 'bg-blue-100 text-blue-700',
  update: 'bg-amber-100 text-amber-700',
  batch: 'bg-purple-100 text-purple-700',
  error: 'bg-red-100 text-red-700',
  upsert: 'bg-teal-100 text-teal-700',
}

export default function WebhookLogs() {
  const [logs, setLogs] = useState({ data: [], pagination: {} })
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const result = await api.getWebhookLogs({ page, limit: 30 })
      setLogs(result)
    } catch (e) { /* ignore */ }
    setLoading(false)
  }

  useEffect(() => { fetchLogs() }, [page])

  const { pagination } = logs

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Webhook Logs</h1>
          <p className="text-gray-500 mt-1">Historico de webhooks recebidos</p>
        </div>
        <button onClick={fetchLogs} className="btn-secondary">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Data</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Tabela</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Acao</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">IP</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Erro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">Carregando...</td></tr>
              ) : logs.data.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <Webhook className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                    <p className="text-gray-400">Nenhum webhook recebido ainda</p>
                  </td>
                </tr>
              ) : logs.data.map(log => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap text-gray-500 text-xs">
                    {new Date(log.created_at).toLocaleString('pt-BR')}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">{log.table_name}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${actionColors[log.action] || 'bg-gray-100 text-gray-600'}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${statusColors[log.status] || 'bg-gray-100 text-gray-600'}`}>
                      {log.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{log.ip_address}</td>
                  <td className="px-4 py-3 text-red-600 text-xs max-w-[200px] truncate">{log.error_message || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {pagination.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">
              Pagina {pagination.page} de {pagination.pages}
            </p>
            <div className="flex items-center gap-1">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button disabled={page >= pagination.pages} onClick={() => setPage(p => p + 1)} className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
