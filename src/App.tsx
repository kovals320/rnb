import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'
import { AuthProvider, useAuth } from './lib/auth'
import { Brand, Spinner } from './components/ui'
import Login from './pages/Login'
import Schedule from './pages/Schedule'
import Job from './pages/Job'
import AssignmentForm from './pages/AssignmentForm'
import Clients from './pages/Clients'
import ClientDetail from './pages/ClientDetail'
import Workers from './pages/Workers'

function Gate({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const { loading, session, profile, isAdmin, signOut } = useAuth()
  if (loading) return <Spinner />
  if (!session) return <Navigate to="/login" replace />
  if (!profile || !profile.active)
    return (
      <div className="max-w-[420px] mx-auto px-7 pt-24 text-center flex flex-col items-center gap-4">
        <Brand big />
        <p className="text-[17px]">החשבון הזה ({session.user.email}) לא מורשה להשתמש באפליקציה.</p>
        <p className="text-muted">אם זו טעות, פנו למנהל.</p>
        <button onClick={() => signOut()} className="h-12 px-6 rounded-full bg-ink text-paper font-bold">
          יציאה
        </button>
      </div>
    )
  if (admin && !isAdmin) return <Navigate to="/" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Gate><Schedule /></Gate>} />
          <Route path="/job/:id" element={<Gate><Job /></Gate>} />
          <Route path="/assign/new" element={<Gate admin><AssignmentForm /></Gate>} />
          <Route path="/assign/:id" element={<Gate admin><AssignmentForm /></Gate>} />
          <Route path="/clients" element={<Gate admin><Clients /></Gate>} />
          <Route path="/clients/:id" element={<Gate admin><ClientDetail /></Gate>} />
          <Route path="/workers" element={<Gate admin><Workers /></Gate>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
