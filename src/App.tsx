import { Routes, Route, Navigate, Outlet, useNavigate } from "react-router-dom";
import { useLocation } from "react-router-dom";
import { useEffect } from "react";

import { useAuthBootstrap } from "@/hooks/useAuthBootstrap";
import { useAppSelector } from "@/store/hooks";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { AppLayout } from "@/layouts/AppLayout";
import { ModalManager } from '@/components/modals/ModalManager'

import { LoginPage } from "@/pages/auth/LoginPage";
import { RegisterPage } from "@/pages/auth/RegisterPage";
import { BoardsPage } from "@/pages/workspace/BoardsPage";
import { MembersPage } from "@/pages/workspace/MembersPage";
import { SettingsPage } from "@/pages/workspace/SettingsPage";
import { BoardPage } from "@/pages/workspace/BoardPage";
import { DocumentEditorPage } from "@/pages/workspace/DocumentEditorPage";
import { PublicBoardPage } from "@/pages/public/PublicBoardPage";
import { ProfilePage } from "@/pages/profile/ProfilePage";

// ── Placeholder pages (replaced one module at a time) ─────────────────────────
// Inline until each module is built. Never import a page that doesn't exist yet.

const LoadingScreen = () => (
  <div className="flex h-screen w-screen items-center justify-center bg-background">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-foreground" />
  </div>
);

const NotFoundPage = () => (
  <div className="flex h-screen items-center justify-center">
    <p className="text-muted-foreground">404 — page not found</p>
  </div>
);

// ── ProtectedRoute ────────────────────────────────────────────────────────────
// Wraps all routes that require authentication.
// Redirects to /login with { from: location } state so the login page can
// bounce the user back after successful authentication.

function ProtectedRoute() {
  const user = useAppSelector((state) => state.auth.user);
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // ModalManager lives here — mounted for all authenticated routes,
  // including BoardPage which lives outside AppLayout
  return (
    <>
      <Outlet />
      <ModalManager />
    </>
  )
}

// ── GuestRoute ────────────────────────────────────────────────────────────────
// Wraps /login and /register.
// Logged-in users are sent to / which RootRedirect handles.

function GuestRoute() {
  const user = useAppSelector((state) => state.auth.user);

  if (user) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

// ── RootRedirect ──────────────────────────────────────────────────────────────
// Handles the / route for authenticated users.
// Queries the workspace list and navigates to /:firstWorkspaceId/boards.
//
// Why not a simple <Navigate>:
// We don't know the workspace ID at render time — it comes from the server.
// We need to wait for the query, then imperatively navigate once we have data.
//
// States:
//   loading  → show the loading screen (brief — workspaces are already
//               in the TanStack Query cache after auth bootstrap)
//   has data → navigate to first workspace's boards
//   empty    → this shouldn't happen in V1 (register auto-creates a workspace)
//               but we guard against it gracefully

function RootRedirect() {
  const navigate = useNavigate();
  const { data: workspaces, isLoading } = useWorkspaces();

  useEffect(() => {
    if (!workspaces) return;
    if (workspaces.length > 0) {
      navigate(`/${workspaces[0].id}/boards`, { replace: true });
    }
    // Edge case: no workspaces — stay on / and let the user create one.
    // The workspace creation modal can be triggered from here in a future pass.
  }, [workspaces, navigate]);

  if (isLoading) return <LoadingScreen />;

  // Workspaces loaded but empty — show a minimal prompt
  // (this path should never be hit in V1 since register auto-creates one)
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
      <p className="text-muted-foreground text-sm">No workspaces found.</p>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const { isBootstrapping } = useAuthBootstrap();

  // Block all rendering until we know the auth state.
  // Prevents the /login redirect flash for users who are already authenticated.
  if (isBootstrapping) {
    return <LoadingScreen />;
  }

  return (
    <Routes>
      {/* ── Guest routes ────────────────────────────────────────────────── */}
      {/* Redirect to / (→ RootRedirect) if already logged in              */}
      <Route element={<GuestRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      {/* ── Public routes — no auth required ────────────────────────────── */}
      <Route path="/share/:token" element={<PublicBoardPage />} />

      {/* ── Protected routes ────────────────────────────────────────────── */}
      <Route element={<ProtectedRoute />}>
        {/* Root redirect — resolves to /:firstWorkspaceId/boards          */}
        <Route path="/" element={<RootRedirect />} />

        {/* Workspace-scoped shell — all pages inside share the sidebar    */}
        {/*                                                                 */}
        {/* Route tree:                                                     */}
        {/*   /:workspaceId                → AppLayout (sidebar + outlet)  */}
        {/*   /:workspaceId/boards         → BoardsPage                    */}
        {/*   /:workspaceId/members        → MembersPage                   */}
        {/*   /:workspaceId/settings       → SettingsPage                  */}
        <Route path="/:workspaceId" element={<AppLayout />}>
          <Route index element={<Navigate to="boards" replace />} />
          <Route path="boards" element={<BoardsPage />} />
          {/* boards/:boardId moved out ↓ */}
          <Route path="members" element={<MembersPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        {/* Board view — full screen, no sidebar                           */}
        <Route path="/:workspaceId/boards/:boardId" element={<BoardPage />} />

        {/* Document editor — full screen, no sidebar                      */}
        {/* Navigated to when a card is clicked on the board view         */}
        <Route
          path="/:workspaceId/boards/:boardId/cards/:cardId"
          element={<DocumentEditorPage />}
        />

        {/* Profile — full screen, no sidebar, no workspaceId in URL      */}
        {/* Navigated to from UserMenu → "Profile" item                   */}
        <Route path="/profile" element={<ProfilePage />} />
      </Route>

      {/* ── 404 ─────────────────────────────────────────────────────────── */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}