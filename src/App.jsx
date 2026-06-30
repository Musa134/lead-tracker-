import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Login from './pages/Login'
import ChangePassword from './pages/ChangePassword'
import Hub from './pages/Hub'
import LeadTracker from './pages/LeadTracker'
import CRMFeed from './pages/crm/CRMFeed'
import LogCall from './pages/crm/LogCall'
import AllAccounts from './pages/crm/AllAccounts'

function ProtectedRoute({ children }) {
  const { session } = useAuth()
  if (session === undefined) return null
  if (session === null) return <Navigate to="/login" replace />
  return children
}

function AppRoutes() {
  const { session } = useAuth()

  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={<ProtectedRoute><Hub /></ProtectedRoute>} />
      <Route path="/leads" element={<ProtectedRoute><LeadTracker /></ProtectedRoute>} />
      <Route path="/crm" element={<ProtectedRoute><CRMFeed /></ProtectedRoute>} />
      <Route path="/crm/log" element={<ProtectedRoute><LogCall /></ProtectedRoute>} />
      <Route path="/crm/accounts" element={<ProtectedRoute><AllAccounts /></ProtectedRoute>} />
      <Route path="/change-password" element={<ProtectedRoute><ChangePassword /></ProtectedRoute>} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
