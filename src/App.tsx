import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedAdminRoute } from './auth/ProtectedAdminRoute'
import { AdminLayout } from './layouts/AdminLayout'
import { ParticipantLayout } from './layouts/ParticipantLayout'
import { AuthCallbackPage } from './pages/auth/AuthCallbackPage'
import { LoginPage } from './pages/auth/LoginPage'
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage'
import { NewSimulationPage } from './pages/admin/NewSimulationPage'
import { SimulationEditorPage } from './pages/admin/SimulationEditorPage'
import { SimulationPreviewPage } from './pages/admin/SimulationPreviewPage'
import { SimulationResultsPage } from './pages/admin/SimulationResultsPage'
import { SimulationSharePage } from './pages/admin/SimulationSharePage'
import { NotFoundPage } from './pages/NotFoundPage'
import { ParticipantCompletePage } from './pages/participant/ParticipantCompletePage'
import { ParticipantLandingPage } from './pages/participant/ParticipantLandingPage'
import { ParticipantSessionPage } from './pages/participant/ParticipantSessionPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/admin" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route element={<ProtectedAdminRoute />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboardPage />} />
          <Route path="simulations" element={<AdminDashboardPage />} />
          <Route path="simulations/new" element={<NewSimulationPage />} />
          <Route path="simulations/:id/edit" element={<SimulationEditorPage />} />
          <Route path="simulations/:id/preview" element={<SimulationPreviewPage />} />
          <Route path="simulations/:id/share" element={<SimulationSharePage />} />
          <Route path="simulations/:id/results" element={<SimulationResultsPage />} />
        </Route>
      </Route>
      <Route path="/simulation/:publicToken" element={<ParticipantLayout />}>
        <Route index element={<ParticipantLandingPage />} />
        <Route path="session" element={<ParticipantSessionPage />} />
        <Route path="complete" element={<ParticipantCompletePage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
