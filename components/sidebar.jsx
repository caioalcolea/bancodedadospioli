'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Database, LayoutDashboard, Webhook, FileCode,
  ArrowRightLeft, Menu, X, Table2, Moon, Sun
} from 'lucide-react'
import { Button } from '@/components/ui/button'

const navItems = [
  { href: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/endpoints', icon: FileCode, label: 'Endpoints API' },
  { href: '/webhooks', icon: Webhook, label: 'Webhook Logs' },
  { href: '/import-export', icon: ArrowRightLeft, label: 'Import / Export' },
]

export default function Sidebar() {
  const [tables, setTables] = useState([])
  const [open, setOpen] = useState(false)
  const [dark, setDark] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    fetch('/api/meta/tables').then(r => r.json()).then(setTables).catch(() => {})
  }, [pathname])

  useEffect(() => {
    const saved = localStorage.getItem('theme')
    if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setDark(true)
      document.documentElement.classList.add('dark')
    }
  }, [])

  const toggleDark = () => {
    setDark(!dark)
    document.documentElement.classList.toggle('dark')
    localStorage.setItem('theme', dark ? 'light' : 'dark')
  }

  return (
    <>
      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between p-4 bg-background border-b">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-blue-600" />
          <span className="font-bold">Pioli DB</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={toggleDark}>
            {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setOpen(!open)}>
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
      </div>

      {/* Overlay */}
      {open && <div className="fixed inset-0 bg-black/20 z-40 lg:hidden" onClick={() => setOpen(false)} />}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-background border-r flex flex-col",
        "transform transition-transform duration-200",
        "lg:translate-x-0 lg:static",
        open ? 'translate-x-0' : '-translate-x-full'
      )}>
        {/* Logo */}
        <div className="hidden lg:flex items-center gap-3 p-6 border-b">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shrink-0">
            <Database className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg">Pioli DB</h1>
            <p className="text-xs text-muted-foreground">Banco de Dados</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto mt-16 lg:mt-0">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-2">Menu</p>
          {navItems.map(item => {
            const Icon = item.icon
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            )
          })}

          {tables.length > 0 && (
            <>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mt-6 mb-2">Tabelas</p>
              {tables.map(t => {
                const active = pathname === `/table/${t.table_name}`
                return (
                  <Link
                    key={t.table_name}
                    href={`/table/${t.table_name}`}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                      active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <Table2 className="w-4 h-4" />
                      {t.display_name || t.table_name}
                    </span>
                    <span className="text-xs opacity-70">{t.row_count}</span>
                  </Link>
                )
              })}
            </>
          )}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Pioli DB v1.0</p>
          <Button variant="ghost" size="icon" onClick={toggleDark} className="hidden lg:flex">
            {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
        </div>
      </aside>
    </>
  )
}
