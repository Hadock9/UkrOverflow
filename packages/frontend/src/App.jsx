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
import { EditQuestion } from './pages/EditQuestion'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { Tags } from './pages/Tags'
import { Users } from './pages/Users'
import { Profile } from './pages/Profile'
import { ArticleDetail } from './pages/ArticleDetail'
import { NewArticle } from './pages/NewArticle'
import { EditArticle } from './pages/EditArticle'
import { GuideDetail } from './pages/GuideDetail'
import { NewGuide } from './pages/NewGuide'
import { EditGuide } from './pages/EditGuide'
import { SnippetDetail } from './pages/SnippetDetail'
import { NewSnippet } from './pages/NewSnippet'
import { EditSnippet } from './pages/EditSnippet'
import { RoadmapDetail, BestPracticeDetail, FaqDetail } from './pages/HubItemDetail'
import { NewRoadmap } from './pages/NewRoadmap'
import { NewBestPractice } from './pages/NewBestPractice'
import { NewFaq } from './pages/NewFaq'
import { AuthCallback } from './pages/AuthCallback'

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
          ЗАВАНТАЖЕННЯ DEVHUB.UA...
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
            <Route path="/questions/new" element={<NewQuestion />} />
            <Route path="/questions/:id/edit" element={<EditQuestion />} />
            <Route path="/questions/:id" element={<QuestionDetail />} />
            <Route path="/ask" element={<NewQuestion />} />
            <Route path="/tags" element={<Tags />} />
            <Route path="/tags/:tag" element={<Home />} />
            <Route path="/users" element={<Users />} />
            <Route path="/users/:id" element={<Profile />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/auth/callback" element={<AuthCallback />} />

            {/* Knowledge hub типи */}
            <Route path="/articles" element={<Home />} />
            <Route path="/articles/new" element={<NewArticle />} />
            <Route path="/articles/:id/edit" element={<EditArticle />} />
            <Route path="/articles/:id" element={<ArticleDetail />} />

            <Route path="/guides" element={<Home />} />
            <Route path="/guides/new" element={<NewGuide />} />
            <Route path="/guides/:id/edit" element={<EditGuide />} />
            <Route path="/guides/:id" element={<GuideDetail />} />

            <Route path="/snippets" element={<Home />} />
            <Route path="/snippets/new" element={<NewSnippet />} />
            <Route path="/snippets/:id/edit" element={<EditSnippet />} />
            <Route path="/snippets/:id" element={<SnippetDetail />} />

            <Route path="/roadmaps" element={<Home />} />
            <Route path="/roadmaps/new" element={<NewRoadmap />} />
            <Route path="/roadmaps/:id" element={<RoadmapDetail />} />

            <Route path="/best-practices" element={<Home />} />
            <Route path="/best-practices/new" element={<NewBestPractice />} />
            <Route path="/best-practices/:id" element={<BestPracticeDetail />} />

            <Route path="/faq" element={<Home />} />
            <Route path="/faqs" element={<Home />} />
            <Route path="/faqs/new" element={<NewFaq />} />
            <Route path="/faqs/:id" element={<FaqDetail />} />
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
            DEVHUB.UA
          </div>
        </footer>
      </div>
    </AuthProvider>
  )
}

export default App
