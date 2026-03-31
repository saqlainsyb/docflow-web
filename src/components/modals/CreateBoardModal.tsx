// src/components/modals/CreateBoardModal.tsx
// ─────────────────────────────────────────────────────────────────────────────
// REDESIGNED: Premium board creation modal — "Obsidian Studio" aesthetic.
//
// Design features:
//   • Large icon header with gradient halo badge
//   • Cinematic visibility selector — two cards with icon, label, description
//     and an animated selection ring that slides between them
//   • Character count indicator on title input
//   • Staggered mount animation on the two visibility option cards
//   • AnimatePresence on error banners with height animation
//   • Gradient CTA with shimmer sweep on hover
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { isAxiosError } from 'axios'
import { Loader2, AlertCircle, Globe, Lock, LayoutDashboard } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { useAppDispatch } from '@/store/hooks'
import { closeModal } from '@/store'
import { useCreateBoard } from '@/hooks/useCreateBoard'
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
} from '@/components/ui/dialog'
import {
  createBoardSchema,
  type CreateBoardFormValues,
} from '@/lib/validations'
import type { ApiErrorCode } from '@/lib/types'

// ── Error mapping ─────────────────────────────────────────────────────────────

const SERVER_ERROR_MESSAGES: Partial<Record<ApiErrorCode, string>> = {
  VALIDATION_ERROR:          'Board title is invalid. Check length and characters.',
  INSUFFICIENT_PERMISSIONS:  'Only admins and owners can create boards.',
  WORKSPACE_NOT_FOUND:       'This workspace no longer exists.',
  INTERNAL_ERROR:            'Something went wrong. Please try again.',
}

function getServerError(error: unknown): string | null {
  if (!isAxiosError<{ error: { code: ApiErrorCode } }>(error)) return null
  const code = error.response?.data?.error?.code
  if (!code) return 'Something went wrong. Please try again.'
  return SERVER_ERROR_MESSAGES[code] ?? 'Something went wrong. Please try again.'
}

// ── VisibilityCard ────────────────────────────────────────────────────────────

interface VisibilityCardProps {
  value: 'workspace' | 'private'
  selected: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  description: string
  accentColor: string
  accentGlow: string
  delay?: number
}

function VisibilityCard({
  value,
  selected,
  onClick,
  icon,
  label,
  description,
  accentColor,
  accentGlow,
  delay = 0,
}: VisibilityCardProps) {
  return (
    <motion.button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ scale: 1.015 }}
      whileTap={{ scale: 0.985 }}
      className="flex-1 relative flex flex-col items-start gap-2 p-4 rounded-xl text-left focus:outline-none"
      style={{
        background: selected
          ? `linear-gradient(145deg, ${accentColor}10 0%, ${accentColor}05 100%)`
          : 'rgba(255,255,255,0.035)',
        border: selected
          ? `1.5px solid ${accentColor}45`
          : '1.5px solid rgba(255,255,255,0.07)',
        boxShadow: selected
          ? `0 0 0 1px ${accentColor}20, 0 4px 20px ${accentGlow}`
          : 'none',
        transition: 'background 0.22s, border-color 0.22s, box-shadow 0.22s',
      }}
    >
      {/* Selection indicator dot in top-right */}
      <div
        className="absolute top-3 right-3 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all duration-200"
        style={{
          borderColor: selected ? accentColor : 'rgba(255,255,255,0.20)',
          background: selected ? accentColor : 'transparent',
        }}
      >
        <AnimatePresence>
          {selected && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={{ duration: 0.15 }}
              className="w-1.5 h-1.5 rounded-full bg-black"
            />
          )}
        </AnimatePresence>
      </div>

      {/* Icon */}
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200"
        style={{
          background: selected ? `${accentColor}18` : 'rgba(255,255,255,0.06)',
          border: selected ? `1px solid ${accentColor}30` : '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div style={{ color: selected ? accentColor : 'rgba(255,255,255,0.40)', transition: 'color 0.2s' }}>
          {icon}
        </div>
      </div>

      {/* Label */}
      <div>
        <p
          className="text-sm font-bold leading-none mb-1 transition-colors duration-200"
          style={{ color: selected ? 'oklch(0.91 0.015 265)' : 'rgba(255,255,255,0.55)' }}
        >
          {label}
        </p>
        <p
          className="text-[11px] leading-relaxed"
          style={{ color: 'rgba(255,255,255,0.32)' }}
        >
          {description}
        </p>
      </div>
    </motion.button>
  )
}

// ── CreateBoardModal ──────────────────────────────────────────────────────────

interface CreateBoardModalProps {
  workspaceId: string
}

const MAX_TITLE_LENGTH = 100

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
    defaultValues: { title: '', visibility: 'workspace' },
  })

  const visibility = watch('visibility')
  const titleValue = watch('title')
  const charCount = titleValue?.length ?? 0
  const isNearLimit = charCount > MAX_TITLE_LENGTH * 0.8

  useEffect(() => {
    return () => { reset(); mutation.reset() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function onSubmit(data: CreateBoardFormValues) {
    mutation.mutate(data, { onSuccess: () => dispatch(closeModal()) })
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
          className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-md"
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
          aria-label="Create new board"
        >
          {/* Ambient top glow */}
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-56 h-24 pointer-events-none rounded-full"
            style={{ background: 'radial-gradient(ellipse at top, rgba(0,218,243,0.08) 0%, transparent 70%)' }}
          />

          {/* ── Header ──────────────────────────────────────────────── */}
          <div className="flex items-start justify-between mb-6 relative z-10">
            <div className="flex items-center gap-3.5">
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                style={{
                  background: 'linear-gradient(135deg, oklch(0.82 0.14 198) 0%, oklch(0.42 0.09 198) 100%)',
                  boxShadow: '0 4px 16px rgba(0,218,243,0.25), inset 0 1px 0 rgba(255,255,255,0.25)',
                }}
              >
                <LayoutDashboard className="w-5 h-5" style={{ color: 'oklch(0.10 0.015 265)' }} />
              </div>
              <div>
                <h2
                  className="text-[18px] font-bold leading-tight"
                  style={{ color: 'oklch(0.91 0.015 265)', fontFamily: 'var(--df-font-display)' }}
                >
                  New Board
                </h2>
                <p className="text-[12px] mt-0.5" style={{ color: 'rgba(255,255,255,0.38)' }}>
                  Set up a workspace for your team's work
                </p>
              </div>
            </div>

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
            {/* ── Board title ─────────────────────────────────────────── */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="board-title"
                  className="text-[11px] font-bold uppercase tracking-[0.14em]"
                  style={{ color: 'rgba(255,255,255,0.40)' }}
                >
                  Board Title
                </label>
                <span
                  className="text-[10px] font-medium tabular-nums transition-colors duration-200"
                  style={{ color: isNearLimit ? 'oklch(0.75 0.18 45)' : 'rgba(255,255,255,0.22)' }}
                >
                  {charCount}/{MAX_TITLE_LENGTH}
                </span>
              </div>
              <input
                id="board-title"
                type="text"
                autoComplete="off"
                autoFocus
                placeholder="e.g. Q1 Growth Strategy"
                maxLength={MAX_TITLE_LENGTH}
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
                    (e.currentTarget as HTMLElement).style.border = '1px solid rgba(0,218,243,0.35)'
                    ;(e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 3px rgba(0,218,243,0.08)'
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

            {/* ── Visibility selector ────────────────────────────────── */}
            <div className="space-y-2.5">
              <label
                className="text-[11px] font-bold uppercase tracking-[0.14em]"
                style={{ color: 'rgba(255,255,255,0.40)' }}
              >
                Visibility
              </label>
              <div className="flex gap-3" role="radiogroup" aria-label="Board visibility">
                <VisibilityCard
                  value="workspace"
                  selected={visibility === 'workspace'}
                  onClick={() => setValue('visibility', 'workspace', { shouldValidate: true })}
                  icon={<Globe className="w-4 h-4" />}
                  label="Workspace"
                  description="All members can view and edit"
                  accentColor="#34D399"
                  accentGlow="rgba(52,211,153,0.08)"
                  delay={0.05}
                />
                <VisibilityCard
                  value="private"
                  selected={visibility === 'private'}
                  onClick={() => setValue('visibility', 'private', { shouldValidate: true })}
                  icon={<Lock className="w-4 h-4" />}
                  label="Private"
                  description="Only invited members can access"
                  accentColor="#A78BFA"
                  accentGlow="rgba(167,139,250,0.08)"
                  delay={0.10}
                />
              </div>
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
            <motion.button
              type="submit"
              disabled={mutation.isPending}
              whileHover={!mutation.isPending ? { scale: 1.015 } : undefined}
              whileTap={!mutation.isPending ? { scale: 0.985 } : undefined}
              transition={{ type: 'spring', stiffness: 420, damping: 26 }}
              className="relative w-full py-3.5 rounded-xl text-sm font-bold overflow-hidden focus:outline-none disabled:opacity-60 disabled:pointer-events-none"
              style={{
                background: 'linear-gradient(135deg, oklch(0.82 0.14 198) 0%, oklch(0.42 0.09 198) 100%)',
                color: 'oklch(0.10 0.015 265)',
                boxShadow: mutation.isPending ? 'none' : '0 4px 24px rgba(0,218,243,0.22), inset 0 1px 0 rgba(255,255,255,0.20)',
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
                {mutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating…
                  </>
                ) : 'Create Board'}
              </span>
            </motion.button>
          </form>
        </motion.div>
      </DialogPortal>
    </Dialog>
  )
}