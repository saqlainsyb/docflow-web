import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useAuthBootstrap } from '@/hooks/useAuthBootstrap'
import { useAppSelector } from '@/store/hooks'

// ── Page imports (placeholders until we build each module) ────────────────────
// Each of these will be replaced with real implementations one at a time.
// They're defined inline here so the router compiles immediately.

const LoadingScreen = () => (
  <div className="flex h-screen w-screen items-center justify-center bg-background">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-foreground" />
  </div>
)

const LoginPage = () => (
  <div className="flex h-screen items-center justify-center">
    <p className="text-muted-foreground">Login page — coming soon</p>
  </div>
)

const RegisterPage = () => (
  <div className="flex h-screen items-center justify-center">
    <p className="text-muted-foreground">Register page — coming soon</p>
  </div>
)

const WorkspacesPage = () => (
  <div className="p-8">
    <p className="text-muted-foreground">Workspaces — coming soon</p>
  </div>
)

const BoardPage = () => (
  <div className="p-8">
    <p className="text-muted-foreground">Board — coming soon</p>
  </div>
)

const PublicBoardPage = () => (
  <div className="p-8">
    <p className="text-muted-foreground">Public board — coming soon</p>
  </div>
)

const NotFoundPage = () => (
  <div className="flex h-screen items-center justify-center">
    <p className="text-muted-foreground">404 — page not found</p>
  </div>
)

// ── ProtectedRoute ────────────────────────────────────────────────────────────
// Wraps all routes that require authentication.
// Reads user from Redux — if null, redirects to /login.
// replace: true so the login page doesn't appear in browser history,
// preventing the back button from bouncing the user between login and a
// protected route they can no longer access.
// state: { from: location } lets the login page redirect back after login —
// we'll wire that up when we build the login form.

import { useLocation } from 'react-router-dom'

function ProtectedRoute() {
  const user = useAppSelector((state) => state.auth.user)
  const location = useLocation()

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Outlet renders the matched child route
  return <Outlet />
}

// ── GuestRoute ────────────────────────────────────────────────────────────────
// Wraps routes that should only be accessible when NOT logged in.
// A logged-in user hitting /login or /register gets redirected to /workspaces.

function GuestRoute() {
  const user = useAppSelector((state) => state.auth.user)

  if (user) {
    return <Navigate to="/workspaces" replace />
  }

  return <Outlet />
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const { isBootstrapping } = useAuthBootstrap()

  // Block all rendering until we know the auth state.
  // This prevents the login redirect flash for authenticated users.
  if (isBootstrapping) {
    return <LoadingScreen />
  }

  return (
    <Routes>
      {/* ── Guest routes — redirect to /workspaces if already logged in ── */}
      <Route element={<GuestRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      {/* ── Public routes — no auth required ─────────────────────────── */}
      <Route path="/share/:token" element={<PublicBoardPage />} />

      {/* ── Protected routes — redirect to /login if not authenticated ── */}
      <Route element={<ProtectedRoute />}>
        <Route path="/workspaces" element={<WorkspacesPage />} />
        <Route path="/boards/:boardId" element={<BoardPage />} />
      </Route>

      {/* ── Root redirect ─────────────────────────────────────────────── */}
      {/* Logged-in users go to workspaces, guests go to login.           */}
      {/* ProtectedRoute handles the auth check so we just point to /workspaces */}
      <Route path="/" element={<Navigate to="/workspaces" replace />} />

      {/* ── 404 ───────────────────────────────────────────────────────── */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}