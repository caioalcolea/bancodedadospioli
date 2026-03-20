import { useState, useEffect, useRef } from 'react'
import { Upload, Download, FileUp, AlertCircle, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '../lib/api'

export default function ImportExport() {
  const [tables, setTables] = useState([])
  const [importMode, setImportMode] = useState('create') // 'create' or 'update'
  const [matchField, setMatchField] = useState('')
  const [result, setResult] = useState(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef()

  useEffect(() => {
    api.getTables().then(setTables).catch(() => {})
  }, [result])

  const handleImport = async () => {
    const file = fileRef.current?.files[0]
    if (!file) return toast.error('Selecione um arquivo XML')

    setUploading(true)
    setResult(null)
    try {
      let res
      if (importMode === 'update') {
        res = await api.importUpdateXml(file, matchField)
      } else {
        res = await api.importXml(file)
      }
      setResult(res)
      if (res.success) toast.success('Importacao concluida!')
      else toast.error(res.error || 'Erro na importacao')
    } catch (err) {
      toast.error(err.message)
    }
    setUploading(false)
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Importar / Exportar</h1>
        <p className="text-gray-500 mt-1">Gerencie dados via arquivos XML</p>
      </div>

      {/* Import Section */}
      <div className="card p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
            <Upload className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">Importar XML</h2>
            <p className="text-sm text-gray-500">Envie um arquivo XML para criar ou atualizar tabelas</p>
          </div>
        </div>

        {/* Import mode */}
        <div className="flex gap-3">
          <button
            onClick={() => setImportMode('create')}
            className={`flex-1 p-4 rounded-lg border-2 text-left transition-colors ${
              importMode === 'create'
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <p className="font-medium text-gray-900">Criar / Inserir</p>
            <p className="text-xs text-gray-500 mt-1">Cria a tabela (se nao existir) e insere todos os registros</p>
          </button>
          <button
            onClick={() => setImportMode('update')}
            className={`flex-1 p-4 rounded-lg border-2 text-left transition-colors ${
              importMode === 'update'
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <p className="font-medium text-gray-900">Atualizar (Upsert)</p>
            <p className="text-xs text-gray-500 mt-1">Atualiza registros existentes por campo de correspondencia ou insere novos</p>
          </button>
        </div>

        {importMode === 'update' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Campo de correspondencia (match_field)</label>
            <input
              className="input max-w-xs"
              placeholder="Ex: codigo, cgc, email..."
              value={matchField}
              onChange={e => setMatchField(e.target.value)}
            />
            <p className="text-xs text-gray-400 mt-1">Deixe vazio para usar a primeira coluna</p>
          </div>
        )}

        {/* File upload */}
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-primary-400 transition-colors">
          <FileUp className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <input ref={fileRef} type="file" accept=".xml" className="hidden" id="xml-file" />
          <label htmlFor="xml-file" className="btn-secondary cursor-pointer">
            Selecionar arquivo XML
          </label>
          <p className="text-xs text-gray-400 mt-2">Formato: .xml (max 50MB)</p>
        </div>

        <button onClick={handleImport} disabled={uploading} className="btn-primary w-full justify-center">
          {uploading ? 'Importando...' : 'Importar'}
        </button>

        {/* Result */}
        {result && (
          <div className={`p-4 rounded-lg ${result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <div className="flex items-start gap-3">
              {result.success
                ? <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                : <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
              }
              <div>
                <p className="font-medium text-gray-900">{result.success ? 'Importacao concluida' : 'Erro'}</p>
                {result.tables?.map((t, i) => (
                  <p key={i} className="text-sm text-gray-600 mt-1">
                    Tabela <strong>{t.table}</strong>:
                    {t.rows_inserted !== undefined && ` ${t.rows_inserted} inseridos`}
                    {t.inserted !== undefined && ` ${t.inserted} inseridos`}
                    {t.updated !== undefined && `, ${t.updated} atualizados`}
                    {t.columns !== undefined && ` (${t.columns} colunas)`}
                  </p>
                ))}
                {result.error && <p className="text-sm text-red-600 mt-1">{result.error}</p>}
              </div>
            </div>
          </div>
        )}

        {/* XML format example */}
        <details className="text-sm">
          <summary className="cursor-pointer text-primary-600 font-medium">Ver formato XML esperado</summary>
          <pre className="mt-2 p-4 bg-gray-900 text-green-400 rounded-lg overflow-x-auto text-xs">{`<?xml version="1.0" encoding="UTF-8"?>
<database>
  <table name="planos" display_name="Planos de Saude">
    <columns>
      <column name="codigo" type="text"/>
      <column name="nome" type="text"/>
      <column name="endereco" type="text"/>
      <column name="bairro" type="text"/>
      <column name="cep" type="text"/>
      <column name="cidade" type="text"/>
      <column name="estado" type="text"/>
      <column name="cgc" type="text"/>
      <column name="email" type="text"/>
      <column name="fone" type="text"/>
      <column name="pagamento" type="text"/>
      <column name="codplano" type="text"/>
      <column name="nomeplano" type="text"/>
    </columns>
    <rows>
      <row>
        <codigo>56</codigo>
        <nome>Julio Reis</nome>
        <endereco>Avenida 4, 336</endereco>
        <!-- ... mais campos ... -->
      </row>
    </rows>
  </table>
</database>`}</pre>
        </details>
      </div>

      {/* Export Section */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
            <Download className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">Exportar XML</h2>
            <p className="text-sm text-gray-500">Baixe os dados de uma tabela em formato XML</p>
          </div>
        </div>

        {tables.length === 0 ? (
          <p className="text-gray-400 text-sm">Nenhuma tabela disponivel para exportar</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {tables.map(t => (
              <a
                key={t.table_name}
                href={api.exportXml(t.table_name)}
                download
                className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:border-emerald-300 hover:bg-emerald-50 transition-colors"
              >
                <div>
                  <p className="font-medium text-gray-900">{t.display_name || t.table_name}</p>
                  <p className="text-xs text-gray-500">{t.row_count} registros</p>
                </div>
                <Download className="w-4 h-4 text-emerald-600" />
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
