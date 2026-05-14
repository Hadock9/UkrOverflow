/**
 * UkrOverflow App
 * Головний компонент з інтеграцією Mediator
 */

import { useEffect, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { getMediator, EventTypes } from '../../mediator/src/index'
import wsClient from './services/websocket'
import { Header } from './components/Header'
import { Home } from './pages/Home'
import { QuestionDetail } from './pages/QuestionDetail'
import { NewQuestion } from './pages/NewQuestion'
import { CreateContent } from './pages/CreateContent'
import { EditQuestion } from './pages/EditQuestion'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { Tags } from './pages/Tags'
import { Users } from './pages/Users'
import { Profile } from './pages/Profile'

function App() {
  const [initialized, setInitialized] = useState(false)
  const mediator = getMediator()

  useEffect(() => {
    // Реєстрація App компонента в медіаторі
    mediator.register('App', { name: 'App', type: 'root' })

    // Підключення WebSocket
    wsClient.connect()

    // WebSocket події через Mediator
    wsClient.on('questions', (data) => {
      mediator.emit(EventTypes.QUESTION_CREATE, data, 'WebSocket')
    })

    wsClient.on('answers', (data) => {
      mediator.emit(EventTypes.ANSWER_CREATE, data, 'WebSocket')
    })

    // Підписка на системні події
    mediator.on(EventTypes.ERROR, (data) => {
      console.error('Системна помилка:', data)
    }, 'App')

    setInitialized(true)

    return () => {
      mediator.unregister('App')
      wsClient.disconnect()
    }
  }, [])

  if (!initialized) {
    return (
      <div className="container" style={{ textAlign: 'center', padding: '100px 20px' }}>
        <div className="loading"></div>
        <p style={{ marginTop: '20px', fontFamily: 'var(--font-mono)' }}>
          ЗАВАНТАЖЕННЯ KNOWLEDGE HUB...
        </p>
      </div>
    )
  }

  return (
    <AuthProvider>
      <div className="app">
        <Header />

        <main style={{ marginTop: 'var(--space-5)', marginBottom: 'var(--space-6)' }}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/questions" element={<Home />} />
            <Route path="/create" element={<CreateContent />} />
            <Route path="/content/new" element={<CreateContent />} />
            <Route path="/questions/new" element={<NewQuestion />} />
            <Route path="/questions/:id/edit" element={<EditQuestion />} />
            <Route path="/questions/:id" element={<QuestionDetail />} />
            <Route path="/ask" element={<CreateContent />} />
            <Route path="/tags" element={<Tags />} />
            <Route path="/tags/:tag" element={<Home />} />
            <Route path="/users" element={<Users />} />
            <Route path="/users/:id" element={<Profile />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
          </Routes>
        </main>

        <footer style={{
          padding: 'var(--space-4) 0',
          borderTop: 'var(--border-width) solid var(--border-color)',
          textAlign: 'center',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.875rem'
        }}>
          <div className="container">
            UKR KNOWLEDGE HUB
          </div>
        </footer>
      </div>
    </AuthProvider>
  )
}

export default App
