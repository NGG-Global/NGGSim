import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './auth/AuthProvider'
import { SimulationRepositoryProvider } from './repositories/SimulationRepositoryProvider'
import './styles/index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <SimulationRepositoryProvider>
          <App />
        </SimulationRepositoryProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
