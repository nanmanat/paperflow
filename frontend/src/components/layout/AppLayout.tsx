import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Toaster } from 'react-hot-toast'

export function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: { background: 'hsl(220 14% 16%)', color: 'hsl(220 13% 91%)', border: '1px solid hsl(220 13% 22%)', fontSize: '13px' },
          success: { iconTheme: { primary: '#108548', secondary: 'white' } },
          error: { iconTheme: { primary: '#dd2b0e', secondary: 'white' } },
        }}
      />
    </div>
  )
}
