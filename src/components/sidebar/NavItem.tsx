import { useMatch, useNavigate, useResolvedPath } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItemProps {
  to: string
  icon: LucideIcon
  label: string
  badge?: number
}

export function NavItem({ to, icon: Icon, label, badge }: NavItemProps) {
  const navigate = useNavigate()
  const resolved = useResolvedPath(to)
  const match = useMatch({ path: resolved.pathname, end: false })
  const isActive = match !== null

  return (
    <button
      onClick={() => navigate(to)}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        // Base
        'relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl',
        'text-sm transition-all duration-200 outline-none group',
        'focus-visible:ring-2 focus-visible:ring-primary/50',
        // State
        isActive
          ? 'text-primary font-medium'
          : 'text-on-surface-variant font-normal hover:text-on-surface',
      )}
    >
      {/* Active background — rendered separately so it can have its own styles */}
      {isActive && (
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-xl bg-primary/[0.08] border border-primary/[0.12]"
        />
      )}

      {/* Hover background */}
      {!isActive && (
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-surface-container"
        />
      )}

      {/* Active left indicator bar */}
      {isActive && (
        <span
          aria-hidden="true"
          className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-primary"
        />
      )}

      {/* Icon */}
      <span className="relative shrink-0 flex items-center justify-center w-5 h-5">
        <Icon
          className={cn(
            'w-[18px] h-[18px] transition-all duration-200',
            isActive
              ? 'text-primary'
              : 'text-outline group-hover:text-on-surface-variant',
          )}
          strokeWidth={isActive ? 2.25 : 1.75}
          aria-hidden="true"
        />
      </span>

      {/* Label */}
      <span className="relative flex-1 text-left leading-none">{label}</span>

      {/* Badge */}
      {badge != null && badge > 0 && (
        <span
          className={cn(
            'relative ml-auto shrink-0 min-w-[18px] h-[18px] px-1',
            'flex items-center justify-center rounded-full',
            'text-[10px] font-bold leading-none tabular-nums',
            isActive
              ? 'bg-primary text-primary-foreground'
              : 'bg-surface-container-high text-on-surface-variant',
          )}
        >
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  )
}