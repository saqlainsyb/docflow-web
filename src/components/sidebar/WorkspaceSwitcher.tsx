import { useNavigate, useParams } from 'react-router-dom'
import { Network, ChevronsUpDown, Check, Plus, Loader2 } from 'lucide-react'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { useAppDispatch } from '@/store/hooks'
import { openModal } from '@/store'
import { useWorkspaces } from '@/hooks/useWorkspaces'
import { cn } from '@/lib/utils'

/**
 * WorkspaceSwitcher
 *
 * Displays the active workspace name and provides a popover for:
 *   - Switching to a different workspace (navigates to /:workspaceId/boards)
 *   - Creating a new workspace (opens the createWorkspace modal)
 *
 * Active workspace is derived from the URL param (:workspaceId) — the URL
 * is the single source of truth. No separate Redux state needed.
 *
 * Data: workspace list comes from TanStack Query via useWorkspaces.
 */
export function WorkspaceSwitcher() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const { data: workspaces, isLoading } = useWorkspaces()

  const activeWorkspace = workspaces?.find((ws) => ws.id === workspaceId)

  function handleSelect(id: string) {
    navigate(`/${id}/boards`)
  }

  function handleCreate() {
    dispatch(openModal({ type: 'createWorkspace' }))
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        {/* Trigger button — full width, shows active workspace */}
        <button
          aria-label="Switch workspace"
          className={cn(
            'w-full flex items-center justify-between gap-3 p-3 rounded-xl',
            'bg-surface-container hover:bg-surface-container-high',
            'transition-colors duration-150 group outline-none',
            'focus-visible:ring-2 focus-visible:ring-primary/50',
          )}
        >
          {/* Left — icon + label */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Network className="w-4 h-4 text-df-primary-fixed-dim" />
            </div>
            <div className="text-left min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-outline leading-none mb-1">
                Workspace
              </p>
              {isLoading ? (
                <Loader2 className="w-3 h-3 animate-spin text-on-surface-variant" />
              ) : (
                <p className="text-sm font-semibold text-on-surface truncate leading-none">
                  {activeWorkspace?.name ?? 'Select workspace'}
                </p>
              )}
            </div>
          </div>

          {/* Right — chevron */}
          <ChevronsUpDown className="w-4 h-4 text-outline shrink-0 group-hover:text-on-surface transition-colors" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={8}
        className="w-64 p-2"
      >
        {/* Section label */}
        <p className="px-2 py-1.5 text-[10px] font-medium uppercase tracking-[0.15em] text-outline">
          Your Workspaces
        </p>

        {/* Workspace list */}
        <div className="space-y-0.5 mb-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-outline" />
            </div>
          ) : workspaces && workspaces.length > 0 ? (
            workspaces.map((ws) => {
              const isActive = ws.id === workspaceId
              return (
                <button
                  key={ws.id}
                  onClick={() => handleSelect(ws.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-2 py-2 rounded-lg text-left',
                    'transition-colors duration-150 outline-none',
                    'focus-visible:ring-2 focus-visible:ring-primary/50',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface',
                  )}
                >
                  {/* Active indicator dot */}
                  <div
                    className={cn(
                      'w-2 h-2 rounded-full shrink-0 transition-colors',
                      isActive
                        ? 'bg-primary shadow-[0_0_8px_var(--df-primary)]'
                        : 'bg-outline-variant',
                    )}
                  />
                  <span className="text-sm font-medium truncate flex-1">
                    {ws.name}
                  </span>
                  {isActive && (
                    <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                  )}
                </button>
              )
            })
          ) : (
            <p className="px-2 py-2 text-sm text-outline">
              No workspaces yet.
            </p>
          )}
        </div>

        {/* Divider */}
        <div className="h-px bg-outline-variant/15 my-1" />

        {/* Create workspace */}
        <button
          onClick={handleCreate}
          className={cn(
            'w-full flex items-center gap-3 px-2 py-2 rounded-lg text-left',
            'text-primary hover:bg-primary/10',
            'transition-colors duration-150 outline-none',
            'focus-visible:ring-2 focus-visible:ring-primary/50',
          )}
        >
          <Plus className="w-4 h-4 shrink-0" />
          <span className="text-sm font-bold">Create Workspace</span>
        </button>
      </PopoverContent>
    </Popover>
  )
}