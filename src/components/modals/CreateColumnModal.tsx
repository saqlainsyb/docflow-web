// src/components/modals/CreateColumnModal.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Modal for adding a new column to a board.
//
// Opened by: dispatch(openModal({ type: 'createColumn', boardId }))
//
// Position computation:
//   We read the current board from the TanStack Query cache to find the
//   last column's position, then call fractional.after() to place the
//   new column at the end. This keeps the hook position-agnostic and
//   ensures we always use the freshest position data available.
//
// Error handling:
//   Raw AxiosError on mutation.error — mapped to string here.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { isAxiosError } from 'axios'
import { Loader2, AlertCircle, Columns } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useAppDispatch } from '@/store/hooks'
import { closeModal } from '@/store'
import { useCreateColumn } from '@/hooks/useCreateColumn'
import { boardQueryKey } from '@/hooks/useBoard'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  createColumnSchema,
  type CreateColumnFormValues,
} from '@/lib/validations'
import { after } from '@/lib/fractional'
import type { ApiErrorCode, BoardDetailResponse } from '@/lib/types'
import { cn } from '@/lib/utils'

// ── Error mapping ─────────────────────────────────────────────────────────────

const SERVER_ERROR_MESSAGES: Partial<Record<ApiErrorCode, string>> = {
  VALIDATION_ERROR:   'Column title is invalid. Check length and characters.',
  BOARD_ACCESS_DENIED: 'You don\'t have access to this board.',
  BOARD_NOT_FOUND:    'This board no longer exists.',
  INTERNAL_ERROR:     'Something went wrong. Please try again.',
}

const FALLBACK_ERROR = 'Something went wrong. Please try again.'

function getServerError(error: unknown): string | null {
  if (!isAxiosError<{ error: { code: ApiErrorCode } }>(error)) return null
  const code = error.response?.data?.error?.code
  if (!code) return FALLBACK_ERROR
  return SERVER_ERROR_MESSAGES[code] ?? FALLBACK_ERROR
}

// ── CreateColumnModal ─────────────────────────────────────────────────────────

interface CreateColumnModalProps {
  boardId: string
}

export function CreateColumnModal({ boardId }: CreateColumnModalProps) {
  const dispatch = useAppDispatch()
  const queryClient = useQueryClient()
  const mutation = useCreateColumn(boardId)
  const serverError = getServerError(mutation.error)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateColumnFormValues>({
    resolver: zodResolver(createColumnSchema),
    defaultValues: { title: '' },
  })

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

  function onSubmit(data: CreateColumnFormValues) {
    // Read current columns from cache to compute the next position
    const board = queryClient.getQueryData<BoardDetailResponse>(
      boardQueryKey(boardId),
    )
    const columns = board?.columns ?? []
    const lastPosition = columns.length > 0
      ? Math.max(...columns.map((c) => c.position))
      : 0
    const position = columns.length === 0 ? 1000 : after(lastPosition)

    mutation.mutate(
      { title: data.title, position },
      { onSuccess: () => dispatch(closeModal()) },
    )
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
              <Columns className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <DialogTitle>New Column</DialogTitle>
              <DialogDescription>
                Add a new stage to your board.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="space-y-6 mt-2"
        >
          {/* ── Column title ─────────────────────────────────────────────── */}
          <div className="space-y-2">
            <label
              htmlFor="column-title"
              className="text-xs font-medium uppercase tracking-[0.15em] text-outline"
            >
              Column Title
            </label>
            <input
              id="column-title"
              type="text"
              autoComplete="off"
              autoFocus
              placeholder="e.g. In Review"
              aria-invalid={!!errors.title}
              aria-describedby={errors.title ? 'column-title-error' : undefined}
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
                id="column-title-error"
                role="alert"
                className="flex items-center gap-1 text-[11px] font-medium text-destructive"
              >
                <AlertCircle className="size-3 shrink-0" />
                {errors.title.message}
              </p>
            )}
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
              'Add Column'
            )}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  )
}