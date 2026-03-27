// src/components/modals/CreateCardModal.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Modal for adding a new card to a column.
//
// Opened by: dispatch(openModal({ type: 'createCard', columnId }))
//
// We need the boardId to:
//   1. Compute the next position (read board cache)
//   2. Pass to useCreateCard for cache invalidation
//
// The boardId is derived from the board query cache by scanning columns
// for one that contains the target columnId. This avoids threading boardId
// through every openModal dispatch — callers only need to know the columnId.
//
// Color picker:
//   6 swatches matching CardColor exactly. Click to select, click again
//   to deselect. Selected swatch gets a ring + checkmark. RHF stores the
//   value via setValue('color', ...).
//
// Position:
//   after(lastCard.position) in the target column, or 1000 if empty.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { isAxiosError } from 'axios'
import { Loader2, AlertCircle, Check, StickyNote } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useAppDispatch } from '@/store/hooks'
import { closeModal } from '@/store'
import { useCreateCard } from '@/hooks/useCreateCard'
import { boardQueryKey } from '@/hooks/useBoard'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  createCardSchema,
  type CreateCardFormValues,
  type CardColorValue,
} from '@/lib/validations'
import { after } from '@/lib/fractional'
import type { ApiErrorCode, BoardDetailResponse } from '@/lib/types'
import { cn } from '@/lib/utils'

// ── Error mapping ─────────────────────────────────────────────────────────────

const SERVER_ERROR_MESSAGES: Partial<Record<ApiErrorCode, string>> = {
  VALIDATION_ERROR:   'Card title is invalid. Check length and characters.',
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

// ── Color swatches ────────────────────────────────────────────────────────────

const COLOR_SWATCHES: { value: CardColorValue; label: string }[] = [
  { value: '#EF4444', label: 'Red' },
  { value: '#F97316', label: 'Orange' },
  { value: '#EAB308', label: 'Yellow' },
  { value: '#22C55E', label: 'Green' },
  { value: '#3B82F6', label: 'Blue' },
  { value: '#A855F7', label: 'Purple' },
]

// ── CreateCardModal ───────────────────────────────────────────────────────────

interface CreateCardModalProps {
  columnId: string
}

export function CreateCardModal({ columnId }: CreateCardModalProps) {
  const dispatch = useAppDispatch()
  const queryClient = useQueryClient()

  // Derive boardId by scanning all board caches for the column
  // This is safe — query cache is always in sync with the server
  const boardId = (() => {
    const queries = queryClient.getQueriesData<BoardDetailResponse>({
      queryKey: ['boards'],
    })
    for (const [, board] of queries) {
      if (board?.columns.some((col) => col.id === columnId)) {
        return board.id
      }
    }
    return ''
  })()

  const mutation = useCreateCard(columnId, boardId)
  const serverError = getServerError(mutation.error)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<CreateCardFormValues>({
    resolver: zodResolver(createCardSchema),
    defaultValues: { title: '', color: undefined },
  })

  const selectedColor = watch('color')

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

  function handleColorClick(color: CardColorValue) {
    // Toggle: clicking the selected color deselects it
    setValue('color', selectedColor === color ? undefined : color, {
      shouldValidate: true,
    })
  }

  function onSubmit(data: CreateCardFormValues) {
    // Compute position: after last card in this column, or 1000 if empty
    const board = queryClient.getQueryData<BoardDetailResponse>(
      boardQueryKey(boardId),
    )
    const column = board?.columns.find((col) => col.id === columnId)
    const cards = column?.cards ?? []
    const lastPosition = cards.length > 0
      ? Math.max(...cards.map((c) => c.position))
      : 0
    const position = cards.length === 0 ? 1000 : after(lastPosition)

    mutation.mutate(
      {
        title: data.title,
        position,
        ...(data.color ? { color: data.color } : {}),
      },
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
              <StickyNote className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <DialogTitle>New Card</DialogTitle>
              <DialogDescription>
                Add a task or item to this column.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="space-y-6 mt-2"
        >
          {/* ── Card title ───────────────────────────────────────────────── */}
          <div className="space-y-2">
            <label
              htmlFor="card-title"
              className="text-xs font-medium uppercase tracking-[0.15em] text-outline"
            >
              Card Title
            </label>
            <input
              id="card-title"
              type="text"
              autoComplete="off"
              autoFocus
              placeholder="e.g. Research competitor pricing"
              aria-invalid={!!errors.title}
              aria-describedby={errors.title ? 'card-title-error' : undefined}
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
                id="card-title-error"
                role="alert"
                className="flex items-center gap-1 text-[11px] font-medium text-destructive"
              >
                <AlertCircle className="size-3 shrink-0" />
                {errors.title.message}
              </p>
            )}
          </div>

          {/* ── Color picker ─────────────────────────────────────────────── */}
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-[0.15em] text-outline">
              Color Label{' '}
              <span className="normal-case text-outline/60 tracking-normal">
                (optional)
              </span>
            </label>
            <div
              className="flex items-center gap-3"
              role="group"
              aria-label="Card color"
            >
              {COLOR_SWATCHES.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => handleColorClick(value)}
                  aria-label={`${label}${selectedColor === value ? ' (selected)' : ''}`}
                  aria-pressed={selectedColor === value}
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center',
                    'transition-all duration-150',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-container-highest',
                    selectedColor === value
                      ? 'ring-2 ring-offset-2 ring-offset-surface-container-highest scale-110'
                      : 'hover:scale-110 opacity-70 hover:opacity-100',
                  )}
                  style={{
                    backgroundColor: value,
                    // ring color matches the swatch
                    ...(selectedColor === value ? { outlineColor: value } : {}),
                  }}
                >
                  {selectedColor === value && (
                    <Check className="w-4 h-4 text-white drop-shadow" />
                  )}
                </button>
              ))}
            </div>
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
              'Add Card'
            )}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  )
}