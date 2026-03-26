import { WorkspaceSwitcher } from '@/components/sidebar/WorkspaceSwitcher'
import { NavItem } from '@/components/sidebar/NavItem'
import { UserMenu } from '@/components/sidebar/UserMenu'
import { Layers, LayoutDashboard, Users, Settings } from 'lucide-react'

/**
 * Sidebar
 *
 * Outermost sidebar container. Owns positioning and background.
 * Composes four sections — no logic lives here.
 *
 * Sections (top → bottom):
 *   1. Logo lockup
 *   2. WorkspaceSwitcher — active workspace + dropdown trigger
 *   3. Nav links — Boards, Members, Settings
 *   4. UserMenu — avatar, name, role, actions
 *
 * Width: 256px (w-64), fixed to the left edge, full viewport height.
 * Background: surface-container-low — one tier above the page canvas.
 */
export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 w-64 flex flex-col bg-surface-container-low z-50">
      {/* ── Logo ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-6 py-8">
        <div className="w-8 h-8 rounded-lg df-gradient-logo flex items-center justify-center shrink-0">
          <Layers className="w-4 h-4 text-primary-foreground" strokeWidth={2.5} />
        </div>
        <span className="font-display font-bold text-xl tracking-tight text-on-surface">
          Docflow
        </span>
      </div>

      {/* ── Workspace Switcher ──────────────────────────────────────── */}
      <div className="px-4 mb-6">
        <WorkspaceSwitcher />
      </div>

      {/* ── Nav Links ───────────────────────────────────────────────── */}
      <nav className="flex-1 px-4 space-y-0.5">
        <NavItem
          to="boards"
          icon={LayoutDashboard}
          label="Boards"
        />
        <NavItem
          to="members"
          icon={Users}
          label="Members"
        />
        <NavItem
          to="settings"
          icon={Settings}
          label="Settings"
        />
      </nav>

      {/* ── User Menu ───────────────────────────────────────────────── */}
      <div className="p-4 mt-auto">
        <UserMenu />
      </div>
    </aside>
  )
}