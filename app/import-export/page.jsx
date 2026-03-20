'use client'

import { useState, useEffect, useRef } from 'react'
import { Upload, Download, FileUp, AlertCircle, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

export default function ImportExport() {
  const [tables, setTables] = useState([])
  const [importMode, setImportMode] = useState('create')
  const [matchField, setMatchField] = useState('')
  const [result, setResult] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [fileName, setFileName] = useState('')
  const fileRef = useRef()

  useEffect(() => {
    fetch('/api/meta/tables').then(r => r.json()).then(setTables).catch(() => {})
  }, [result])

  const handleFileChange = () => {
    const file = fileRef.current?.files[0]
    setFileName(file ? file.name : '')
  }

  const handleImport = async () => {
    const file = fileRef.current?.files[0]
    if (!file) return toast.error('Selecione um arquivo XML')

    setUploading(true)
    setResult(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      if (importMode === 'update' && matchField) formData.append('match_field', matchField)

      const url = importMode === 'update' ? '/api/xml/import-update' : '/api/xml/import'
      const res = await fetch(url, { method: 'POST', body: formData })
      const data = await res.json()
      setResult(data)
      if (data.success) toast.success('Importacao concluida!')
      else toast.error(data.error || 'Erro na importacao')
    } catch (err) {
      toast.error(err.message)
    }
    setUploading(false)
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Importar / Exportar</h1>
        <p className="text-muted-foreground mt-1">Gerencie dados via arquivos XML</p>
      </div>

      {/* Import */}
      <Card>
        <CardContent className="p-6 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
              <Upload className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="font-semibold">Importar XML</h2>
              <p className="text-sm text-muted-foreground">Envie um arquivo XML para criar ou atualizar tabelas</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={() => setImportMode('create')}
              className={`p-4 rounded-lg border-2 text-left transition-colors ${
                importMode === 'create'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                  : 'border-border hover:border-muted-foreground/30'
              }`}
            >
              <p className="font-medium">Criar / Inserir</p>
              <p className="text-xs text-muted-foreground mt-1">Cria a tabela (se nao existir) e insere todos os registros</p>
            </button>
            <button
              onClick={() => setImportMode('update')}
              className={`p-4 rounded-lg border-2 text-left transition-colors ${
                importMode === 'update'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                  : 'border-border hover:border-muted-foreground/30'
              }`}
            >
              <p className="font-medium">Atualizar (Upsert)</p>
              <p className="text-xs text-muted-foreground mt-1">Atualiza registros existentes por campo de correspondencia</p>
            </button>
          </div>

          {importMode === 'update' && (
            <div>
              <label className="block text-sm font-medium mb-1">Campo de correspondencia</label>
              <Input
                className="max-w-xs"
                placeholder="Ex: codigo, cgc, email..."
                value={matchField}
                onChange={e => setMatchField(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">Deixe vazio para usar a primeira coluna</p>
            </div>
          )}

          <div
            className="border-2 border-dashed rounded-lg p-8 text-center hover:border-blue-400 transition-colors cursor-pointer"
            onClick={() => fileRef.current?.click()}
          >
            <FileUp className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <input ref={fileRef} type="file" accept=".xml" className="hidden" onChange={handleFileChange} />
            {fileName ? (
              <p className="text-sm font-medium">{fileName}</p>
            ) : (
              <>
                <Button variant="outline" type="button">Selecionar arquivo XML</Button>
                <p className="text-xs text-muted-foreground mt-2">Formato: .xml (max 50MB)</p>
              </>
            )}
          </div>

          <Button onClick={handleImport} disabled={uploading} className="w-full">
            {uploading ? 'Importando...' : 'Importar'}
          </Button>

          {result && (
            <div className={`p-4 rounded-lg border ${result.success ? 'bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800' : 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'}`}>
              <div className="flex items-start gap-3">
                {result.success ? <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5" /> : <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />}
                <div>
                  <p className="font-medium">{result.success ? 'Importacao concluida' : 'Erro'}</p>
                  {result.tables?.map((t, i) => (
                    <p key={i} className="text-sm text-muted-foreground mt-1">
                      Tabela <strong>{t.table}</strong>:
                      {t.rows_inserted !== undefined && ` ${t.rows_inserted} inseridos`}
                      {t.inserted !== undefined && ` ${t.inserted} inseridos`}
                      {t.updated !== undefined && `, ${t.updated} atualizados`}
                      {t.columns !== undefined && ` (${t.columns} colunas)`}
                    </p>
                  ))}
                  {result.error && <p className="text-sm text-destructive mt-1">{result.error}</p>}
                </div>
              </div>
            </div>
          )}

          <details className="text-sm">
            <summary className="cursor-pointer text-blue-600 dark:text-blue-400 font-medium">Ver formato XML esperado</summary>
            <pre className="mt-2 p-4 bg-muted rounded-lg overflow-x-auto text-xs">{`<?xml version="1.0" encoding="UTF-8"?>
<database>
  <table name="planos" display_name="Planos de Saude">
    <columns>
      <column name="codigo" type="text"/>
      <column name="nome" type="text"/>
      <column name="cidade" type="text"/>
      <column name="email" type="text"/>
      <column name="fone" type="text"/>
    </columns>
    <rows>
      <row>
        <codigo>56</codigo>
        <nome>Julio Reis</nome>
        <cidade>Rio Claro</cidade>
        <email>julio@email.com</email>
        <fone>(19) 99205-3515</fone>
      </row>
    </rows>
  </table>
</database>`}</pre>
          </details>
        </CardContent>
      </Card>

      {/* Export */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900 rounded-lg flex items-center justify-center">
              <Download className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h2 className="font-semibold">Exportar XML</h2>
              <p className="text-sm text-muted-foreground">Baixe os dados de uma tabela em formato XML</p>
            </div>
          </div>

          {tables.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhuma tabela disponivel</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {tables.map(t => (
                <a
                  key={t.table_name}
                  href={`/api/xml/export/${t.table_name}`}
                  download
                  className="flex items-center justify-between p-4 rounded-lg border hover:border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950 transition-colors"
                >
                  <div>
                    <p className="font-medium">{t.display_name || t.table_name}</p>
                    <p className="text-xs text-muted-foreground">{t.row_count} registros</p>
                  </div>
                  <Download className="w-4 h-4 text-emerald-600" />
                </a>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
