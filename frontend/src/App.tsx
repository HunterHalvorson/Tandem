import { lazy } from 'react'
import { Route, Routes } from 'react-router'
import { AppShell } from './components/layout/AppShell'
import { RequireAuth } from './components/layout/RequireAuth'
import DiscoverPage from './pages/DiscoverPage'
import LandingPage from './pages/LandingPage'

// Route-level code splitting: the landing page and discovery load eagerly; everything else on demand.
const AboutPage = lazy(() => import('./pages/AboutPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const EventChatPage = lazy(() => import('./pages/EventChatPage'))
const EventDetailPage = lazy(() => import('./pages/EventDetailPage'))
const EventFormPage = lazy(() => import('./pages/EventFormPage'))
const GroupDetailPage = lazy(() => import('./pages/GroupDetailPage'))
const GroupsPage = lazy(() => import('./pages/GroupsPage'))
const ImpactPage = lazy(() => import('./pages/ImpactPage'))
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const MapPage = lazy(() => import('./pages/MapPage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))
const OnboardingPage = lazy(() => import('./pages/OnboardingPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const PublicProfilePage = lazy(() => import('./pages/ProfilePage').then((m) => ({ default: m.PublicProfilePage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const SignupPage = lazy(() => import('./pages/SignupPage'))
const TravellerPage = lazy(() => import('./pages/TravellerPage'))
import { AppStoreProvider } from './state/AppStore'
import { DisplayProvider } from './state/display'
import { ToastProvider } from './state/toast'

export default function App() {
  return (
    <DisplayProvider>
      <ToastProvider>
        <AppStoreProvider>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<LandingPage />} />
              <Route path="login" element={<LoginPage />} />
              <Route path="signup" element={<SignupPage />} />
              <Route path="onboarding" element={<RequireAuth allowIncomplete><OnboardingPage /></RequireAuth>} />
              <Route path="discover" element={<DiscoverPage />} />
              <Route path="map" element={<MapPage />} />
              <Route path="events/new" element={<RequireAuth><EventFormPage /></RequireAuth>} />
              <Route path="events/:id" element={<EventDetailPage />} />
              <Route path="events/:id/edit" element={<RequireAuth><EventFormPage /></RequireAuth>} />
              <Route path="events/:id/chat" element={<RequireAuth><EventChatPage /></RequireAuth>} />
              <Route path="groups" element={<GroupsPage />} />
              <Route path="groups/:id" element={<GroupDetailPage />} />
              <Route path="dashboard" element={<RequireAuth><DashboardPage /></RequireAuth>} />
              <Route path="profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
              <Route path="people/:id" element={<PublicProfilePage />} />
              <Route path="leaderboard" element={<LeaderboardPage />} />
              <Route path="explore-like-a-local" element={<TravellerPage />} />
              <Route path="settings" element={<RequireAuth allowIncomplete><SettingsPage /></RequireAuth>} />
              <Route path="impact" element={<ImpactPage />} />
              <Route path="about" element={<AboutPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </AppStoreProvider>
      </ToastProvider>
    </DisplayProvider>
  )
}
