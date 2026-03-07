import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { Settings } from '@/pages/Settings'
import { Home } from '@/pages/Home'
import { ProjectBoard } from '@/pages/ProjectBoard'
import { PRListPage } from '@/pages/PRListPage'
import { PRViewPage } from '@/pages/PRViewPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Home />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/projects/:id" element={<ProjectBoard />} />
          <Route path="/projects/:id/pulls" element={<PRListPage />} />
          <Route path="/projects/:id/pulls/:number" element={<PRViewPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
