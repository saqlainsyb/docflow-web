// src/components/modals/CreateBoardModal.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Modal for creating a new board inside a workspace.
//
// Opened by: dispatch(openModal({ type: 'createBoard', workspaceId }))
// Closed by: dispatch(closeModal()) — X button, Cancel, or on success
//
// On success:
//   useCreateBoard navigates to /:workspaceId/boards/:newBoardId automatically
//   and invalidates the workspace board list. The modal just needs to close.
//
// Visibility toggle:
//   Rendered as a segmented two-button control (not a <select>) to match
//   the design spec exactly. RHF watches the 'visibility' field and we
//   call setValue() on button click.
//
// Error handling:
//   SERVER_ERROR_MESSAGES maps ApiErrorCodes to user-facing strings.
//   Raw AxiosError lives on mutation.error — read here, not in the hook.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { isAxiosError } from 'axios'
import { Loader2, AlertCircle, Globe, Lock, LayoutDashboard } from 'lucide-react'
import { useAppDispatch } from '@/store/hooks'
import { closeModal } from '@/store'
import { useCreateBoard } from '@/hooks/useCreateBoard'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  createBoardSchema,
  type CreateBoardFormValues,
} from '@/lib/validations'
import type { ApiErrorCode } from '@/lib/types'
import { cn } from '@/lib/utils'

// ── Error mapping ─────────────────────────────────────────────────────────────

const SERVER_ERROR_MESSAGES: Partial<Record<ApiErrorCode, string>> = {
  VALIDATION_ERROR:         'Board title is invalid. Check length and characters.',
  INSUFFICIENT_PERMISSIONS: 'Only admins and owners can create boards.',
  WORKSPACE_NOT_FOUND:      'This workspace no longer exists.',
  INTERNAL_ERROR:           'Something went wrong. Please try again.',
}

const FALLBACK_ERROR = 'Something went wrong. Please try again.'

function getServerError(error: unknown): string | null {
  if (!isAxiosError<{ error: { code: ApiErrorCode } }>(error)) return null
  const code = error.response?.data?.error?.code
  if (!code) return FALLBACK_ERROR
  return SERVER_ERROR_MESSAGES[code] ?? FALLBACK_ERROR
}

// ── CreateBoardModal ──────────────────────────────────────────────────────────

interface CreateBoardModalProps {
  workspaceId: string
}

export function CreateBoardModal({ workspaceId }: CreateBoardModalProps) {
  const dispatch = useAppDispatch()
  const mutation = useCreateBoard(workspaceId)
  const serverError = getServerError(mutation.error)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<CreateBoardFormValues>({
    resolver: zodResolver(createBoardSchema),
    defaultValues: {
      title: '',
      visibility: 'workspace',
    },
  })

  const visibility = watch('visibility')

  // Reset form state when modal closes so it's clean on next open
  useEffect(() => {
    return () => {
      reset()
      mutation.reset()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleClose() {
    dispatch(closeModal())
  }

  function onSubmit(data: CreateBoardFormValues) {
    mutation.mutate(data, {
      onSuccess: () => {
        dispatch(closeModal())
      },
    })
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) handleClose() }}>
      <DialogContent showCloseButton>
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div
              className={cn(
                'w-10 h-10 rounded-xl df-gradient-logo',
                'flex items-center justify-center shrink-0',
              )}
            >
              <LayoutDashboard className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <DialogTitle>New Board</DialogTitle>
              <DialogDescription>
                Set up a workspace for your team's work.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="space-y-6 mt-2"
        >
          {/* ── Board title ─────────────────────────────────────────────── */}
          <div className="space-y-2">
            <label
              htmlFor="board-title"
              className="text-xs font-medium uppercase tracking-[0.15em] text-outline"
            >
              Board Title
            </label>
            <input
              id="board-title"
              type="text"
              autoComplete="off"
              autoFocus
              placeholder="e.g. Q1 Growth Strategy"
              aria-invalid={!!errors.title}
              aria-describedby={errors.title ? 'board-title-error' : undefined}
              {...register('title')}
              className={cn(
                'w-full bg-surface-container-lowest rounded-2xl px-4 py-4',
                'text-sm text-on-surface placeholder:text-outline/40',
                'border border-transparent',
                'focus:outline-none focus:border-primary/30',
                'focus:shadow-[0_0_15px_rgba(0,218,243,0.1)]',
                'transition-all duration-200',
                errors.title && 'border-destructive/50',
              )}
            />
            {errors.title && (
              <p
                id="board-title-error"
                role="alert"
                className="flex items-center gap-1 text-[11px] font-medium text-destructive"
              >
                <AlertCircle className="size-3 shrink-0" />
                {errors.title.message}
              </p>
            )}
          </div>

          {/* ── Visibility toggle ────────────────────────────────────────── */}
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-[0.15em] text-outline">
              Visibility
            </label>
            <div
              className="flex p-1 bg-surface-container-lowest rounded-2xl"
              role="group"
              aria-label="Board visibility"
            >
              <button
                type="button"
                onClick={() => setValue('visibility', 'workspace', { shouldValidate: true })}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 py-3 rounded-xl',
                  'text-sm font-bold transition-all duration-200',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                  visibility === 'workspace'
                    ? 'bg-primary-container/20 text-df-primary-fixed-dim'
                    : 'text-outline hover:text-on-surface',
                )}
                aria-pressed={visibility === 'workspace'}
              >
                <Globe className="w-4 h-4" />
                Workspace
              </button>
              <button
                type="button"
                onClick={() => setValue('visibility', 'private', { shouldValidate: true })}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 py-3 rounded-xl',
                  'text-sm font-bold transition-all duration-200',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                  visibility === 'private'
                    ? 'bg-surface-container-highest text-on-surface'
                    : 'text-outline hover:text-on-surface',
                )}
                aria-pressed={visibility === 'private'}
              >
                <Lock className="w-4 h-4" />
                Private
              </button>
            </div>
            <p className="text-[11px] text-outline pl-1">
              {visibility === 'workspace'
                ? 'All workspace members can view and edit this board.'
                : 'Only members explicitly added to this board can access it.'}
            </p>
          </div>

          {/* ── Server error ─────────────────────────────────────────────── */}
          {serverError && (
            <p
              role="alert"
              className="flex items-center gap-1.5 text-sm text-destructive"
            >
              <AlertCircle className="size-4 shrink-0" />
              {serverError}
            </p>
          )}

          {/* ── Submit ───────────────────────────────────────────────────── */}
          <button
            type="submit"
            disabled={mutation.isPending}
            className={cn(
              'w-full df-gradient-cta py-4 rounded-2xl',
              'font-bold text-sm text-primary-foreground',
              'shadow-xl shadow-primary/20',
              'hover:opacity-90 transition-opacity',
              'flex items-center justify-center gap-2',
              'disabled:opacity-70 disabled:pointer-events-none',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
            )}
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Creating…
              </>
            ) : (
              'Create Board'
            )}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  )
}