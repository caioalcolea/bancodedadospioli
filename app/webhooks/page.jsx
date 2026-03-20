'use client'

import { useState, useEffect } from 'react'
import { Webhook, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const statusColors = { success: 'success', error: 'destructive' }
const actionColors = { insert: 'info', update: 'warning', batch: 'secondary', error: 'destructive', upsert: 'success' }

export default function WebhookLogs() {
  const [logs, setLogs] = useState({ data: [], pagination: {} })
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/webhook/logs?page=${page}&limit=30`)
      const result = await res.json()
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
          <h1 className="text-3xl font-bold tracking-tight">Webhook Logs</h1>
          <p className="text-muted-foreground mt-1">Historico de webhooks recebidos</p>
        </div>
        <Button variant="outline" onClick={fetchLogs}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Data</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Tabela</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Acao</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">IP</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Erro</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">Carregando...</td></tr>
              ) : logs.data.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <Webhook className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
                    <p className="text-muted-foreground">Nenhum webhook recebido ainda</p>
                  </td>
                </tr>
              ) : logs.data.map(log => (
                <tr key={log.id} className="hover:bg-muted/50">
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground text-xs">
                    {new Date(log.created_at).toLocaleString('pt-BR')}
                  </td>
                  <td className="px-4 py-3 font-medium">{log.table_name}</td>
                  <td className="px-4 py-3">
                    <Badge variant={actionColors[log.action] || 'secondary'}>{log.action}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={statusColors[log.status] || 'secondary'}>{log.status}</Badge>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{log.ip_address}</td>
                  <td className="px-4 py-3 text-destructive text-xs max-w-[200px] truncate">{log.error_message || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {pagination.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <p className="text-sm text-muted-foreground">Pagina {pagination.page} de {pagination.pages}</p>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="h-8 w-8">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="icon" disabled={page >= pagination.pages} onClick={() => setPage(p => p + 1)} className="h-8 w-8">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
