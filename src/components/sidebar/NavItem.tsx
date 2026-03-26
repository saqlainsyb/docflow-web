import { useMatch, useNavigate, useResolvedPath } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItemProps {
  /** Relative path segment — e.g. "boards", "members", "settings" */
  to: string
  icon: LucideIcon
  label: string
}

/**
 * NavItem
 *
 * A single sidebar navigation link.
 *
 * Active state:
 *   Uses useResolvedPath + useMatch so relative paths ("boards") resolve
 *   correctly inside the /:workspaceId parent route without needing to
 *   know the workspaceId at the call site.
 *
 *   end: false — active when the path starts with this segment, so
 *   /:workspaceId/boards/:boardId still keeps "Boards" highlighted.
 *
 * Icon:
 *   Lucide icons accept strokeWidth. Active state uses strokeWidth={2}
 *   with a filled appearance achieved via the active background + color
 *   combination — no separate filled icon variant needed.
 *
 * Accessibility:
 *   aria-current="page" on the active item — screen readers announce
 *   the current location correctly.
 */
export function NavItem({ to, icon: Icon, label }: NavItemProps) {
  const navigate = useNavigate()
  const resolved = useResolvedPath(to)
  const match = useMatch({ path: resolved.pathname, end: false })
  const isActive = match !== null

  return (
    <button
      onClick={() => navigate(to)}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        // Base layout
        'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl',
        'text-sm transition-all duration-150 outline-none',
        // Focus ring — keyboard navigation
        'focus-visible:ring-2 focus-visible:ring-primary/50',
        // State variants
        isActive
          ? [
              'bg-primary/10 text-primary font-medium',
              // Subtle left-edge accent line
              'relative before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2',
              'before:w-0.5 before:h-4 before:rounded-full before:bg-primary',
            ]
          : [
              'text-on-surface-variant font-normal',
              'hover:bg-surface-container hover:text-on-surface',
            ],
      )}
    >
      <Icon
        className={cn(
          'w-4.5 h-4.5 shrink-0 transition-colors',
          isActive ? 'text-primary' : 'text-outline',
        )}
        strokeWidth={isActive ? 2.5 : 2}
        aria-hidden="true"
      />
      <span>{label}</span>
    </button>
  )
}