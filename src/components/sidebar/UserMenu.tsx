import { useParams, useNavigate } from 'react-router-dom'
import { LogOut, User, ChevronRight } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { useAppSelector } from '@/store/hooks'
import { useLogout } from '@/hooks/useLogout'
import { useWorkspace } from '@/hooks/useWorkspace'
import { cn } from '@/lib/utils'
import { getInitials } from '@/lib/utils'

function formatRole(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1)
}

/** Role → pill styling */
function getRoleStyle(role: string): string {
  switch (role.toLowerCase()) {
    case 'owner':
      return 'bg-primary/10 text-primary border-primary/20'
    case 'admin':
      return 'bg-df-secondary/10 text-df-secondary border-df-secondary/20'
    default:
      return 'bg-surface-container-high text-outline border-outline-variant/20'
  }
}

export function UserMenu() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const navigate = useNavigate()
  const logout = useLogout()

  const user = useAppSelector((state) => state.auth.user)
  const { data: workspace } = useWorkspace(workspaceId)

  const currentMember = workspace?.members.find((m) => m.user_id === user?.id)
  const role = currentMember ? formatRole(currentMember.role) : null

  if (!user) return null

  const initials = getInitials(user.name)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="User menu"
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left',
            'hover:bg-surface-container-high/60 transition-all duration-200',
            'outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
            'group border border-transparent hover:border-outline-variant/20',
          )}
        >
          {/* Avatar */}
          <div className="relative shrink-0">
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.name}
                className="w-8 h-8 rounded-full object-cover ring-1 ring-outline-variant/30"
              />
            ) : (
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center',
                  'bg-df-tertiary-container text-df-on-tertiary-container',
                  'text-[11px] font-bold select-none',
                  'ring-1 ring-df-tertiary/20',
                )}
              >
                {initials}
              </div>
            )}
            {/* Online dot */}
            <span
              aria-hidden="true"
              className="absolute -bottom-px -right-px w-2.5 h-2.5 rounded-full bg-primary border-2 border-surface-container-low"
            />
          </div>

          {/* Name + role pill */}
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-on-surface truncate leading-none mb-1">
              {user.name}
            </p>
            {role && (
              <span
                className={cn(
                  'inline-flex items-center px-1.5 py-px rounded text-[9px] font-semibold uppercase tracking-[0.08em] border',
                  getRoleStyle(role),
                )}
              >
                {role}
              </span>
            )}
          </div>

          {/* Chevron hint */}
          <ChevronRight
            className="w-3.5 h-3.5 text-outline/40 group-hover:text-outline transition-colors shrink-0"
            aria-hidden="true"
          />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent side="top" align="start" sideOffset={8} className="w-56">
        {/* User info header */}
        <DropdownMenuLabel className="normal-case tracking-normal px-3 py-2.5">
          <div className="flex items-center gap-2.5">
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.name}
                className="w-8 h-8 rounded-full object-cover shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full flex items-center justify-center bg-df-tertiary-container text-df-on-tertiary-container text-[11px] font-bold shrink-0">
                {initials}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-on-surface truncate leading-none">
                {user.name}
              </p>
              <p className="text-xs text-outline truncate mt-0.5">{user.email}</p>
            </div>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => navigate('/profile')}
          className="gap-2.5 cursor-pointer"
        >
          <User className="size-4 text-outline" aria-hidden="true" />
          Profile
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          variant="destructive"
          onClick={logout}
          className="gap-2.5 cursor-pointer"
        >
          <LogOut className="size-4" aria-hidden="true" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}