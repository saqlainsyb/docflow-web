import { Outlet } from 'react-router-dom'
import { Sidebar } from '@/components/sidebar/Sidebar'

/**
 * AppLayout
 *
 * Persistent shell for all authenticated routes.
 *
 * Structure:
 *   ┌──────────┬────────────────────────────────┐
 *   │          │                                │
 *   │ Sidebar  │   <Outlet /> (routed page)     │
 *   │  256px   │   ml-64, full remaining width  │
 *   │  fixed   │                                │
 *   └──────────┴────────────────────────────────┘
 *
 * Rules:
 * - No business logic here. Layout only.
 * - Topbar (breadcrumbs, search, CTAs) lives inside each page — not here.
 *   Pages are fully self-contained. Nothing is prop-drilled through this shell.
 * - Sidebar handles its own workspace context via Redux selectors.
 */
export function AppLayout() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Sidebar />
      <main className="ml-64 min-h-screen">
        <Outlet />
      </main>
    </div>
  )
}