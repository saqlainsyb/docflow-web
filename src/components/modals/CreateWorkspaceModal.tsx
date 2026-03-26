// src/components/modals/CreateWorkspaceModal.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Modal for creating a new workspace.
//
// Opened by: dispatch(openModal({ type: 'createWorkspace' }))
// Closed by: dispatch(closeModal()) — via the X button, Cancel, or success
//
// On success:
//   useCreateWorkspace navigates to /:newWorkspaceId/boards automatically
//   and invalidates the workspace list. The modal just needs to close.
//
// Error handling:
//   SERVER_ERROR_MESSAGES maps ApiErrorCodes to user-facing strings.
//   The raw AxiosError lives on mutation.error — read here, not in the hook.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { isAxiosError } from 'axios'
import { Loader2, AlertCircle, Plus } from 'lucide-react'
import { useAppDispatch } from '@/store/hooks'
import { closeModal } from '@/store'
import { useCreateWorkspace } from '@/hooks/useCreateWorkspace'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  createWorkspaceSchema,
  type CreateWorkspaceFormValues,
} from '@/lib/validations'
import type { ApiErrorCode } from '@/lib/types'
import { cn } from '@/lib/utils'

// ── Error mapping ─────────────────────────────────────────────────────────────

const SERVER_ERROR_MESSAGES: Partial<Record<ApiErrorCode, string>> = {
  VALIDATION_ERROR: 'Name is invalid. Check length and try again.',
  RATE_LIMITED: 'Too many attempts. Please wait a moment.',
  INTERNAL_ERROR: 'Something went wrong. Please try again.',
}

const FALLBACK_ERROR = 'Something went wrong. Please try again.'

function getServerError(error: unknown): string | null {
  if (!isAxiosError<{ error: { code: ApiErrorCode } }>(error)) return null
  const code = error.response?.data?.error?.code
  if (!code) return FALLBACK_ERROR
  return SERVER_ERROR_MESSAGES[code] ?? FALLBACK_ERROR
}

// ── CreateWorkspaceModal ──────────────────────────────────────────────────────

interface CreateWorkspaceModalProps {
  open: boolean
}

export function CreateWorkspaceModal({ open }: CreateWorkspaceModalProps) {
  const dispatch = useAppDispatch()
  const { mutate: create, isPending, error, reset: resetMutation } = useCreateWorkspace()

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset: resetForm,
    setFocus,
  } = useForm<CreateWorkspaceFormValues>({
    resolver: zodResolver(createWorkspaceSchema),
    defaultValues: { name: '' },
  })

  // Focus the input when the dialog opens
  useEffect(() => {
    if (open) {
      // Small delay — Radix Dialog animates in, focus before animation
      // ends causes layout shift in some browsers
      const t = setTimeout(() => setFocus('name'), 50)
      return () => clearTimeout(t)
    }
  }, [open, setFocus])

  const serverError = getServerError(error)

  function handleClose() {
    resetForm()
    resetMutation()
    dispatch(closeModal())
  }

  function handleOpenChange(open: boolean) {
    if (!open) handleClose()
  }

  function onSubmit(data: CreateWorkspaceFormValues) {
    create(data, {
      onSuccess: () => {
        // useCreateWorkspace already navigates to the new workspace —
        // just clean up the form and close the modal
        handleClose()
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Workspace</DialogTitle>
          <DialogDescription>
            Workspaces are shared environments where your team collaborates on
            boards. Give it a clear, recognisable name.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="space-y-4"
        >
          {/* Name field */}
          <div className="space-y-1.5">
            <label
              htmlFor="workspace-name-create"
              className="text-xs font-medium uppercase tracking-[0.15em] text-outline"
            >
              Workspace name
            </label>
            <input
              {...register('name')}
              id="workspace-name-create"
              type="text"
              placeholder="e.g. Acme Corp, Personal Projects…"
              autoComplete="off"
              className={cn(
                'w-full bg-surface-container-lowest rounded-lg px-4 py-2.5',
                'text-sm text-on-surface placeholder:text-outline/50',
                'border border-outline-variant/20',
                'focus:outline-none focus:border-primary/30',
                'focus:shadow-[0_0_15px_rgba(0,218,243,0.1)]',
                'transition-all duration-200',
                errors.name && 'border-destructive focus:border-destructive',
              )}
              aria-invalid={!!errors.name}
              aria-describedby={
                errors.name
                  ? 'workspace-name-create-error'
                  : serverError
                    ? 'workspace-name-create-server-error'
                    : undefined
              }
            />

            {errors.name && (
              <p
                id="workspace-name-create-error"
                role="alert"
                className="flex items-center gap-1 text-[11px] font-medium text-destructive"
              >
                <AlertCircle className="size-3 shrink-0" aria-hidden="true" />
                {errors.name.message}
              </p>
            )}
          </div>

          {/* Server error */}
          {serverError && (
            <p
              id="workspace-name-create-server-error"
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
              onClick={handleClose}
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
              type="submit"
              disabled={isPending}
              className={cn(
                'df-gradient-cta px-4 py-2 rounded-lg',
                'text-sm font-bold text-primary-foreground',
                'flex items-center gap-2',
                'hover:opacity-90 transition-opacity',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                'disabled:opacity-70 disabled:pointer-events-none',
              )}
            >
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Creating…
                </>
              ) : (
                <>
                  <Plus className="size-4" aria-hidden="true" />
                  Create workspace
                </>
              )}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}