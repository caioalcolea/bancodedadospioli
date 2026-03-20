import { useState, useEffect } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { Database, LayoutDashboard, Webhook, FileCode, ArrowRightLeft, Menu, X, Table2 } from 'lucide-react'
import { api } from '../lib/api'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/endpoints', icon: FileCode, label: 'Endpoints API' },
  { to: '/webhooks', icon: Webhook, label: 'Webhook Logs' },
  { to: '/import-export', icon: ArrowRightLeft, label: 'Import / Export' },
]

export default function Layout() {
  const [tables, setTables] = useState([])
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    api.getTables().then(setTables).catch(() => {})
  }, [location.pathname])

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile header */}
      <div className="lg:hidden flex items-center justify-between p-4 bg-white border-b">
        <div className="flex items-center gap-2">
          <Database className="w-6 h-6 text-primary-600" />
          <span className="font-bold text-gray-900">BD Pioli</span>
        </div>
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2">
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <aside className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200
          transform transition-transform duration-200 ease-in-out
          lg:translate-x-0 lg:static lg:inset-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
          <div className="flex flex-col h-full">
            {/* Logo */}
            <div className="hidden lg:flex items-center gap-3 p-6 border-b">
              <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center">
                <Database className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-gray-900 text-lg">BD Pioli</h1>
                <p className="text-xs text-gray-500">Banco de Dados</p>
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2">Menu</p>
              {navItems.map(item => {
                const Icon = item.icon
                const active = location.pathname === item.to
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                      ${active
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                      }`}
                  >
                    <Icon className="w-4.5 h-4.5" />
                    {item.label}
                  </Link>
                )
              })}

              {tables.length > 0 && (
                <>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mt-6 mb-2">Tabelas</p>
                  {tables.map(t => {
                    const active = location.pathname === `/table/${t.table_name}`
                    return (
                      <Link
                        key={t.table_name}
                        to={`/table/${t.table_name}`}
                        onClick={() => setSidebarOpen(false)}
                        className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                          ${active
                            ? 'bg-primary-50 text-primary-700'
                            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                          }`}
                      >
                        <span className="flex items-center gap-3">
                          <Table2 className="w-4 h-4" />
                          {t.display_name || t.table_name}
                        </span>
                        <span className="badge bg-gray-100 text-gray-600">{t.row_count}</span>
                      </Link>
                    )
                  })}
                </>
              )}
            </nav>

            {/* Footer */}
            <div className="p-4 border-t">
              <p className="text-xs text-gray-400 text-center">Banco de Dados Pioli v1.0</p>
            </div>
          </div>
        </aside>

        {/* Overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 bg-black/20 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Main content */}
        <main className="flex-1 min-h-screen lg:min-h-0">
          <div className="p-4 lg:p-8 max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
