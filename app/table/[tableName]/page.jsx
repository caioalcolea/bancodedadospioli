'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { Search, ChevronLeft, ChevronRight, Download, Pencil, Trash2, X, Save, Plus, Eye } from 'lucide-react'
import toast from 'react-hot-toast'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

export default function TableView() {
  const { tableName } = useParams()
  const [data, setData] = useState({ data: [], pagination: {} })
  const [columns, setColumns] = useState([])
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [editingRow, setEditingRow] = useState(null)
  const [editData, setEditData] = useState({})
  const [showCreate, setShowCreate] = useState(false)
  const [newData, setNewData] = useState({})
  const [detailRow, setDetailRow] = useState(null)
  const [loading, setLoading] = useState(true)

  const visibleColumns = columns.filter(c =>
    !['id', 'created_at', 'updated_at'].includes(c.column_name)
  )

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page, limit: 25 })
      if (search) params.set('search', search)
      const res = await fetch(`/api/data/${tableName}?${params}`)
      const result = await res.json()
      setData(result)
    } catch (err) {
      toast.error(err.message)
    }
    setLoading(false)
  }, [tableName, page, search])

  useEffect(() => {
    fetch(`/api/meta/tables/${tableName}/columns`).then(r => r.json()).then(setColumns).catch(() => {})
  }, [tableName])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => { setPage(1); setSearch(''); setEditingRow(null); setDetailRow(null) }, [tableName])

  const handleSave = async (id) => {
    try {
      await fetch(`/api/data/${tableName}/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData)
      })
      toast.success('Registro atualizado')
      setEditingRow(null)
      fetchData()
    } catch (err) { toast.error(err.message) }
  }

  const handleDelete = async (id) => {
    if (!confirm('Tem certeza que deseja excluir este registro?')) return
    try {
      await fetch(`/api/data/${tableName}/${id}`, { method: 'DELETE' })
      toast.success('Registro excluido')
      fetchData()
    } catch (err) { toast.error(err.message) }
  }

  const handleCreate = async () => {
    try {
      await fetch(`/api/data/${tableName}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newData)
      })
      toast.success('Registro criado')
      setShowCreate(false)
      setNewData({})
      fetchData()
    } catch (err) { toast.error(err.message) }
  }

  const { pagination } = data

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{tableName}</h1>
          <p className="text-muted-foreground mt-1">{pagination.total || 0} registros</p>
        </div>
        <div className="flex items-center gap-2">
          <a href={`/api/xml/export/${tableName}`} download>
            <Button variant="outline"><Download className="w-4 h-4" /> XML</Button>
          </a>
          <Button onClick={() => { setShowCreate(true); setNewData({}) }}>
            <Plus className="w-4 h-4" /> Novo
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar em todos os campos..."
          className="pl-10"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
        />
      </div>

      {showCreate && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Novo Registro</h3>
              <Button variant="ghost" size="icon" onClick={() => setShowCreate(false)}><X className="w-4 h-4" /></Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {visibleColumns.map(col => (
                <div key={col.column_name}>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">{col.column_name}</label>
                  <Input
                    value={newData[col.column_name] || ''}
                    onChange={e => setNewData({ ...newData, [col.column_name]: e.target.value })}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end mt-4 gap-2">
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
              <Button onClick={handleCreate}><Save className="w-4 h-4" /> Salvar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {detailRow && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Detalhes do Registro #{detailRow.id}</h3>
              <Button variant="ghost" size="icon" onClick={() => setDetailRow(null)}><X className="w-4 h-4" /></Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {visibleColumns.map(col => (
                <div key={col.column_name}>
                  <p className="text-xs font-medium text-muted-foreground">{col.column_name}</p>
                  <p className="mt-0.5 text-sm break-all">{detailRow[col.column_name] ?? '-'}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap">ID</th>
                {visibleColumns.slice(0, 8).map(col => (
                  <th key={col.column_name} className="text-left px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap">
                    {col.column_name}
                  </th>
                ))}
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr><td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">Carregando...</td></tr>
              ) : data.data.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">Nenhum registro encontrado</td></tr>
              ) : data.data.map(row => (
                <tr key={row.id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-4 py-3 font-mono text-muted-foreground text-xs">{row.id}</td>
                  {visibleColumns.slice(0, 8).map(col => (
                    <td key={col.column_name} className="px-4 py-3 whitespace-nowrap max-w-[180px] truncate">
                      {editingRow === row.id ? (
                        <Input
                          className="h-7 text-xs"
                          value={editData[col.column_name] ?? row[col.column_name] ?? ''}
                          onChange={e => setEditData({ ...editData, [col.column_name]: e.target.value })}
                        />
                      ) : (
                        <span>{row[col.column_name] ?? '-'}</span>
                      )}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {editingRow === row.id ? (
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleSave(row.id)} className="h-7 w-7 text-emerald-600">
                          <Save className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setEditingRow(null)} className="h-7 w-7">
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setDetailRow(row)} className="h-7 w-7">
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => { setEditingRow(row.id); setEditData({}) }} className="h-7 w-7">
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(row.id)} className="h-7 w-7 text-destructive">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {pagination.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <p className="text-sm text-muted-foreground">
              Pagina {pagination.page} de {pagination.pages} ({pagination.total} registros)
            </p>
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
