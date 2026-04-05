// src/pages/profile/ProfilePage.tsx
// ─────────────────────────────────────────────────────────────────────────────
// User profile management page.
//
// Route: /profile  (ProtectedRoute, outside the /:workspaceId shell — no sidebar)
//
// Sections:
//   1. Identity     — Update name + avatar_url (PATCH /users/me)
//   2. Account info — Read-only email + member since (GET /users/me via Redux)
//
// Design: matches the board/document dark theme (oklch color space, same glass
// surfaces, same dialog/input styles used in BoardPage and SettingsPage).
//
// State:
//   - User comes from Redux (state.auth.user) — already loaded by useAuthBootstrap
//   - PATCH /users/me dispatches updateUser to keep Redux in sync
//   - updateMeSchema (already defined in validations.ts) gates the form
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { isAxiosError } from 'axios'
import { useMutation } from '@tanstack/react-query'
import {
  ArrowLeft,
  Loader2,
  Check,
  AlertCircle,
  User,
  Mail,
  Calendar,
  ImageIcon,
  Pencil,
} from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { useAppSelector, useAppDispatch } from '@/store/hooks'
import { updateUser } from '@/store'
import api from '@/lib/api'
import { ROUTES } from '@/lib/routes'
import { updateMeSchema, type UpdateMeFormValues } from '@/lib/validations'
import type { ApiErrorCode, User as UserType } from '@/lib/types'
import { cn } from '@/lib/utils'
import { getInitials } from '@/lib/utils'
import { toast } from '@/components/toast'

// ── Error mapping ─────────────────────────────────────────────────────────────

const UPDATE_ERROR_MESSAGES: Partial<Record<ApiErrorCode, string>> = {
  VALIDATION_ERROR: 'Invalid input. Check name length or URL format.',
  RATE_LIMITED: 'Too many requests. Please wait a moment.',
  INTERNAL_ERROR: 'Something went wrong. Please try again.',
}

function getServerError(error: unknown): string | null {
  if (!isAxiosError<{ error: { code: ApiErrorCode } }>(error)) return null
  const code = error.response?.data?.error?.code
  if (!code) return 'Something went wrong. Please try again.'
  return UPDATE_ERROR_MESSAGES[code] ?? 'Something went wrong. Please try again.'
}

// ── useUpdateMe mutation ──────────────────────────────────────────────────────

function useUpdateMe() {
  const dispatch = useAppDispatch()

  return useMutation({
    mutationFn: (values: UpdateMeFormValues) =>
      api
        .patch<UserType>(ROUTES.users.me, values)
        .then((res) => res.data),

    onSuccess: (updatedUser) => {
      // keep Redux in sync so the sidebar avatar and UserMenu reflect the change
      dispatch(updateUser(updatedUser))
      toast.success('Profile updated')
    },
  })
}

// ── formatDate helper ─────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

// ── AvatarPreview ─────────────────────────────────────────────────────────────

interface AvatarPreviewProps {
  name: string
  avatarUrl: string | undefined | null
}

function AvatarPreview({ name, avatarUrl }: AvatarPreviewProps) {
  const hasUrl = avatarUrl && avatarUrl.trim().length > 0
  const isValidUrl = hasUrl && (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://'))

  return (
    <div className="relative shrink-0">
      <div
        className="w-20 h-20 rounded-2xl flex items-center justify-center overflow-hidden relative"
        style={{
          background: isValidUrl
            ? 'transparent'
            : 'linear-gradient(135deg, oklch(0.38 0.16 285) 0%, oklch(0.30 0.12 285) 100%)',
          border: '1px solid rgba(255,255,255,0.10)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08)',
        }}
      >
        {isValidUrl ? (
          <img
            src={avatarUrl}
            alt={name}
            className="w-full h-full object-cover"
            onError={(e) => {
              // hide broken image — falls through to initials
              ;(e.currentTarget as HTMLImageElement).style.display = 'none'
            }}
          />
        ) : (
          <span
            className="text-xl font-bold select-none"
            style={{ color: 'oklch(0.88 0.08 285)' }}
          >
            {getInitials(name || 'U')}
          </span>
        )}
      </div>

      {/* Edit badge */}
      <div
        className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-lg flex items-center justify-center"
        style={{
          background: 'oklch(0.82 0.14 198)',
          boxShadow: '0 2px 8px rgba(0,218,243,0.35)',
        }}
      >
        <Pencil className="w-3 h-3" style={{ color: 'oklch(0.12 0.015 265)' }} />
      </div>
    </div>
  )
}

// ── ProfileForm ───────────────────────────────────────────────────────────────

interface ProfileFormProps {
  user: UserType
}

function ProfileForm({ user }: ProfileFormProps) {
  const {
    mutate: updateMe,
    isPending,
    error,
    isSuccess,
    reset: resetMutation,
  } = useUpdateMe()

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isDirty },
    reset: resetForm,
  } = useForm<UpdateMeFormValues>({
    resolver: zodResolver(updateMeSchema),
    defaultValues: {
      name: user.name,
      avatar_url: user.avatar_url ?? '',
    },
  })

  // Keep form in sync if the user data changes (e.g. another tab)
  useEffect(() => {
    resetForm({ name: user.name, avatar_url: user.avatar_url ?? '' })
  }, [user.name, user.avatar_url, resetForm])

  const watchedAvatarUrl = watch('avatar_url')
  const watchedName = watch('name')
  const serverError = getServerError(error)

  function onSubmit(data: UpdateMeFormValues) {
    // Only send fields that differ from current values
    const payload: UpdateMeFormValues = {}
    if (data.name && data.name !== user.name) payload.name = data.name
    if (data.avatar_url !== (user.avatar_url ?? '')) payload.avatar_url = data.avatar_url

    updateMe(payload, {
      onSuccess: () => {
        // Reset isDirty flag with the freshly saved values
        resetForm({ name: data.name, avatar_url: data.avatar_url })
        resetMutation()
      },
    })
  }

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'linear-gradient(175deg, oklch(0.195 0.016 265 / 0.82) 0%, oklch(0.165 0.014 265 / 0.80) 100%)',
        backdropFilter: 'blur(22px) saturate(160%)',
        border: '1px solid rgba(255,255,255,0.065)',
        boxShadow: '0 4px 32px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.055)',
      }}
    >
      {/* Section header */}
      <div className="px-6 pt-6 pb-5 flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
          style={{
            background: 'rgba(0,218,243,0.10)',
            border: '1px solid rgba(0,218,243,0.18)',
          }}
        >
          <User className="w-4 h-4" style={{ color: 'oklch(0.82 0.14 198)' }} />
        </div>
        <div>
          <h2
            className="font-bold text-[13px]"
            style={{ color: 'oklch(0.91 0.015 265)', fontFamily: 'var(--df-font-display)' }}
          >
            Identity
          </h2>
          <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.38)' }}>
            How you appear to teammates across all workspaces
          </p>
        </div>
      </div>

      {/* Hairline */}
      <div
        className="mx-6 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)' }}
      />

      {/* Form body */}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="px-6 pt-5 pb-6 space-y-5">
        {/* Avatar + name row */}
        <div className="flex items-start gap-5">
          <AvatarPreview name={watchedName ?? user.name} avatarUrl={watchedAvatarUrl} />

          {/* Name field */}
          <div className="flex-1 space-y-1.5">
            <label
              htmlFor="profile-name"
              className="block text-[10px] font-semibold uppercase tracking-[0.12em]"
              style={{ color: 'rgba(255,255,255,0.40)' }}
            >
              Display name
            </label>
            <input
              {...register('name')}
              id="profile-name"
              type="text"
              placeholder="Your name"
              maxLength={50}
              aria-invalid={!!errors.name}
              className={cn(
                'w-full rounded-xl px-3.5 py-2.5 text-sm font-medium outline-none transition-all',
              )}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: errors.name
                  ? '1px solid rgba(239,68,68,0.50)'
                  : '1px solid rgba(255,255,255,0.10)',
                color: 'oklch(0.91 0.015 265)',
              }}
              onFocus={(e) => {
                if (!errors.name) {
                  e.currentTarget.style.borderColor = 'oklch(0.82 0.14 198 / 0.45)'
                  e.currentTarget.style.boxShadow = '0 0 0 3px oklch(0.82 0.14 198 / 0.10)'
                }
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = errors.name
                  ? 'rgba(239,68,68,0.50)'
                  : 'rgba(255,255,255,0.10)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            />
            {errors.name && (
              <p
                role="alert"
                className="flex items-center gap-1.5 text-[11px] font-medium"
                style={{ color: '#EF4444' }}
              >
                <AlertCircle className="size-3 shrink-0" aria-hidden />
                {errors.name.message}
              </p>
            )}
          </div>
        </div>

        {/* Avatar URL field */}
        <div className="space-y-1.5">
          <label
            htmlFor="profile-avatar"
            className="block text-[10px] font-semibold uppercase tracking-[0.12em]"
            style={{ color: 'rgba(255,255,255,0.40)' }}
          >
            Avatar URL
            <span className="ml-2 normal-case tracking-normal text-[10px] font-normal" style={{ color: 'rgba(255,255,255,0.25)' }}>
              optional
            </span>
          </label>
          <div className="relative">
            <ImageIcon
              className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
              style={{ color: 'rgba(255,255,255,0.30)' }}
            />
            <input
              {...register('avatar_url')}
              id="profile-avatar"
              type="url"
              placeholder="https://example.com/avatar.png"
              aria-invalid={!!errors.avatar_url}
              className="w-full rounded-xl pl-9 pr-3.5 py-2.5 text-sm outline-none transition-all"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: errors.avatar_url
                  ? '1px solid rgba(239,68,68,0.50)'
                  : '1px solid rgba(255,255,255,0.10)',
                color: 'oklch(0.91 0.015 265)',
                fontFamily: 'var(--df-font-body)',
              }}
              onFocus={(e) => {
                if (!errors.avatar_url) {
                  e.currentTarget.style.borderColor = 'oklch(0.82 0.14 198 / 0.45)'
                  e.currentTarget.style.boxShadow = '0 0 0 3px oklch(0.82 0.14 198 / 0.10)'
                }
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = errors.avatar_url
                  ? 'rgba(239,68,68,0.50)'
                  : 'rgba(255,255,255,0.10)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            />
          </div>
          {errors.avatar_url && (
            <p
              role="alert"
              className="flex items-center gap-1.5 text-[11px] font-medium"
              style={{ color: '#EF4444' }}
            >
              <AlertCircle className="size-3 shrink-0" aria-hidden />
              {errors.avatar_url.message}
            </p>
          )}
          <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.22)' }}>
            Leave empty to show your initials instead.
          </p>
        </div>

        {/* Server error */}
        <AnimatePresence>
          {serverError && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
              style={{
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.18)',
              }}
            >
              <AlertCircle className="size-4 shrink-0" style={{ color: '#EF4444' }} />
              <p className="text-[13px]" style={{ color: '#EF4444' }}>{serverError}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action row */}
        <div className="flex items-center justify-end gap-3 pt-1">
          <AnimatePresence>
            {isSuccess && !isDirty && (
              <motion.span
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold"
                style={{
                  background: 'rgba(0,218,243,0.10)',
                  border: '1px solid rgba(0,218,243,0.22)',
                  color: 'oklch(0.82 0.14 198)',
                }}
              >
                <Check className="size-3" />
                Saved
              </motion.span>
            )}
          </AnimatePresence>

          <button
            type="submit"
            disabled={isPending || !isDirty}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-bold transition-all focus:outline-none disabled:opacity-40 disabled:pointer-events-none"
            style={{
              background: 'linear-gradient(135deg, oklch(0.82 0.14 198 / 0.22) 0%, oklch(0.55 0.12 198 / 0.30) 100%)',
              border: '1px solid oklch(0.82 0.14 198 / 0.30)',
              color: 'oklch(0.82 0.14 198)',
            }}
          >
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Saving…
              </>
            ) : (
              'Save changes'
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

// ── AccountInfo ───────────────────────────────────────────────────────────────
// Read-only — email and member since date

interface AccountInfoProps {
  user: UserType
}

function AccountInfo({ user }: AccountInfoProps) {
  const rows = [
    {
      icon: <Mail className="w-3.5 h-3.5" />,
      label: 'Email address',
      value: user.email,
      note: 'Email cannot be changed.',
    },
    {
      icon: <Calendar className="w-3.5 h-3.5" />,
      label: 'Member since',
      value: formatDate(user.created_at),
      note: null,
    },
  ]

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'linear-gradient(175deg, oklch(0.195 0.016 265 / 0.82) 0%, oklch(0.165 0.014 265 / 0.80) 100%)',
        backdropFilter: 'blur(22px) saturate(160%)',
        border: '1px solid rgba(255,255,255,0.065)',
        boxShadow: '0 4px 32px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.055)',
      }}
    >
      {/* Section header */}
      <div className="px-6 pt-6 pb-5 flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.10)',
          }}
        >
          <User className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.45)' }} />
        </div>
        <div>
          <h2
            className="font-bold text-[13px]"
            style={{ color: 'oklch(0.91 0.015 265)', fontFamily: 'var(--df-font-display)' }}
          >
            Account
          </h2>
          <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.38)' }}>
            Read-only account information
          </p>
        </div>
      </div>

      {/* Hairline */}
      <div
        className="mx-6 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)' }}
      />

      {/* Info rows */}
      <div className="px-6 py-5 space-y-4">
        {rows.map(({ icon, label, value, note }) => (
          <div key={label} className="flex items-start gap-3">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.07)',
                color: 'rgba(255,255,255,0.35)',
              }}
            >
              {icon}
            </div>
            <div className="min-w-0">
              <p
                className="text-[10px] font-semibold uppercase tracking-[0.10em] mb-0.5"
                style={{ color: 'rgba(255,255,255,0.30)' }}
              >
                {label}
              </p>
              <p
                className="text-sm font-medium truncate"
                style={{ color: 'oklch(0.85 0.015 265)' }}
              >
                {value}
              </p>
              {note && (
                <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.22)' }}>
                  {note}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── ProfilePage ───────────────────────────────────────────────────────────────

export function ProfilePage() {
  const navigate = useNavigate()
  const user = useAppSelector((state) => state.auth.user)

  // Should never be null here — ProtectedRoute guards this — but TypeScript
  // doesn't know that. Guard defensively.
  if (!user) return null

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'oklch(0.12 0.015 265)' }}
    >
      {/* Dot-grid background — matches BoardPage */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.025) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />

      {/* Ambient top glow */}
      <div
        className="fixed top-0 left-1/2 -translate-x-1/2 w-[500px] h-[160px] pointer-events-none z-0"
        style={{
          background: 'radial-gradient(ellipse at top, oklch(0.82 0.14 198 / 0.05) 0%, transparent 70%)',
        }}
      />

      {/* ── Topbar ──────────────────────────────────────────────────────────── */}
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.30, ease: [0.22, 1, 0.36, 1] }}
        className="h-14 flex items-center gap-3 px-6 shrink-0 sticky top-0 z-40"
        style={{
          background: 'oklch(0.13 0.015 265 / 0.88)',
          backdropFilter: 'blur(24px) saturate(180%)',
          borderBottom: '1px solid rgba(255,255,255,0.055)',
        }}
      >
        <motion.button
          onClick={() => navigate(-1)}
          aria-label="Go back"
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          transition={{ type: 'spring', stiffness: 450, damping: 25 }}
          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 focus:outline-none"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.07)',
            color: 'rgba(255,255,255,0.55)',
          }}
        >
          <ArrowLeft className="w-4 h-4" />
        </motion.button>

        <div className="w-px h-5 shrink-0" style={{ background: 'rgba(255,255,255,0.08)' }} />

        <span
          className="text-sm font-semibold"
          style={{ color: 'rgba(255,255,255,0.55)', fontFamily: 'var(--df-font-display)' }}
        >
          Profile
        </span>
      </motion.header>

      {/* ── Page body ───────────────────────────────────────────────────────── */}
      <div className="flex-1 relative z-10 py-10 px-6">
        <div className="max-w-xl mx-auto space-y-8">

          {/* Page heading */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
          >
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.14em] mb-2"
              style={{ color: 'oklch(0.82 0.14 198)' }}
            >
              Your account
            </p>
            <h1
              className="font-display text-3xl font-extrabold tracking-tight leading-none"
              style={{
                color: 'oklch(0.93 0.012 265)',
                fontFamily: 'var(--df-font-display)',
              }}
            >
              Profile settings
            </h1>
          </motion.div>

          {/* Identity form */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.38, delay: 0.10, ease: [0.22, 1, 0.36, 1] }}
          >
            <ProfileForm user={user} />
          </motion.div>

          {/* Account info */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.38, delay: 0.16, ease: [0.22, 1, 0.36, 1] }}
          >
            <AccountInfo user={user} />
          </motion.div>

        </div>
      </div>
    </div>
  )
}