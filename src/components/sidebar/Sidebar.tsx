import { WorkspaceSwitcher } from '@/components/sidebar/WorkspaceSwitcher'
import { NavItem } from '@/components/sidebar/NavItem'
import { UserMenu } from '@/components/sidebar/UserMenu'
import { LayoutDashboard, Users, Settings, Layers, X } from 'lucide-react'

interface SidebarProps {
  /** Provided by AppLayout when rendered as a mobile sheet. */
  onClose?: () => void
}

/**
 * Sidebar — Obsidian Studio, Responsive
 *
 * On desktop: used inside a `hidden lg:block` wrapper in AppLayout, fixed positioning.
 * On mobile:  used inside a motion.div sheet in AppLayout; `onClose` shows a close button.
 */
export function Sidebar({ onClose }: SidebarProps) {
  return (
    <aside
      className="w-60 flex flex-col z-50"
      style={{
        position: 'fixed',
        insetBlock: 0,
        background: 'oklch(0.145 0.015 265)',
        borderRight: '1px solid oklch(0.35 0.015 265 / 18%)',
      }}
    >
      {/* ── Logo ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 px-5 pt-6 pb-5">
        <div className="w-7 h-7 rounded-[8px] df-gradient-logo flex items-center justify-center shrink-0">
          <Layers className="w-3.5 h-3.5 text-primary-foreground" strokeWidth={2.5} />
        </div>
        <span className="font-display font-bold text-[18px] tracking-[-0.01em] text-on-surface">
          Docflow
        </span>
        <span className="ml-auto text-[9px] font-semibold uppercase tracking-[0.1em] text-outline/50 select-none">
          v1
        </span>

        {/* Mobile close button */}
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close navigation"
            className="ml-1 flex items-center justify-center w-7 h-7 rounded-lg text-outline/60 hover:text-on-surface hover:bg-surface-container transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ── Workspace Switcher ─────────────────────────────────────────────── */}
      <div className="px-3 mb-4">
        <WorkspaceSwitcher />
      </div>

      {/* ── Divider ───────────────────────────────────────────────────────── */}
      <div className="mx-4 mb-3 h-px bg-outline-variant/15" />

      {/* ── Nav section ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col px-3 overflow-y-auto min-h-0">
        <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-outline/70 select-none">
          Navigation
        </p>
        <nav className="space-y-px" aria-label="Primary navigation">
          <NavItem to="boards" icon={LayoutDashboard} label="Boards" />
          <NavItem to="members" icon={Users} label="Members" />
          <NavItem to="settings" icon={Settings} label="Settings" />
        </nav>
        <div className="flex-1" />
      </div>

      {/* ── Bottom section ────────────────────────────────────────────────── */}
      <div className="mt-auto">
        <div className="mx-4 mb-2 h-px bg-outline-variant/15" />
        <div className="px-3 pb-4">
          <UserMenu />
        </div>
      </div>
    </aside>
  )
}