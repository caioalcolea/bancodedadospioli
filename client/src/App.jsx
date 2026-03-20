import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import TableView from './pages/TableView'
import Endpoints from './pages/Endpoints'
import WebhookLogs from './pages/WebhookLogs'
import ImportExport from './pages/ImportExport'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="table/:tableName" element={<TableView />} />
        <Route path="endpoints" element={<Endpoints />} />
        <Route path="webhooks" element={<WebhookLogs />} />
        <Route path="import-export" element={<ImportExport />} />
      </Route>
    </Routes>
  )
}
