'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Database, Table2, Webhook, Activity, ArrowRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [tables, setTables] = useState([])
  const [health, setHealth] = useState(null)

  useEffect(() => {
    fetch('/api/meta/stats').then(r => r.json()).then(setStats).catch(() => {})
    fetch('/api/meta/tables').then(r => r.json()).then(setTables).catch(() => {})
    fetch('/api/health').then(r => r.json()).then(setHealth).catch(() => {})
  }, [])

  const statCards = stats ? [
    { label: 'Tabelas', value: stats.tables, icon: Table2, color: 'bg-blue-500' },
    { label: 'Total Registros', value: stats.total_records.toLocaleString('pt-BR'), icon: Database, color: 'bg-emerald-500' },
    { label: 'Webhooks Total', value: stats.total_webhooks.toLocaleString('pt-BR'), icon: Webhook, color: 'bg-purple-500' },
    { label: 'Webhooks 24h', value: stats.webhooks_24h.toLocaleString('pt-BR'), icon: Activity, color: 'bg-amber-500' },
  ] : []

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Visao geral do banco de dados</p>
      </div>

      {health && (
        <div className="flex items-center gap-2 text-sm">
          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          <span className="text-emerald-600 dark:text-emerald-400 font-medium">Sistema online</span>
          <span className="text-muted-foreground">-</span>
          <span className="text-muted-foreground">{new Date(health.timestamp).toLocaleString('pt-BR')}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, i) => {
          const Icon = card.icon
          return (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{card.label}</p>
                    <p className="text-3xl font-bold mt-1">{card.value}</p>
                  </div>
                  <div className={`w-12 h-12 ${card.color} rounded-xl flex items-center justify-center`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tabelas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {tables.length === 0 ? (
            <div className="p-12 text-center">
              <Database className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
              <p className="font-medium text-muted-foreground">Nenhuma tabela ainda</p>
              <p className="text-sm text-muted-foreground mt-1">Importe um XML para criar a primeira tabela</p>
              <Link href="/import-export">
                <Button className="mt-4">Importar dados</Button>
              </Link>
            </div>
          ) : (
            <div className="divide-y">
              {tables.map(t => (
                <Link
                  key={t.table_name}
                  href={`/table/${t.table_name}`}
                  className="flex items-center justify-between px-6 py-4 hover:bg-accent transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                      <Table2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="font-medium">{t.display_name || t.table_name}</p>
                      <p className="text-sm text-muted-foreground">{t.table_name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge variant="info">{t.row_count.toLocaleString('pt-BR')} registros</Badge>
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
