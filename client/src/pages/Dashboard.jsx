import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Database, Table2, Webhook, Activity, ArrowRight } from 'lucide-react'
import { api } from '../lib/api'

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [tables, setTables] = useState([])
  const [health, setHealth] = useState(null)

  useEffect(() => {
    api.getStats().then(setStats).catch(() => {})
    api.getTables().then(setTables).catch(() => {})
    api.getHealth().then(setHealth).catch(() => {})
  }, [])

  const statCards = stats ? [
    { label: 'Tabelas', value: stats.tables, icon: Table2, color: 'bg-blue-500' },
    { label: 'Total Registros', value: stats.total_records.toLocaleString('pt-BR'), icon: Database, color: 'bg-emerald-500' },
    { label: 'Webhooks Total', value: stats.total_webhooks.toLocaleString('pt-BR'), icon: Webhook, color: 'bg-purple-500' },
    { label: 'Webhooks 24h', value: stats.webhooks_24h.toLocaleString('pt-BR'), icon: Activity, color: 'bg-amber-500' },
  ] : []

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Visao geral do banco de dados</p>
      </div>

      {/* Health status */}
      {health && (
        <div className="flex items-center gap-2 text-sm">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-green-700 font-medium">Sistema online</span>
          <span className="text-gray-400">-</span>
          <span className="text-gray-500">{new Date(health.timestamp).toLocaleString('pt-BR')}</span>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, i) => {
          const Icon = card.icon
          return (
            <div key={i} className="card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">{card.label}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{card.value}</p>
                </div>
                <div className={`w-12 h-12 ${card.color} rounded-xl flex items-center justify-center`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Tables list */}
      <div className="card">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Tabelas</h2>
        </div>
        {tables.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <Database className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">Nenhuma tabela ainda</p>
            <p className="text-sm mt-1">Importe um XML para criar a primeira tabela</p>
            <Link to="/import-export" className="btn-primary mt-4 inline-flex">
              Importar dados
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {tables.map(t => (
              <Link
                key={t.table_name}
                to={`/table/${t.table_name}`}
                className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center">
                    <Table2 className="w-5 h-5 text-primary-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{t.display_name || t.table_name}</p>
                    <p className="text-sm text-gray-500">{t.table_name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="badge bg-primary-50 text-primary-700">
                    {t.row_count.toLocaleString('pt-BR')} registros
                  </span>
                  <ArrowRight className="w-4 h-4 text-gray-400" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
