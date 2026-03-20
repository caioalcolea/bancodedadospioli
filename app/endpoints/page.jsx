'use client'

import { useState, useEffect } from 'react'
import { Copy, Check, ChevronDown, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const methodColors = {
  GET: 'success',
  POST: 'info',
  PUT: 'warning',
  DELETE: 'destructive',
}

export default function Endpoints() {
  const [endpoints, setEndpoints] = useState(null)
  const [expanded, setExpanded] = useState({})
  const [copied, setCopied] = useState(null)

  useEffect(() => {
    fetch('/api/meta/endpoints').then(r => r.json()).then(setEndpoints).catch(err => toast.error(err.message))
  }, [])

  const toggleCategory = (idx) => setExpanded(prev => ({ ...prev, [idx]: !prev[idx] }))

  const copyUrl = (path) => {
    const url = endpoints?.base_url ? `${endpoints.base_url}${path}` : path
    navigator.clipboard.writeText(url)
    setCopied(path)
    toast.success('URL copiada!')
    setTimeout(() => setCopied(null), 2000)
  }

  if (!endpoints) return <div className="text-center py-12 text-muted-foreground">Carregando endpoints...</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Endpoints API</h1>
        <p className="text-muted-foreground mt-1">Documentacao dos endpoints para integracao MCP / Chatbot</p>
        <div className="mt-3">
          <Badge variant="secondary" className="font-mono text-sm px-3 py-1">{endpoints.base_url}</Badge>
        </div>
      </div>

      <div className="space-y-3">
        {endpoints.endpoints.map((cat, idx) => {
          const isOpen = expanded[idx] !== false
          return (
            <Card key={idx} className="overflow-hidden">
              <button
                onClick={() => toggleCategory(idx)}
                className="w-full flex items-center justify-between px-6 py-4 hover:bg-accent transition-colors text-left"
              >
                <h2 className="font-semibold">{cat.category}</h2>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{cat.items.length}</Badge>
                  {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                </div>
              </button>

              {isOpen && (
                <div className="border-t divide-y">
                  {cat.items.map((ep, epIdx) => (
                    <div key={epIdx} className="px-6 py-4">
                      <div className="flex items-start gap-3">
                        <Badge variant={methodColors[ep.method] || 'secondary'} className="font-mono text-xs mt-0.5 shrink-0">
                          {ep.method}
                        </Badge>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <code className="text-sm font-mono break-all">{ep.path}</code>
                            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => copyUrl(ep.path)}>
                              {copied === ep.path
                                ? <Check className="w-3 h-3 text-emerald-500" />
                                : <Copy className="w-3 h-3 text-muted-foreground" />
                              }
                            </Button>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{ep.description}</p>
                          {ep.body && (
                            <p className="text-xs text-muted-foreground mt-1 font-mono">Body: {ep.body}</p>
                          )}
                          {ep.example && (
                            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 font-mono break-all">Ex: {ep.example}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
