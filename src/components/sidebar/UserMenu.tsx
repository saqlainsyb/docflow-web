import { useParams, useNavigate } from 'react-router-dom'
import { MoreVertical, User, LogOut } from 'lucide-react'
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

/**
 * Derives up to two uppercase initials from a display name.
 * "Jane Doe" → "JD", "Alice" → "AL", "" → "?"
 */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0 || parts[0] === '') return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/**
 * Maps a WorkspaceRole to a display-friendly capitalised string.
 * Kept here — purely presentational, not worth a shared utility.
 */
function formatRole(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1)
}

/**
 * UserMenu
 *
 * Bottom-of-sidebar user profile section.
 *
 * Shows:
 *   - Avatar with initials (+ online presence dot)
 *   - Display name (truncated)
 *   - Workspace role — derived from the active workspace's member list.
 *     Falls back to nothing while loading so there's no stale label.
 *
 * Dropdown actions:
 *   - Profile (navigates to /profile — placeholder for Module 9)
 *   - Log out (calls useLogout → server revoke → Redux clear → /login)
 *
 * Role source:
 *   useWorkspace(workspaceId) returns WorkspaceDetail which includes
 *   the members array. We find the current user in that array to get
 *   their role. This is the correct approach — role is workspace-scoped,
 *   not a user-level property.
 */
export function UserMenu() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const navigate = useNavigate()
  const logout = useLogout()

  const user = useAppSelector((state) => state.auth.user)

  // Workspace detail gives us the members array — we need it for the role
  const { data: workspace } = useWorkspace(workspaceId)

  const currentMember = workspace?.members.find(
    (m) => m.user_id === user?.id,
  )
  const role = currentMember ? formatRole(currentMember.role) : null

  // Nothing to render until auth bootstrap completes
  if (!user) return null

  const initials = getInitials(user.name)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="User menu"
          className={cn(
            'w-full flex items-center gap-3 p-3 rounded-xl text-left',
            'hover:bg-surface-container transition-colors duration-150',
            'outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
            'group',
          )}
        >
          {/* ── Avatar ─────────────────────────────────────────────── */}
          <div className="relative shrink-0">
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.name}
                className="w-9 h-9 rounded-full object-cover"
              />
            ) : (
              <div
                className={cn(
                  'w-9 h-9 rounded-full flex items-center justify-center',
                  'bg-df-tertiary-container text-df-on-tertiary-container',
                  'text-xs font-bold select-none',
                )}
              >
                {initials}
              </div>
            )}

            {/* Online presence dot */}
            <span
              aria-hidden="true"
              className={cn(
                'absolute bottom-0 right-0',
                'w-2.5 h-2.5 rounded-full',
                'bg-primary border-2 border-surface-container-low',
              )}
            />
          </div>

          {/* ── Name + role ─────────────────────────────────────────── */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-on-surface truncate leading-none mb-1">
              {user.name}
            </p>
            {role && (
              <p className="text-xs text-outline leading-none truncate">
                {role}
              </p>
            )}
          </div>

          {/* ── More icon ────────────────────────────────────────────── */}
          <MoreVertical
            className="w-4 h-4 text-outline shrink-0 group-hover:text-on-surface transition-colors"
            aria-hidden="true"
          />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        side="top"
        align="start"
        sideOffset={8}
        className="w-56"
      >
        {/* User info header — not interactive */}
        <DropdownMenuLabel className="normal-case tracking-normal text-xs text-on-surface-variant px-2 py-2">
          <p className="font-semibold text-on-surface text-sm truncate">
            {user.name}
          </p>
          <p className="text-outline truncate mt-0.5">{user.email}</p>
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