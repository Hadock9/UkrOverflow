import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './styles/brutalism.css'
import App from './App.jsx'

// Mediator
import { createMediator } from '../../mediator/src/index.js'
import { createVisualizer } from '../../mediator/src/visualizer.js'

// Створення медіатора
const mediator = createMediator({
  debug: true,
  visualization: true,
  logLevel: 'info'
})

// Створення візуалізатора
const visualizer = createVisualizer({
  position: 'bottom-right',
  autoOpen: false
})

mediator.setVisualizer(visualizer)

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
