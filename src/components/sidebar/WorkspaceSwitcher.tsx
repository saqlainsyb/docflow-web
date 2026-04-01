import { useNavigate, useParams } from 'react-router-dom'
import { ChevronsUpDown, Check, Plus, Loader2, Building2 } from 'lucide-react'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { useAppDispatch } from '@/store/hooks'
import { openModal } from '@/store'
import { useWorkspaces } from '@/hooks/useWorkspaces'
import { cn } from '@/lib/utils'

/**
 * WorkspaceSwitcher
 *
 * Redesigned — "Obsidian Studio" aesthetic.
 * Same data/logic, elevated presentation:
 *  - Monogram avatar derived from workspace name
 *  - Subtle glow on active item
 *  - Tighter, more intentional spacing
 */

/** Single-letter monogram from workspace name */
function getMonogram(name: string): string {
  return name.trim().charAt(0).toUpperCase()
}

/** Deterministic hue from a workspace ID for the monogram badge */
function getWorkspaceHue(id: string): string {
  const hues = [198, 280, 285, 155, 35, 320]
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0
  return `${hues[Math.abs(hash) % hues.length]}`
}

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
        <button
          aria-label="Switch workspace"
          className={cn(
            'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl',
            'bg-surface-container-high/60 hover:bg-surface-container-high',
            'border border-outline-variant/20 hover:border-outline-variant/35',
            'transition-all duration-200 group outline-none',
            'focus-visible:ring-2 focus-visible:ring-primary/40',
          )}
        >
          {/* Workspace monogram badge */}
          <div
            className={cn(
              'w-7 h-7 rounded-lg flex items-center justify-center shrink-0',
              'text-[11px] font-bold select-none',
              'transition-all duration-200',
            )}
            style={{
              background: activeWorkspace
                ? `oklch(0.42 0.12 ${getWorkspaceHue(activeWorkspace.id)})`
                : 'oklch(0.27 0.015 265)',
              color: 'oklch(0.92 0.015 265)',
            }}
          >
            {isLoading ? (
              <Loader2 className="w-3 h-3 animate-spin opacity-60" />
            ) : (
              <span>{activeWorkspace ? getMonogram(activeWorkspace.name) : '?'}</span>
            )}
          </div>

          {/* Label group */}
          <div className="flex-1 min-w-0 text-left">
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-outline leading-none mb-[3px]">
              Workspace
            </p>
            {isLoading ? (
              <div className="h-3 w-20 rounded bg-surface-container-highest/60 animate-pulse" />
            ) : (
              <p className="text-[13px] font-semibold text-on-surface truncate leading-none">
                {activeWorkspace?.name ?? 'Select workspace'}
              </p>
            )}
          </div>

          {/* Chevron */}
          <ChevronsUpDown
            className="w-3.5 h-3.5 text-outline/60 shrink-0 group-hover:text-outline transition-colors"
            aria-hidden="true"
          />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={6}
        className="w-[232px] p-1.5"
      >
        {/* Section header */}
        <div className="px-2 pt-1 pb-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-outline">
            Your Workspaces
          </p>
        </div>

        {/* Workspace list */}
        <div className="space-y-px">
          {isLoading ? (
            <div className="flex items-center justify-center py-5">
              <Loader2 className="w-4 h-4 animate-spin text-outline" />
            </div>
          ) : workspaces && workspaces.length > 0 ? (
            workspaces.map((ws) => {
              const isActive = ws.id === workspaceId
              const hue = getWorkspaceHue(ws.id)
              return (
                <button
                  key={ws.id}
                  onClick={() => handleSelect(ws.id)}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-left',
                    'transition-all duration-150 outline-none',
                    'focus-visible:ring-2 focus-visible:ring-primary/50',
                    isActive
                      ? 'bg-primary/[0.08] border border-primary/[0.12]'
                      : 'hover:bg-surface-container border border-transparent',
                  )}
                >
                  {/* Monogram */}
                  <div
                    className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 text-[10px] font-bold"
                    style={{
                      background: `oklch(0.38 0.10 ${hue})`,
                      color: 'oklch(0.92 0.015 265)',
                    }}
                  >
                    {getMonogram(ws.name)}
                  </div>

                  <span
                    className={cn(
                      'text-[13px] font-medium truncate flex-1 leading-none',
                      isActive ? 'text-primary' : 'text-on-surface-variant',
                    )}
                  >
                    {ws.name}
                  </span>

                  {isActive && (
                    <Check
                      className="w-3.5 h-3.5 text-primary shrink-0"
                      strokeWidth={2.5}
                    />
                  )}
                </button>
              )
            })
          ) : (
            <p className="px-2 py-3 text-sm text-outline">No workspaces yet.</p>
          )}
        </div>

        {/* Divider */}
        <div className="h-px bg-outline-variant/20 my-1.5 mx-1" />

        {/* Create workspace */}
        <button
          onClick={handleCreate}
          className={cn(
            'w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-left',
            'text-on-surface-variant hover:text-primary hover:bg-primary/[0.06]',
            'transition-all duration-150 outline-none group',
            'focus-visible:ring-2 focus-visible:ring-primary/50',
          )}
        >
          <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 bg-surface-container-high border border-outline-variant/20">
            <Plus className="w-3.5 h-3.5" strokeWidth={2} />
          </div>
          <span className="text-[13px] font-semibold">New Workspace</span>
        </button>
      </PopoverContent>
    </Popover>
  )
}