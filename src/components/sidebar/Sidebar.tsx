import { WorkspaceSwitcher } from '@/components/sidebar/WorkspaceSwitcher'
import { NavItem } from '@/components/sidebar/NavItem'
import { UserMenu } from '@/components/sidebar/UserMenu'
import { LayoutDashboard, Users, Settings, Layers } from 'lucide-react'

/**
 * Sidebar — Redesigned
 *
 * "Obsidian Studio" aesthetic — refined, purposeful, dark.
 *
 * Structure (top → bottom):
 *   1. Logo lockup          — wordmark + icon badge
 *   2. WorkspaceSwitcher    — compact, monogram-based trigger
 *   3. Nav section header   — "Navigation" label
 *   4. Nav links            — Boards, Members, Settings
 *   5. Divider
 *   6. UserMenu             — avatar, name, role pill, action menu
 *
 * Design decisions:
 *  - Width reduced to 240px (w-60) — tighter, less wasted space
 *  - Subtle right border replaces box shadow — clean, structural
 *  - Logo area uses a softer top padding — 24px not 32px
 *  - Nav section is labeled — helps orientation on first use
 *  - User section anchored to bottom with clear visual separation
 *  - No animations — intentional restraint per brief
 */
export function Sidebar() {
  return (
    <aside
      className="fixed inset-y-0 left-0 w-60 flex flex-col z-50"
      style={{
        background: 'oklch(0.145 0.015 265)',
        borderRight: '1px solid oklch(0.35 0.015 265 / 18%)',
      }}
    >
      {/* ── Logo ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 px-5 pt-6 pb-5">
        {/* Icon badge */}
        <div className="w-7 h-7 rounded-[8px] df-gradient-logo flex items-center justify-center shrink-0">
          <Layers className="w-3.5 h-3.5 text-primary-foreground" strokeWidth={2.5} />
        </div>
        {/* Wordmark */}
        <span className="font-display font-bold text-[18px] tracking-[-0.01em] text-on-surface">
          Docflow
        </span>
        {/* Version badge — subtle credibility signal */}
        <span className="ml-auto text-[9px] font-semibold uppercase tracking-[0.1em] text-outline/50 select-none">
          v1
        </span>
      </div>

      {/* ── Workspace Switcher ─────────────────────────────────────────────── */}
      <div className="px-3 mb-4">
        <WorkspaceSwitcher />
      </div>

      {/* ── Divider ───────────────────────────────────────────────────────── */}
      <div className="mx-4 mb-3 h-px bg-outline-variant/15" />

      {/* ── Nav section ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col px-3 overflow-y-auto min-h-0">
        {/* Section label */}
        <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-outline/70 select-none">
          Navigation
        </p>

        {/* Nav links */}
        <nav className="space-y-px" aria-label="Primary navigation">
          <NavItem to="boards" icon={LayoutDashboard} label="Boards" />
          <NavItem to="members" icon={Users} label="Members" />
          <NavItem to="settings" icon={Settings} label="Settings" />
        </nav>

        {/* Spacer — pushes user section to bottom */}
        <div className="flex-1" />
      </div>

      {/* ── Bottom section ────────────────────────────────────────────────── */}
      <div className="mt-auto">
        {/* Divider */}
        <div className="mx-4 mb-2 h-px bg-outline-variant/15" />

        {/* User menu */}
        <div className="px-3 pb-4">
          <UserMenu />
        </div>
      </div>
    </aside>
  )
}