// src/components/modals/CreateColumnModal.tsx
// ─────────────────────────────────────────────────────────────────────────────
// REDESIGNED: Premium column creation modal — "Obsidian Studio" aesthetic.
//
// Design features:
//   • Column icon with cycling accent color dots (shows the palette)
//   • Input with focus glow ring matching the column color system
//   • Live column preview strip showing what the header will look like
//   • Accent color preview pulled from the next available column slot
//   • AnimatePresence on errors, smooth height animation
//   • Shimmer CTA button consistent with other modals
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { isAxiosError } from 'axios'
import { Loader2, AlertCircle, Columns3 } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'motion/react'
import { useAppDispatch } from '@/store/hooks'
import { closeModal } from '@/store'
import { useCreateColumn } from '@/hooks/useCreateColumn'
import { boardQueryKey } from '@/hooks/useBoard'
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
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
  VALIDATION_ERROR:    'Column title is invalid. Check length and characters.',
  BOARD_ACCESS_DENIED: "You don't have access to this board.",
  BOARD_NOT_FOUND:     'This board no longer exists.',
  INTERNAL_ERROR:      'Something went wrong. Please try again.',
}

function getServerError(error: unknown): string | null {
  if (!isAxiosError<{ error: { code: ApiErrorCode } }>(error)) return null
  const code = error.response?.data?.error?.code
  if (!code) return 'Something went wrong. Please try again.'
  return SERVER_ERROR_MESSAGES[code] ?? 'Something went wrong. Please try again.'
}

// ── Column accent colors (mirrors BoardPage) ──────────────────────────────────

const COLUMN_ACCENT_COLORS = [
  { dot: '#00DAF3', glow: 'rgba(0,218,243,0.18)' },
  { dot: '#A78BFA', glow: 'rgba(167,139,250,0.18)' },
  { dot: '#34D399', glow: 'rgba(52,211,153,0.18)' },
  { dot: '#FB923C', glow: 'rgba(251,146,60,0.18)' },
  { dot: '#60A5FA', glow: 'rgba(96,165,250,0.18)' },
  { dot: '#F472B6', glow: 'rgba(244,114,182,0.18)' },
]

// ── Mini column header preview ────────────────────────────────────────────────

function ColumnPreview({ title, accent }: { title: string; accent: { dot: string } }) {
  const hasTitle = title.trim().length > 0

  return (
    <div
      className="rounded-xl overflow-hidden px-4 py-3.5 flex items-center gap-2.5"
      style={{
        background: 'linear-gradient(175deg, oklch(0.195 0.016 265 / 0.82) 0%, oklch(0.165 0.014 265 / 0.80) 100%)',
        border: '1px solid rgba(255,255,255,0.065)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.24)',
      }}
    >
      {/* Accent dot */}
      <motion.div
        animate={{ backgroundColor: accent.dot }}
        transition={{ duration: 0.3 }}
        className="w-2 h-2 rounded-full shrink-0"
        style={{ boxShadow: `0 0 6px ${accent.dot}` }}
      />

      {/* Title */}
      <span
        className="text-[11px] font-bold uppercase tracking-[0.12em] truncate flex-1"
        style={{
          color: hasTitle ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.20)',
          fontFamily: 'var(--df-font-display)',
          fontStyle: hasTitle ? 'normal' : 'italic',
        }}
      >
        {hasTitle ? title : 'Column title…'}
      </span>

      {/* Count badge */}
      <div
        className="shrink-0 h-5 px-1.5 rounded-full flex items-center justify-center text-[10px] font-bold"
        style={{
          background: 'rgba(255,255,255,0.06)',
          color: 'rgba(255,255,255,0.28)',
          border: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        0
      </div>
    </div>
  )
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
    watch,
    reset,
    formState: { errors },
  } = useForm<CreateColumnFormValues>({
    resolver: zodResolver(createColumnSchema),
    defaultValues: { title: '' },
  })

  const titleValue = watch('title')

  // Derive which accent color slot this new column will get
  const board = queryClient.getQueryData<BoardDetailResponse>(boardQueryKey(boardId))
  const nextAccentIndex = (board?.columns.length ?? 0) % COLUMN_ACCENT_COLORS.length
  const nextAccent = COLUMN_ACCENT_COLORS[nextAccentIndex]

  useEffect(() => {
    return () => { reset(); mutation.reset() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function onSubmit(data: CreateColumnFormValues) {
    const board = queryClient.getQueryData<BoardDetailResponse>(boardQueryKey(boardId))
    const columns = board?.columns ?? []
    const lastPosition = columns.length > 0 ? Math.max(...columns.map((c) => c.position)) : 0
    const position = columns.length === 0 ? 1000 : after(lastPosition)

    mutation.mutate(
      { title: data.title, position },
      { onSuccess: () => dispatch(closeModal()) },
    )
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) dispatch(closeModal()) }}>
      <DialogPortal>
        <DialogOverlay />
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-[400px]"
          style={{
            background: 'oklch(0.17 0.016 265 / 0.97)',
            backdropFilter: 'blur(32px) saturate(180%)',
            border: '1px solid rgba(255,255,255,0.085)',
            borderRadius: '1.5rem',
            boxShadow: '0 32px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(0,218,243,0.06), inset 0 1px 0 rgba(255,255,255,0.06)',
            padding: '2rem',
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Add new column"
        >
          {/* Ambient top glow in accent color */}
          <motion.div
            animate={{ background: `radial-gradient(ellipse at top, ${nextAccent.dot}12 0%, transparent 70%)` }}
            transition={{ duration: 0.5 }}
            className="absolute top-0 left-1/2 -translate-x-1/2 w-56 h-20 pointer-events-none rounded-full"
          />

          {/* ── Header ──────────────────────────────────────────────── */}
          <div className="flex items-start justify-between mb-6 relative z-10">
            <div className="flex items-center gap-3.5">
              {/* Icon badge with accent-tinted border */}
              <motion.div
                animate={{ boxShadow: `0 4px 16px ${nextAccent.dot}30, inset 0 1px 0 rgba(255,255,255,0.25)` }}
                transition={{ duration: 0.5 }}
                className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                style={{
                  background: 'linear-gradient(135deg, oklch(0.82 0.14 198) 0%, oklch(0.42 0.09 198) 100%)',
                }}
              >
                <Columns3 className="w-5 h-5" style={{ color: 'oklch(0.10 0.015 265)' }} />
              </motion.div>
              <div>
                <h2
                  className="text-[18px] font-bold leading-tight"
                  style={{ color: 'oklch(0.91 0.015 265)', fontFamily: 'var(--df-font-display)' }}
                >
                  New Column
                </h2>
                <p className="text-[12px] mt-0.5" style={{ color: 'rgba(255,255,255,0.38)' }}>
                  Add a new stage to your board
                </p>
              </div>
            </div>

            {/* Close */}
            <button
              onClick={() => dispatch(closeModal())}
              className="w-8 h-8 rounded-xl flex items-center justify-center transition-all focus:outline-none"
              style={{ color: 'rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.8)'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.10)' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.35)'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)' }}
              aria-label="Close"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5 relative z-10">
            {/* ── Column title ───────────────────────────────────────── */}
            <div className="space-y-2">
              <label
                htmlFor="column-title"
                className="block text-[11px] font-bold uppercase tracking-[0.14em]"
                style={{ color: 'rgba(255,255,255,0.40)' }}
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
                {...register('title')}
                className="w-full px-4 py-3.5 rounded-xl text-sm outline-none transition-all"
                style={{
                  background: 'rgba(255,255,255,0.045)',
                  border: errors.title
                    ? '1px solid rgba(239,68,68,0.45)'
                    : '1px solid rgba(255,255,255,0.08)',
                  color: 'oklch(0.91 0.015 265)',
                  fontFamily: 'var(--df-font-body)',
                }}
                onFocus={(e) => {
                  if (!errors.title) {
                    (e.currentTarget as HTMLElement).style.border = `1px solid ${nextAccent.dot}55`
                    ;(e.currentTarget as HTMLElement).style.boxShadow = `0 0 0 3px ${nextAccent.dot}10`
                  }
                }}
                onBlur={(e) => {
                  if (!errors.title) {
                    (e.currentTarget as HTMLElement).style.border = '1px solid rgba(255,255,255,0.08)'
                    ;(e.currentTarget as HTMLElement).style.boxShadow = 'none'
                  }
                }}
              />
              <AnimatePresence>
                {errors.title && (
                  <motion.p
                    initial={{ opacity: 0, y: -4, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, y: -4, height: 0 }}
                    transition={{ duration: 0.18 }}
                    className="flex items-center gap-1.5 text-[11px] font-medium"
                    style={{ color: 'oklch(0.65 0.22 25)' }}
                    role="alert"
                  >
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    {errors.title.message}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* ── Column preview ─────────────────────────────────────── */}
            <div className="space-y-2">
              <p
                className="text-[11px] font-bold uppercase tracking-[0.14em]"
                style={{ color: 'rgba(255,255,255,0.40)' }}
              >
                Preview
              </p>
              <ColumnPreview title={titleValue} accent={nextAccent} />
            </div>

            {/* ── Accent palette dots hint ──────────────────────────── */}
            <div className="flex items-center gap-2">
              <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.22)' }}>
                Accent
              </span>
              <div className="flex items-center gap-1.5">
                {COLUMN_ACCENT_COLORS.map((accent, i) => (
                  <div
                    key={accent.dot}
                    className="w-2 h-2 rounded-full transition-all duration-300"
                    style={{
                      backgroundColor: accent.dot,
                      opacity: i === nextAccentIndex ? 1 : 0.25,
                      transform: i === nextAccentIndex ? 'scale(1.4)' : 'scale(1)',
                      boxShadow: i === nextAccentIndex ? `0 0 6px ${accent.dot}` : 'none',
                    }}
                  />
                ))}
              </div>
              <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.22)' }}>
                auto-assigned
              </span>
            </div>

            {/* ── Server error ───────────────────────────────────────── */}
            <AnimatePresence>
              {serverError && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-[12px] font-medium"
                  style={{
                    background: 'rgba(239,68,68,0.08)',
                    border: '1px solid rgba(239,68,68,0.20)',
                    color: 'oklch(0.75 0.18 25)',
                  }}
                  role="alert"
                >
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {serverError}
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Submit ─────────────────────────────────────────────── */}
            <SubmitButton isPending={mutation.isPending} label="Add Column" pendingLabel="Adding…" accentColor={nextAccent.dot} />
          </form>
        </motion.div>
      </DialogPortal>
    </Dialog>
  )
}

// ── Shared submit button ──────────────────────────────────────────────────────

function SubmitButton({
  isPending,
  label,
  pendingLabel,
  accentColor = '#00DAF3',
}: {
  isPending: boolean
  label: string
  pendingLabel: string
  accentColor?: string
}) {
  return (
    <motion.button
      type="submit"
      disabled={isPending}
      whileHover={!isPending ? { scale: 1.015 } : undefined}
      whileTap={!isPending ? { scale: 0.985 } : undefined}
      transition={{ type: 'spring', stiffness: 420, damping: 26 }}
      className="relative w-full py-3.5 rounded-xl text-sm font-bold overflow-hidden focus:outline-none disabled:opacity-60 disabled:pointer-events-none"
      style={{
        background: 'linear-gradient(135deg, oklch(0.82 0.14 198) 0%, oklch(0.42 0.09 198) 100%)',
        color: 'oklch(0.10 0.015 265)',
        boxShadow: isPending ? 'none' : `0 4px 24px ${accentColor}38, inset 0 1px 0 rgba(255,255,255,0.20)`,
      }}
    >
      <motion.div
        className="absolute inset-0 pointer-events-none"
        initial={{ x: '-100%' }}
        whileHover={{ x: '200%' }}
        transition={{ duration: 0.5, ease: 'easeInOut' }}
        style={{
          background: 'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.18) 50%, transparent 70%)',
        }}
      />
      <span className="relative z-10 flex items-center justify-center gap-2">
        {isPending ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {pendingLabel}
          </>
        ) : label}
      </span>
    </motion.button>
  )
}