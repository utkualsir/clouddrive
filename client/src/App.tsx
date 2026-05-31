import { lazy, Suspense, useCallback, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import CustomCursor from './components/CustomCursor';
import DinoGame from './components/DinoGame';
import ChatBot from './components/ChatBot';
import ShortcutsModal from './components/ShortcutsModal';
import CommandPalette from './components/CommandPalette';

// Lazy-load all page components for code splitting
const LandingPage        = lazy(() => import('./pages/LandingPage'));
const LoginPage          = lazy(() => import('./pages/LoginPage'));
const RegisterPage       = lazy(() => import('./pages/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage  = lazy(() => import('./pages/ResetPasswordPage'));
const DrivePage          = lazy(() => import('./pages/DrivePage'));
const SettingsPage       = lazy(() => import('./pages/SettingsPage'));
const SharePage          = lazy(() => import('./pages/SharePage'));
const AdminPage          = lazy(() => import('./pages/AdminPage'));
const ConvertPage        = lazy(() => import('./pages/tools/ConvertPage'));
const EditorPage         = lazy(() => import('./pages/EditorPage'));
const StatsPage          = lazy(() => import('./pages/StatsPage'));
const ProfilePage        = lazy(() => import('./pages/ProfilePage'));
const FriendsPage        = lazy(() => import('./pages/FriendsPage'));
const NotificationsPage  = lazy(() => import('./pages/NotificationsPage'));
const PaymentSuccessPage = lazy(() => import('./pages/PaymentSuccessPage'));
const PaymentCancelPage  = lazy(() => import('./pages/PaymentCancelPage'));
const MessagesPage       = lazy(() => import('./pages/MessagesPage'));
const ForumHomePage      = lazy(() => import('./pages/forum/ForumHomePage'));
const ForumCategoryPage  = lazy(() => import('./pages/forum/ForumCategoryPage'));
const ForumThreadPage    = lazy(() => import('./pages/forum/ForumThreadPage'));
const ForumNewThreadPage = lazy(() => import('./pages/forum/ForumNewThreadPage'));
const ForumSearchPage    = lazy(() => import('./pages/forum/ForumSearchPage'));
const UserSearchPage     = lazy(() => import('./pages/UserSearchPage'));
const SearchPage         = lazy(() => import('./pages/SearchPage'));
const ChangelogPage      = lazy(() => import('./pages/ChangelogPage'));
const AboutPage          = lazy(() => import('./pages/AboutPage'));

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#0A0A0A]">
      <div className="w-8 h-8 border-4 border-[#4F46E5] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#0A0A0A]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#4F46E5] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[#6B6B6B] dark:text-[#888888]">Loading...</p>
        </div>
      </div>
    );
  }
  return user ? <>{children}</> : <Navigate to="/login" replace />;
}

function GuestRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  return !user ? <>{children}</> : <Navigate to="/drive" replace />;
}

function AppShell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);

  const onEscape = useCallback(() => {
    if (shortcutsOpen) { setShortcutsOpen(false); return; }
    if (cmdOpen) { setCmdOpen(false); return; }
  }, [shortcutsOpen, cmdOpen]);

  useKeyboardShortcuts({
    onCommandPalette: useCallback(() => setCmdOpen(v => !v), []),
    onShortcutsHelp: useCallback(() => setShortcutsOpen(v => !v), []),
    onEscape,
    onNavigateTo: useCallback((path: string) => {
      if (path === '/profile') {
        if (user?.id) navigate(`/profile/${user.id}`);
      } else {
        navigate(path);
      }
    }, [navigate, user?.id]),
  });

  return (
    <>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
          <Route path="/register" element={<GuestRoute><RegisterPage /></GuestRoute>} />
          <Route path="/forgot-password" element={<GuestRoute><ForgotPasswordPage /></GuestRoute>} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/drive" element={<ProtectedRoute><DrivePage /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
          <Route path="/tools/convert" element={<ProtectedRoute><ConvertPage /></ProtectedRoute>} />
          <Route path="/drive/edit/:fileId" element={<ProtectedRoute><EditorPage /></ProtectedRoute>} />
          <Route path="/stats" element={<ProtectedRoute><StatsPage /></ProtectedRoute>} />
          <Route path="/share/:token" element={<SharePage />} />
          <Route path="/profile/:userId" element={<ProfilePage />} />
          <Route path="/friends" element={<ProtectedRoute><FriendsPage /></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
          <Route path="/payment/success" element={<ProtectedRoute><PaymentSuccessPage /></ProtectedRoute>} />
          <Route path="/payment/cancel" element={<ProtectedRoute><PaymentCancelPage /></ProtectedRoute>} />
          <Route path="/messages" element={<ProtectedRoute><MessagesPage /></ProtectedRoute>} />
          <Route path="/forum" element={<ForumHomePage />} />
          <Route path="/forum/category/:id" element={<ForumCategoryPage />} />
          <Route path="/forum/thread/:id" element={<ForumThreadPage />} />
          <Route path="/forum/new" element={<ProtectedRoute><ForumNewThreadPage /></ProtectedRoute>} />
          <Route path="/forum/search" element={<ForumSearchPage />} />
          <Route path="/search" element={<ProtectedRoute><SearchPage /></ProtectedRoute>} />
          <Route path="/search/users" element={<ProtectedRoute><UserSearchPage /></ProtectedRoute>} />
          <Route path="/changelog" element={<ChangelogPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <DinoGame />
      <ChatBot />
      <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <CustomCursor />
      <AppShell />
    </BrowserRouter>
  );
}
