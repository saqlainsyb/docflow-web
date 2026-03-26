// src/pages/workspace/SettingsPage.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Workspace settings page — rename and delete.
//
// Sections:
//   1. Rename form  — admin + owner. Pre-populated with current name.
//                     Uses RHF + Zod (renameWorkspaceSchema).
//   2. Danger zone  — owner only. Delete workspace with typed confirmation.
//
// Rename pre-population:
//   RHF defaultValues only run on mount. Since workspace data loads async,
//   we use reset() in a useEffect that watches the workspace query result.
//   This is the standard RHF pattern for edit forms with async initial data.
//
// Delete confirmation:
//   Two-step. First click opens a Dialog. User must type the exact workspace
//   name to unlock the confirm button. Prevents accidental deletion.
//
// Sub-components (page-scoped):
//   SettingsTopbar    — workspace name + breadcrumb
//   RenameSection     — name input + save button
//   DangerZone        — delete trigger + confirmation dialog
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { isAxiosError } from 'axios'
import { Loader2, AlertTriangle, AlertCircle, Check } from 'lucide-react'
import { useAppSelector } from '@/store/hooks'
import { useWorkspace } from '@/hooks/useWorkspace'
import { useRenameWorkspace } from '@/hooks/useRenameWorkspace'
import { useDeleteWorkspace } from '@/hooks/useDeleteWorkspace'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  renameWorkspaceSchema,
  type RenameWorkspaceFormValues,
} from '@/lib/validations'
import type { ApiErrorCode } from '@/lib/types'
import { cn } from '@/lib/utils'

// ── Error mapping ─────────────────────────────────────────────────────────────

const RENAME_ERROR_MESSAGES: Partial<Record<ApiErrorCode, string>> = {
  VALIDATION_ERROR: 'Name is invalid. Check length and characters.',
  INSUFFICIENT_PERMISSIONS: 'You don\'t have permission to rename this workspace.',
  INTERNAL_ERROR: 'Something went wrong. Please try again.',
}

const DELETE_ERROR_MESSAGES: Partial<Record<ApiErrorCode, string>> = {
  INSUFFICIENT_PERMISSIONS: 'Only the workspace owner can delete it.',
  WORKSPACE_NOT_FOUND: 'This workspace no longer exists.',
  INTERNAL_ERROR: 'Something went wrong. Please try again.',
}

const FALLBACK_ERROR = 'Something went wrong. Please try again.'

function getServerError(
  error: unknown,
  map: Partial<Record<ApiErrorCode, string>>,
): string | null {
  if (!isAxiosError<{ error: { code: ApiErrorCode } }>(error)) return null
  const code = error.response?.data?.error?.code
  if (!code) return FALLBACK_ERROR
  return map[code] ?? FALLBACK_ERROR
}

// ── SettingsTopbar ────────────────────────────────────────────────────────────

function SettingsTopbar({ workspaceName }: { workspaceName: string }) {
  return (
    <header className="h-16 flex items-center gap-4 px-8 bg-background/80 backdrop-blur-md border-b border-outline-variant/10 sticky top-0 z-30">
      <h2 className="font-display font-bold text-lg text-on-surface truncate">
        {workspaceName}
      </h2>
      <div className="h-4 w-px bg-outline-variant/30 shrink-0" />
      <span className="text-xs text-outline font-medium">Settings</span>
    </header>
  )
}

// ── RenameSection ─────────────────────────────────────────────────────────────

interface RenameSectionProps {
  workspaceId: string
  currentName: string
  canRename: boolean
}

function RenameSection({ workspaceId, currentName, canRename }: RenameSectionProps) {
  const { mutate: rename, isPending, error, isSuccess, reset } = useRenameWorkspace(workspaceId)
  const serverError = getServerError(error, RENAME_ERROR_MESSAGES)

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset: resetForm,
  } = useForm<RenameWorkspaceFormValues>({
    resolver: zodResolver(renameWorkspaceSchema),
    defaultValues: { name: currentName },
  })

  // Sync form value when workspace data arrives (async initial data pattern)
  useEffect(() => {
    resetForm({ name: currentName })
  }, [currentName, resetForm])

  // Clear mutation success state when user starts editing again
  function handleChange() {
    if (isSuccess) reset()
  }

  function onSubmit(data: RenameWorkspaceFormValues) {
    rename(data)
  }

  return (
    <section aria-labelledby="rename-heading">
      <h2
        id="rename-heading"
        className="font-display font-bold text-xl text-on-surface mb-1"
      >
        Workspace Name
      </h2>
      <p className="text-sm text-outline mb-6">
        This name appears in the sidebar and all workspace communications.
      </p>

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="flex items-start gap-3 max-w-md"
      >
        <div className="flex-1 space-y-1.5">
          <input
            {...register('name')}
            id="workspace-name"
            type="text"
            disabled={!canRename || isPending}
            onChange={(e) => {
              handleChange()
              register('name').onChange(e)
            }}
            className={cn(
              'w-full bg-surface-container-lowest rounded-lg px-4 py-2.5',
              'text-sm text-on-surface',
              'border border-outline-variant/20',
              'focus:outline-none focus:border-primary/30',
              'focus:shadow-[0_0_15px_rgba(0,218,243,0.1)]',
              'transition-all duration-200',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              errors.name && 'border-destructive focus:border-destructive',
            )}
            aria-invalid={!!errors.name}
            aria-describedby={
              errors.name
                ? 'workspace-name-error'
                : serverError
                  ? 'workspace-name-server-error'
                  : undefined
            }
          />
          {errors.name && (
            <p
              id="workspace-name-error"
              role="alert"
              className="flex items-center gap-1 text-[11px] font-medium text-destructive"
            >
              <AlertCircle className="size-3 shrink-0" aria-hidden="true" />
              {errors.name.message}
            </p>
          )}
          {serverError && (
            <p
              id="workspace-name-server-error"
              role="alert"
              className="flex items-center gap-1 text-[11px] font-medium text-destructive"
            >
              <AlertCircle className="size-3 shrink-0" aria-hidden="true" />
              {serverError}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={!canRename || isPending || !isDirty}
          className={cn(
            'px-4 py-2.5 rounded-lg text-sm font-bold shrink-0',
            'transition-all duration-150',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
            'disabled:opacity-50 disabled:pointer-events-none',
            isSuccess && !isDirty
              ? 'bg-primary/10 text-primary'
              : 'bg-surface-container-highest text-on-surface hover:bg-surface-bright',
          )}
        >
          {isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : isSuccess && !isDirty ? (
            <span className="flex items-center gap-1.5">
              <Check className="size-4" aria-hidden="true" />
              Saved
            </span>
          ) : (
            'Save'
          )}
        </button>
      </form>
    </section>
  )
}

// ── DangerZone ────────────────────────────────────────────────────────────────

interface DangerZoneProps {
  workspaceId: string
  workspaceName: string
  isOwner: boolean
}

function DangerZone({ workspaceId, workspaceName, isOwner }: DangerZoneProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [confirmValue, setConfirmValue] = useState('')
  const { mutate: deleteWorkspace, isPending, error } = useDeleteWorkspace(workspaceId)

  const serverError = getServerError(error, DELETE_ERROR_MESSAGES)
  const confirmMatches = confirmValue === workspaceName

  function handleClose(open: boolean) {
    if (!open) setConfirmValue('')
    setDialogOpen(open)
  }

  function handleDelete() {
    if (!confirmMatches) return
    deleteWorkspace()
  }

  return (
    <section
      aria-labelledby="danger-heading"
      className={cn(
        'p-8 rounded-2xl space-y-4',
        'border-2 border-dashed border-destructive/20',
        'bg-destructive/5',
      )}
    >
      <div className="flex items-center gap-3">
        <AlertTriangle
          className="size-5 text-destructive shrink-0"
          aria-hidden="true"
        />
        <h2
          id="danger-heading"
          className="font-display font-bold text-xl text-destructive"
        >
          Danger Zone
        </h2>
      </div>

      <p className="text-sm text-outline max-w-xl">
        Deleting this workspace will permanently remove all boards, columns,
        cards, documents, and member access. This action{' '}
        <span className="font-semibold text-on-surface">cannot be undone.</span>
      </p>

      {!isOwner && (
        <p className="text-xs text-outline italic">
          Only the workspace owner can delete this workspace.
        </p>
      )}

      {isOwner && (
        <button
          onClick={() => setDialogOpen(true)}
          className={cn(
            'px-5 py-2.5 rounded-xl text-sm font-bold',
            'bg-destructive/10 text-destructive',
            'hover:bg-destructive hover:text-background',
            'flex items-center gap-2 transition-colors duration-150',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50',
          )}
        >
          Delete Workspace
        </button>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={dialogOpen} onOpenChange={handleClose}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete workspace</DialogTitle>
            <DialogDescription>
              This will permanently delete{' '}
              <span className="font-semibold text-on-surface">
                {workspaceName}
              </span>{' '}
              and all its contents. To confirm, type the workspace name below.
            </DialogDescription>
          </DialogHeader>

          {/* Typed confirmation input */}
          <div className="space-y-1.5 my-2">
            <label
              htmlFor="delete-confirm"
              className="text-xs font-medium uppercase tracking-[0.15em] text-outline"
            >
              Type <span className="text-on-surface font-bold">{workspaceName}</span> to confirm
            </label>
            <input
              id="delete-confirm"
              type="text"
              value={confirmValue}
              onChange={(e) => setConfirmValue(e.target.value)}
              placeholder={workspaceName}
              autoComplete="off"
              className={cn(
                'w-full bg-surface-container-lowest rounded-lg px-4 py-2.5',
                'text-sm text-on-surface placeholder:text-outline/30',
                'border border-outline-variant/20',
                'focus:outline-none focus:border-destructive/40',
                'transition-all duration-200',
              )}
              aria-describedby={serverError ? 'delete-server-error' : undefined}
            />
          </div>

          {/* Server error */}
          {serverError && (
            <p
              id="delete-server-error"
              role="alert"
              className="flex items-center gap-1.5 text-sm text-destructive"
            >
              <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
              {serverError}
            </p>
          )}

          <DialogFooter>
            <button
              type="button"
              onClick={() => handleClose(false)}
              disabled={isPending}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium',
                'border border-outline-variant/20 text-on-surface-variant',
                'hover:bg-surface-container hover:text-on-surface',
                'transition-colors duration-150',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                'disabled:opacity-50 disabled:pointer-events-none',
              )}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={!confirmMatches || isPending}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-bold',
                'bg-destructive/10 text-destructive',
                'hover:bg-destructive hover:text-background',
                'flex items-center gap-2 transition-colors duration-150',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50',
                'disabled:opacity-40 disabled:pointer-events-none',
              )}
            >
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Deleting…
                </>
              ) : (
                'Delete workspace'
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

// ── SettingsPage ──────────────────────────────────────────────────────────────

export function SettingsPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const currentUser = useAppSelector((state) => state.auth.user)

  const { data: workspace, isLoading } = useWorkspace(workspaceId)

  const currentMember = workspace?.members.find(
    (m) => m.user_id === currentUser?.id,
  )
  const viewerRole = currentMember?.role
  const isOwner = viewerRole === 'owner'
  const canRename = viewerRole === 'owner' || viewerRole === 'admin'

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex h-full min-h-screen items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-outline" />
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Topbar */}
      <SettingsTopbar workspaceName={workspace?.name ?? ''} />

      {/* Page content */}
      <div className="flex-1 p-8">
        <div className="max-w-3xl mx-auto space-y-12">

          {/* Page heading */}
          <div>
            <p className="df-label-editorial text-primary mb-2">
              Configuration
            </p>
            <h1 className="font-display text-4xl font-extrabold tracking-tight text-on-surface">
              Workspace Settings
            </h1>
          </div>

          {/* Divider */}
          <div className="h-px bg-outline-variant/10" />

          {/* Rename section */}
          <RenameSection
            workspaceId={workspaceId ?? ''}
            currentName={workspace?.name ?? ''}
            canRename={canRename}
          />

          {/* Divider */}
          <div className="h-px bg-outline-variant/10" />

          {/* Danger zone */}
          <DangerZone
            workspaceId={workspaceId ?? ''}
            workspaceName={workspace?.name ?? ''}
            isOwner={isOwner}
          />

        </div>
      </div>
    </div>
  )
}