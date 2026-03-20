import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { Search, ChevronLeft, ChevronRight, Download, Pencil, Trash2, X, Save, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '../lib/api'

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
  const [loading, setLoading] = useState(true)

  const visibleColumns = columns.filter(c =>
    !['id', 'created_at', 'updated_at'].includes(c.column_name)
  )

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, limit: 25 }
      if (search) params.search = search
      const result = await api.getData(tableName, params)
      setData(result)
    } catch (err) {
      toast.error(err.message)
    }
    setLoading(false)
  }, [tableName, page, search])

  useEffect(() => {
    api.getTableColumns(tableName).then(setColumns).catch(() => {})
  }, [tableName])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    setPage(1)
    setSearch('')
    setEditingRow(null)
  }, [tableName])

  const handleSave = async (id) => {
    try {
      await api.updateRecord(tableName, id, editData)
      toast.success('Registro atualizado')
      setEditingRow(null)
      fetchData()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Tem certeza que deseja excluir este registro?')) return
    try {
      await api.deleteRecord(tableName, id)
      toast.success('Registro excluido')
      fetchData()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleCreate = async () => {
    try {
      await api.createRecord(tableName, newData)
      toast.success('Registro criado')
      setShowCreate(false)
      setNewData({})
      fetchData()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const { pagination } = data

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{tableName}</h1>
          <p className="text-gray-500 mt-1">{pagination.total || 0} registros</p>
        </div>
        <div className="flex items-center gap-2">
          <a href={api.exportXml(tableName)} className="btn-secondary" download>
            <Download className="w-4 h-4" /> XML
          </a>
          <button onClick={() => { setShowCreate(true); setNewData({}) }} className="btn-primary">
            <Plus className="w-4 h-4" /> Novo
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar em todos os campos..."
          className="input pl-10"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
        />
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Novo Registro</h3>
            <button onClick={() => setShowCreate(false)}><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {visibleColumns.map(col => (
              <div key={col.column_name}>
                <label className="block text-xs font-medium text-gray-500 mb-1">{col.column_name}</label>
                <input
                  className="input"
                  value={newData[col.column_name] || ''}
                  onChange={e => setNewData({ ...newData, [col.column_name]: e.target.value })}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-end mt-4 gap-2">
            <button onClick={() => setShowCreate(false)} className="btn-secondary">Cancelar</button>
            <button onClick={handleCreate} className="btn-primary"><Save className="w-4 h-4" /> Salvar</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">ID</th>
                {visibleColumns.slice(0, 10).map(col => (
                  <th key={col.column_name} className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">
                    {col.column_name}
                  </th>
                ))}
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={12} className="px-4 py-12 text-center text-gray-400">Carregando...</td></tr>
              ) : data.data.length === 0 ? (
                <tr><td colSpan={12} className="px-4 py-12 text-center text-gray-400">Nenhum registro encontrado</td></tr>
              ) : data.data.map(row => (
                <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-gray-500">{row.id}</td>
                  {visibleColumns.slice(0, 10).map(col => (
                    <td key={col.column_name} className="px-4 py-3 whitespace-nowrap max-w-[200px] truncate">
                      {editingRow === row.id ? (
                        <input
                          className="input py-1"
                          value={editData[col.column_name] ?? row[col.column_name] ?? ''}
                          onChange={e => setEditData({ ...editData, [col.column_name]: e.target.value })}
                        />
                      ) : (
                        <span className="text-gray-700">{row[col.column_name] ?? '-'}</span>
                      )}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {editingRow === row.id ? (
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => handleSave(row.id)} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg">
                          <Save className="w-4 h-4" />
                        </button>
                        <button onClick={() => setEditingRow(null)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => { setEditingRow(row.id); setEditData({}) }}
                          className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(row.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">
              Pagina {pagination.page} de {pagination.pages} ({pagination.total} registros)
            </p>
            <div className="flex items-center gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page >= pagination.pages}
                onClick={() => setPage(p => p + 1)}
                className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
