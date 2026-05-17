/**
 * DevFlow App
 * Головний компонент з інтеграцією Mediator
 */

import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { getMediator, EventTypes } from '../../mediator/src/index'
import wsClient from './services/websocket'
import { Header } from './components/Header'
import { ScrollToTop } from './components/ScrollToTop'
import { Home } from './pages/Home'
import { MainPage } from './pages/MainPage'
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
import { EditRoadmap } from './pages/EditRoadmap'
import { NewBestPractice } from './pages/NewBestPractice'
import { EditBestPractice } from './pages/EditBestPractice'
import { NewFaq } from './pages/NewFaq'
import { EditFaq } from './pages/EditFaq'
import { AuthCallback } from './pages/AuthCallback'
import { Communities } from './pages/Communities'
import { NewCommunity } from './pages/NewCommunity'
import { CommunityDetail } from './pages/CommunityDetail'
import { NewCommunityPost } from './pages/NewCommunityPost'
import { EditCommunityPost } from './pages/EditCommunityPost'
import { CommunityPostDetail } from './pages/CommunityPostDetail'
import { Mentors } from './pages/Mentors'
import { MentorProfileEdit } from './pages/MentorProfileEdit'
import { DevCatalog } from './pages/DevCatalog'
import { GlobalSearch } from './pages/GlobalSearch'
import { NotificationsPage } from './pages/Notifications'
import { NewsFeed } from './pages/NewsFeed'
import { NewsDetail } from './pages/NewsDetail'
import { NewNews } from './pages/NewNews'
import { EditNews } from './pages/EditNews'

function App() {
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

    return () => {
      mediator.unregister('App')
      wsClient.disconnect()
    }
  }, [mediator])

  return (
    <AuthProvider>
      <ScrollToTop />
      <div className="app">
        <Header />

        <main style={{ marginTop: 'var(--space-5)', marginBottom: 'var(--space-6)' }}>
          <Routes>
            <Route path="/" element={<MainPage />} />
            <Route path="/hub" element={<Home />} />
            <Route path="/questions" element={<Home />} />
            <Route path="/questions/new" element={<NewQuestion />} />
            <Route path="/questions/:id/edit" element={<EditQuestion />} />
            <Route path="/questions/:id" element={<QuestionDetail />} />
            <Route path="/ask" element={<NewQuestion />} />
            <Route path="/tags" element={<Tags />} />
            <Route path="/search" element={<GlobalSearch />} />
            <Route path="/notifications" element={<NotificationsPage />} />
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
            <Route path="/roadmaps/:id/edit" element={<EditRoadmap />} />
            <Route path="/roadmaps/:id" element={<RoadmapDetail />} />

            <Route path="/best-practices" element={<Home />} />
            <Route path="/best-practices/new" element={<NewBestPractice />} />
            <Route path="/best-practices/:id/edit" element={<EditBestPractice />} />
            <Route path="/best-practices/:id" element={<BestPracticeDetail />} />

            <Route path="/faq" element={<Home />} />
            <Route path="/faqs" element={<Home />} />
            <Route path="/faqs/new" element={<NewFaq />} />
            <Route path="/faqs/:id/edit" element={<EditFaq />} />
            <Route path="/faqs/:id" element={<FaqDetail />} />

            <Route path="/communities" element={<Communities />} />
            <Route path="/communities/new" element={<NewCommunity />} />
            <Route path="/communities/:slug" element={<CommunityDetail />} />
            <Route path="/communities/:slug/new" element={<NewCommunityPost />} />
            <Route path="/community-posts/:id/edit" element={<EditCommunityPost />} />
            <Route path="/community-posts/:id" element={<CommunityPostDetail />} />
            <Route path="/mentors" element={<Mentors />} />
            <Route path="/mentors/edit" element={<MentorProfileEdit />} />
            <Route path="/devs" element={<DevCatalog />} />

            <Route path="/news" element={<NewsFeed />} />
            <Route path="/news/new" element={<NewNews />} />
            <Route path="/news/:id/edit" element={<EditNews />} />
            <Route path="/news/:idOrSlug" element={<NewsDetail />} />
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
            DevFlow
          </div>
        </footer>
      </div>
    </AuthProvider>
  )
}

export default App
