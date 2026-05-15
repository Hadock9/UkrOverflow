import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './styles/brutalism.css'
import App from './App.jsx'

// Mediator (візуалізатор вимкнено — не показувати плаваючу панель на проді)
import { createMediator } from '../../mediator/src/index.js'

createMediator({
  debug: import.meta.env.DEV,
  visualization: false,
  logLevel: import.meta.env.DEV ? 'info' : 'warn',
})

// React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000
    }
  }
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
