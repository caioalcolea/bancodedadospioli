import { useState, useEffect } from 'react'
import { Copy, Check, ChevronDown, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '../lib/api'

const methodColors = {
  GET: 'bg-green-100 text-green-700',
  POST: 'bg-blue-100 text-blue-700',
  PUT: 'bg-amber-100 text-amber-700',
  DELETE: 'bg-red-100 text-red-700',
}

export default function Endpoints() {
  const [endpoints, setEndpoints] = useState(null)
  const [expanded, setExpanded] = useState({})
  const [copied, setCopied] = useState(null)

  useEffect(() => {
    api.getEndpoints().then(setEndpoints).catch(err => toast.error(err.message))
  }, [])

  const toggleCategory = (idx) => {
    setExpanded(prev => ({ ...prev, [idx]: !prev[idx] }))
  }

  const copyUrl = (path) => {
    const url = endpoints?.base_url ? `${endpoints.base_url}${path}` : path
    navigator.clipboard.writeText(url)
    setCopied(path)
    toast.success('URL copiada!')
    setTimeout(() => setCopied(null), 2000)
  }

  if (!endpoints) return <div className="text-center py-12 text-gray-400">Carregando endpoints...</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Endpoints API</h1>
        <p className="text-gray-500 mt-1">Documentacao dos endpoints disponiveis para integracao MCP / Chatbot</p>
        <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg">
          <span className="text-sm font-mono text-gray-600">{endpoints.base_url}</span>
        </div>
      </div>

      <div className="space-y-3">
        {endpoints.endpoints.map((cat, idx) => {
          const isOpen = expanded[idx] !== false // default open
          return (
            <div key={idx} className="card overflow-hidden">
              <button
                onClick={() => toggleCategory(idx)}
                className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
              >
                <h2 className="font-semibold text-gray-900">{cat.category}</h2>
                <div className="flex items-center gap-2">
                  <span className="badge bg-gray-100 text-gray-600">{cat.items.length}</span>
                  {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-gray-100 divide-y divide-gray-50">
                  {cat.items.map((ep, epIdx) => (
                    <div key={epIdx} className="px-6 py-4">
                      <div className="flex items-start gap-3">
                        <span className={`badge ${methodColors[ep.method]} font-mono text-xs mt-0.5`}>
                          {ep.method}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <code className="text-sm font-mono text-gray-900 break-all">{ep.path}</code>
                            <button
                              onClick={() => copyUrl(ep.path)}
                              className="p-1 rounded hover:bg-gray-100 shrink-0"
                            >
                              {copied === ep.path
                                ? <Check className="w-3.5 h-3.5 text-green-500" />
                                : <Copy className="w-3.5 h-3.5 text-gray-400" />
                              }
                            </button>
                          </div>
                          <p className="text-sm text-gray-500 mt-1">{ep.description}</p>
                          {ep.body && (
                            <p className="text-xs text-gray-400 mt-1 font-mono">Body: {ep.body}</p>
                          )}
                          {ep.example && (
                            <p className="text-xs text-primary-600 mt-1 font-mono break-all">Exemplo: {ep.example}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
