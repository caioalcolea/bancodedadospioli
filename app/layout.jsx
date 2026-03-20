import './globals.css'
import { Toaster } from 'react-hot-toast'
import Sidebar from '@/components/sidebar'

export const metadata = {
  title: 'Pioli - Banco de Dados',
  description: 'Sistema de gestao de dados com webhooks e API REST',
}

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 overflow-auto">
            <div className="p-6 lg:p-8 max-w-7xl mx-auto">
              {children}
            </div>
          </main>
        </div>
        <Toaster position="top-right" />
      </body>
    </html>
  )
}
