// src/pages/workspace/MembersPage.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Workspace members management — extended with email invitation system.
//
// Matches Docflow design system exactly:
//   • OKLCH color tokens, df-gradient-cta, surface hierarchy
//   • Manrope display font + Inter body (var(--df-font-display))
//   • Framer Motion spring physics, stagger entrance, AnimatePresence
//   • Ambient orb backdrop, glassmorphic topbar, group-hover micro-interactions
//   • Tab switcher with layoutId pill (matches BoardsPage view toggle)
//   • Identical MemberCard shape from V1
//   • New InvitationCard, SendInviteDialog, CancelInviteDialog
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { isAxiosError } from 'axios'
import {
  UserPlus, Trash2, Loader2, AlertCircle,
  Crown, ShieldCheck, User, Users,
  Mail, Clock, X, Send,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppSelector } from '@/store/hooks'
import { useWorkspace } from '@/hooks/useWorkspace'
import { useRemoveMember } from '@/hooks/useRemoveMember'
import { useChangeMemberRole } from '@/hooks/useChangeMemberRole'
import { useSendInvitation, type SendInvitationValues } from '@/hooks/useSendInvitation'
import { usePendingInvitations } from '@/hooks/usePendingInvitations'
import { useCancelInvitation } from '@/hooks/useCancelInvitation'
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import type { ApiErrorCode, MemberResponse, WorkspaceRole, PendingInvitation } from '@/lib/types'
import type { AssignableRole } from '@/lib/validations'
import { cn } from '@/lib/utils'
import { getInitials } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = 'members' | 'invitations'

// ── Validation ─────────────────────────────────────────────────────────────────

const sendInvitationSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  role:  z.enum(['admin', 'member']),
})
type SendInvitationFormValues = z.infer<typeof sendInvitationSchema>

// ── Error mapping ─────────────────────────────────────────────────────────────

const INVITE_ERROR_MESSAGES: Partial<Record<ApiErrorCode, string>> = {
  INVITATION_ALREADY_PENDING: 'A pending invitation for this email already exists.',
  ALREADY_WORKSPACE_MEMBER:   'This person is already a member of this workspace.',
  INSUFFICIENT_PERMISSIONS:   "You don't have permission to invite members.",
  RATE_LIMITED:               'Too many attempts. Please wait a moment.',
  INTERNAL_ERROR:             'Something went wrong. Please try again.',
}

function getInviteError(error: unknown): string | null {
  if (!isAxiosError<{ error: { code: ApiErrorCode } }>(error)) return null
  const code = error.response?.data?.error?.code
  if (!code) return 'Something went wrong. Please try again.'
  return INVITE_ERROR_MESSAGES[code] ?? 'Something went wrong. Please try again.'
}

// ── Role config ───────────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<WorkspaceRole, {
  label: string; icon: React.ElementType
  pillClass: string; avatarClass: string
}> = {
  owner:  { label: 'Owner',  icon: Crown,       pillClass: 'bg-primary/10 text-primary border border-primary/20',                                                  avatarClass: 'bg-primary/15 text-primary ring-1 ring-primary/25'                         },
  admin:  { label: 'Admin',  icon: ShieldCheck, pillClass: 'bg-df-secondary/10 text-df-secondary border border-df-secondary/20',                                   avatarClass: 'bg-df-secondary/10 text-df-secondary ring-1 ring-df-secondary/20'         },
  member: { label: 'Member', icon: User,        pillClass: 'bg-surface-container-highest text-on-surface-variant border border-outline-variant/20',                avatarClass: 'bg-df-tertiary-container text-df-on-tertiary-container ring-1 ring-df-tertiary/15' },
}

function getAvatarHue(id: string): string {
  const hues = [198, 280, 285, 155, 35, 320]
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0
  return `${hues[Math.abs(hash) % hues.length]}`
}

// ── Motion variants ────────────────────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: { staggerChildren: 0.055, delayChildren: 0.04 } },
}

const cardVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.985 },
  show:   { opacity: 1, y: 0,  scale: 1,    transition: { type: 'spring', stiffness: 320, damping: 28 } },
  exit:   { opacity: 0, y: -8, scale: 0.985, transition: { duration: 0.15 } },
} as const;

// ── Ambient orbs — identical to BoardsPage ────────────────────────────────────

function AmbientOrbs() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
      <motion.div
        animate={{ y: [0, -20, 0], x: [0, 14, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -top-40 -right-40 w-[560px] h-[560px] rounded-full"
        style={{ background: 'radial-gradient(circle, oklch(0.82 0.14 198 / 5%) 0%, transparent 65%)', filter: 'blur(1px)' }}
      />
      <motion.div
        animate={{ y: [0, 18, 0], x: [0, -10, 0] }}
        transition={{ duration: 24, repeat: Infinity, ease: 'easeInOut', delay: 5 }}
        className="absolute -bottom-48 -left-48 w-[480px] h-[480px] rounded-full"
        style={{ background: 'radial-gradient(circle, oklch(0.80 0.12 280 / 4%) 0%, transparent 65%)', filter: 'blur(1px)' }}
      />
    </div>
  )
}

// ── Topbar ─────────────────────────────────────────────────────────────────────

function MembersTopbar({ workspaceName }: { workspaceName: string }) {
  return (
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="h-14 flex items-center gap-2 px-4 lg:px-8 sticky top-14 lg:top-0 z-30"
      style={{
        background: 'oklch(0.12 0.015 265 / 80%)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderBottom: '1px solid oklch(0.35 0.015 265 / 10%)',
      }}
    >
      <span className="hidden sm:block text-sm font-semibold text-on-surface-variant truncate max-w-40">
        {workspaceName}
      </span>
      <span className="hidden sm:block text-outline/40 text-sm">/</span>
      <span className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md',
        'text-xs font-semibold text-primary bg-primary/[0.08] border border-primary/[0.12]',
      )}>
        <Users className="w-3 h-3" strokeWidth={2} />
        Members
      </span>
    </motion.header>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sublabel, accent, index }: {
  label: string; value: number | string; sublabel?: string; accent?: string; index: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 26, delay: 0.08 + index * 0.06 }}
      className="rounded-xl p-5 border border-outline-variant/15 bg-surface-container-low"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-outline mb-3">{label}</p>
      <p className={cn('font-display text-3xl font-extrabold tracking-tight', accent ?? 'text-on-surface')}>{value}</p>
      {sublabel && <p className="text-xs text-on-surface-variant mt-1">{sublabel}</p>}
    </motion.div>
  )
}

// ── Tab switcher with layoutId pill ───────────────────────────────────────────

function TabSwitcher({ active, onChange, pendingCount }: {
  active: Tab; onChange: (t: Tab) => void; pendingCount: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.22, duration: 0.3 }}
      className="flex p-1 rounded-xl gap-0.5 w-fit"
      style={{ background: 'oklch(0.16 0.015 265)', border: '1px solid oklch(0.35 0.015 265 / 12%)' }}
      role="tablist"
    >
      {(['members', 'invitations'] as Tab[]).map((tab) => (
        <div key={tab} className="relative">
          <motion.button
            role="tab"
            aria-selected={active === tab}
            onClick={() => onChange(tab)}
            className="relative flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium focus:outline-none z-10"
            whileTap={{ scale: 0.95 }}
          >
            {active === tab && (
              <motion.span
                layoutId="tab-pill"
                className="absolute inset-0 rounded-lg z-0"
                style={{ background: 'oklch(0.27 0.015 265)', boxShadow: '0 1px 4px oklch(0 0 0 / 30%)' }}
                transition={{ type: 'spring', stiffness: 480, damping: 36 }}
              />
            )}
            <span
              className="relative z-10 transition-colors duration-150 capitalize"
              style={{ color: active === tab ? 'oklch(0.91 0.015 265)' : 'oklch(0.56 0.012 265)' }}
            >
              {tab === 'members' ? 'Members' : 'Invitations'}
            </span>
            {tab === 'invitations' && pendingCount > 0 && (
              <motion.span
                key={pendingCount}
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="relative z-10 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold tabular-nums"
                style={{ background: 'oklch(0.82 0.14 198 / 15%)', color: 'oklch(0.82 0.14 198)', border: '1px solid oklch(0.82 0.14 198 / 25%)' }}
              >
                {pendingCount}
              </motion.span>
            )}
          </motion.button>
        </div>
      ))}
    </motion.div>
  )
}

// ── RoleBadge ─────────────────────────────────────────────────────────────────

function RoleBadge({ member, viewerRole, workspaceId }: {
  member: MemberResponse; viewerRole: WorkspaceRole | undefined; workspaceId: string
}) {
  const { mutate: changeRole, isPending } = useChangeMemberRole(workspaceId)
  const config    = ROLE_CONFIG[member.role]
  const RoleIcon  = config.icon
  const canChange = viewerRole === 'owner' && member.role !== 'owner'

  if (!canChange) {
    return (
      <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold', config.pillClass)}>
        <RoleIcon className="w-3 h-3" aria-hidden="true" />
        {config.label}
      </span>
    )
  }

  return (
    <Select
      value={member.role as AssignableRole}
      onValueChange={(v) => changeRole({ userId: member.user_id, role: v as AssignableRole })}
      disabled={isPending}
    >
      <SelectTrigger size="sm" className={cn('w-auto min-w-[100px] border-transparent text-[11px] font-semibold hover:border-outline-variant/20', config.pillClass)} aria-label={`Change role for ${member.name}`}>
        <div className="flex items-center gap-1.5">
          {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RoleIcon className="w-3 h-3" />}
          <SelectValue />
        </div>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="admin"><div className="flex items-center gap-2"><ShieldCheck className="size-3.5 text-df-secondary" />Admin</div></SelectItem>
        <SelectItem value="member"><div className="flex items-center gap-2"><User className="size-3.5 text-outline" />Member</div></SelectItem>
      </SelectContent>
    </Select>
  )
}

// ── MemberCard ─────────────────────────────────────────────────────────────────

function MemberCard({ member, currentUserId, viewerRole, workspaceId, onRemove }: {
  member: MemberResponse; currentUserId: string | undefined
  viewerRole: WorkspaceRole | undefined; workspaceId: string
  onRemove: (m: MemberResponse) => void
}) {
  const isOwner  = member.role === 'owner'
  const isSelf   = member.user_id === currentUserId
  const canRemove = !isOwner && !isSelf && (viewerRole === 'owner' || (viewerRole === 'admin' && member.role === 'member'))
  const hue = getAvatarHue(member.user_id)

  return (
    <motion.div
      variants={cardVariants}
      layout
      className="group relative flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3 sm:py-4 rounded-xl border border-outline-variant/10 bg-surface-container-low"
      whileHover={{ borderColor: 'oklch(0.35 0.015 265 / 22%)', backgroundColor: 'oklch(0.18 0.015 265)', transition: { duration: 0.15 } }}
    >
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-[12px] font-bold select-none"
        style={{ background: `oklch(0.38 0.12 ${hue})`, color: 'oklch(0.92 0.015 265)', boxShadow: `0 0 0 1px oklch(0.45 0.10 ${hue} / 40%)` }}
        aria-hidden="true"
      >
        {getInitials(member.name)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-[13px] font-semibold text-on-surface truncate">{member.name}</p>
          {isSelf && <span className="shrink-0 inline-flex items-center px-1.5 py-px rounded text-[9px] font-bold uppercase tracking-[0.08em] bg-surface-container-highest text-outline border border-outline-variant/20">You</span>}
        </div>
        <p className="text-xs text-outline truncate">{member.email}</p>
      </div>
      <div className="shrink-0">
        <RoleBadge member={member} viewerRole={viewerRole} workspaceId={workspaceId} />
      </div>
      <div className="shrink-0 w-8 flex items-center justify-center">
        {canRemove ? (
          <motion.button
            onClick={() => onRemove(member)}
            aria-label={`Remove ${member.name}`}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.92 }}
            className="p-1.5 rounded-lg text-outline/40 hover:text-destructive hover:bg-destructive/8 opacity-0 group-hover:opacity-100 transition-all duration-150 focus:outline-none focus:opacity-100"
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
          </motion.button>
        ) : (
          <span className="w-7 h-7" aria-hidden="true" />
        )}
      </div>
    </motion.div>
  )
}

// ── InvitationCard ─────────────────────────────────────────────────────────────

function InvitationCard({ invitation, onCancel }: {
  invitation: PendingInvitation; onCancel: (i: PendingInvitation) => void
}) {
  const expiresAt  = new Date(invitation.expires_at)
  const daysLeft   = Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 86_400_000))
  const isUrgent   = daysLeft <= 1
  const roleConfig = ROLE_CONFIG[invitation.role as WorkspaceRole] ?? ROLE_CONFIG.member
  const RoleIcon   = roleConfig.icon

  return (
    <motion.div
      variants={cardVariants}
      layout
      className="group relative flex items-center gap-4 px-5 py-4 rounded-xl border border-outline-variant/10 bg-surface-container-low"
      whileHover={{ borderColor: 'oklch(0.35 0.015 265 / 22%)', backgroundColor: 'oklch(0.18 0.015 265)', transition: { duration: 0.15 } }}
    >
      {/* Mail avatar */}
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
        style={{ background: 'oklch(0.21 0.015 265)', border: '1px solid oklch(0.35 0.015 265 / 18%)' }}
        aria-hidden="true"
      >
        <Mail className="w-4 h-4 text-outline" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <p className="text-[13px] font-semibold text-on-surface truncate">{invitation.invited_email}</p>
          {/* Role pill */}
          <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold shrink-0', roleConfig.pillClass)}>
            <RoleIcon className="w-2.5 h-2.5" />
            {roleConfig.label}
          </span>
          {/* Pending badge */}
          <span
            className="inline-flex items-center px-1.5 py-px rounded text-[9px] font-bold uppercase tracking-[0.08em] shrink-0"
            style={{ background: 'oklch(0.80 0.18 55 / 12%)', color: 'oklch(0.80 0.18 55)', border: '1px solid oklch(0.80 0.18 55 / 22%)' }}
          >
            Pending
          </span>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-xs text-outline">Invited by {invitation.inviter_name}</p>
          <span className={cn('inline-flex items-center gap-1 text-[11px]', isUrgent ? 'text-destructive' : 'text-outline/70')}>
            <Clock className="size-3" />
            {daysLeft > 0 ? `${daysLeft}d left` : 'Expires today'}
          </span>
        </div>
      </div>

      <div className="shrink-0 w-8 flex items-center justify-center">
        <motion.button
          onClick={() => onCancel(invitation)}
          aria-label={`Cancel invitation to ${invitation.invited_email}`}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.92 }}
          className="p-1.5 rounded-lg text-outline/40 hover:text-destructive hover:bg-destructive/8 opacity-0 group-hover:opacity-100 transition-all duration-150 focus:outline-none focus:opacity-100"
        >
          <X className="size-3.5" aria-hidden="true" />
        </motion.button>
      </div>
    </motion.div>
  )
}

// ── Send Invitation Dialog ─────────────────────────────────────────────────────

function SendInviteDialog({ open, onOpenChange, workspaceId }: {
  open: boolean; onOpenChange: (o: boolean) => void; workspaceId: string
}) {
  const { mutate: send, isPending, error, reset: resetMutation } = useSendInvitation(workspaceId)
  const { register, handleSubmit, formState: { errors }, reset: resetForm, watch } = useForm<SendInvitationFormValues>({
    resolver: zodResolver(sendInvitationSchema),
    defaultValues: { role: 'member' },
  })
  const selectedRole = watch('role')
  const serverError  = getInviteError(error)

  function handleClose(open: boolean) {
    if (!open) { resetForm(); resetMutation() }
    onOpenChange(open)
  }

  function onSubmit(data: SendInvitationFormValues) {
    send(data as SendInvitationValues, {
      onSuccess: () => { resetForm(); resetMutation(); onOpenChange(false) },
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a teammate</DialogTitle>
          <DialogDescription>
            An invitation email will be sent to this address. They can accept with an existing
            account or create a new one.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          {/* Email */}
          <div className="space-y-1.5">
            <label htmlFor="invite-email" className="text-[10px] font-semibold uppercase tracking-[0.12em] text-outline">
              Email address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline/50" />
              <input
                {...register('email')}
                id="invite-email"
                type="email"
                placeholder="colleague@company.com"
                autoComplete="off"
                className={cn(
                  'w-full bg-surface-container-lowest rounded-lg pl-9 pr-4 py-2.5',
                  'text-sm text-on-surface placeholder:text-outline/40',
                  'border border-outline-variant/20',
                  'focus:outline-none focus:border-primary/40',
                  'focus:shadow-[0_0_0_3px_oklch(0.82_0.14_198/10%)]',
                  'transition-all duration-200',
                  errors.email && 'border-destructive focus:border-destructive',
                )}
              />
            </div>
            {errors.email && (
              <p role="alert" className="flex items-center gap-1.5 text-[11px] font-medium text-destructive">
                <AlertCircle className="size-3 shrink-0" />{errors.email.message}
              </p>
            )}
          </div>

          {/* Role — pill toggle cards */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-outline">Role</label>
            <div className="grid grid-cols-2 gap-2">
              {(['member', 'admin'] as const).map((role) => {
                const cfg = ROLE_CONFIG[role]
                const Icon = cfg.icon
                const isSelected = selectedRole === role
                return (
                  <label
                    key={role}
                    className={cn(
                      'relative flex flex-col gap-1 p-3 rounded-lg cursor-pointer border transition-all duration-150',
                      isSelected ? cfg.pillClass : 'border-outline-variant/15 bg-surface-container-low hover:border-outline-variant/25',
                    )}
                  >
                    <input {...register('role')} type="radio" value={role} className="sr-only" />
                    <div className="flex items-center gap-1.5">
                      <Icon className="w-3.5 h-3.5" />
                      <span className="text-[12px] font-semibold capitalize">{role}</span>
                    </div>
                    <span className="text-[10px] text-outline/70 leading-tight">
                      {role === 'member' ? 'Can view and edit boards' : 'Can manage members and settings'}
                    </span>
                  </label>
                )
              })}
            </div>
          </div>

          {/* Server error */}
          <AnimatePresence>
            {serverError && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-destructive/8 border border-destructive/15"
              >
                <AlertCircle className="size-4 shrink-0 text-destructive" />
                <p role="alert" className="text-sm text-destructive">{serverError}</p>
              </motion.div>
            )}
          </AnimatePresence>

          <DialogFooter>
            <button
              type="button"
              onClick={() => handleClose(false)}
              disabled={isPending}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium',
                'border border-outline-variant/20 text-on-surface-variant',
                'hover:bg-surface-container hover:text-on-surface transition-colors duration-150',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                'disabled:opacity-50 disabled:pointer-events-none',
              )}
            >
              Cancel
            </button>
            <motion.button
              type="submit"
              disabled={isPending}
              whileHover={!isPending ? { opacity: 0.92 } : {}}
              whileTap={!isPending ? { scale: 0.97 } : {}}
              className={cn(
                'df-gradient-cta px-5 py-2 rounded-lg text-sm font-bold text-primary-foreground',
                'flex items-center gap-2',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                'disabled:opacity-70 disabled:pointer-events-none',
              )}
            >
              {isPending ? <><Loader2 className="size-4 animate-spin" />Sending…</> : <><Send className="size-4" />Send invitation</>}
            </motion.button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Remove Member Dialog ───────────────────────────────────────────────────────

function RemoveDialog({ member, onOpenChange, workspaceId }: {
  member: MemberResponse | null; onOpenChange: (o: boolean) => void; workspaceId: string
}) {
  const { mutate: remove, isPending } = useRemoveMember(workspaceId)
  return (
    <Dialog open={!!member} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Remove member</DialogTitle>
          <DialogDescription>
            Remove <span className="font-semibold text-on-surface">{member?.name}</span> from this workspace?
            They will lose access to all boards immediately.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <button type="button" onClick={() => onOpenChange(false)} disabled={isPending}
            className={cn('px-4 py-2 rounded-lg text-sm font-medium border border-outline-variant/20 text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:opacity-50 disabled:pointer-events-none')}>
            Cancel
          </button>
          <button type="button" onClick={() => member && remove(member.user_id, { onSuccess: () => onOpenChange(false) })} disabled={isPending}
            className={cn('px-4 py-2 rounded-lg text-sm font-bold bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive hover:text-background hover:border-transparent flex items-center gap-2 transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50 disabled:opacity-70 disabled:pointer-events-none')}>
            {isPending ? <><Loader2 className="size-4 animate-spin" />Removing…</> : <><Trash2 className="size-4" />Remove</>}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Cancel Invitation Dialog ───────────────────────────────────────────────────

function CancelInviteDialog({ invitation, onOpenChange, workspaceId }: {
  invitation: PendingInvitation | null; onOpenChange: (o: boolean) => void; workspaceId: string
}) {
  const { mutate: cancel, isPending } = useCancelInvitation(workspaceId)
  return (
    <Dialog open={!!invitation} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Cancel invitation?</DialogTitle>
          <DialogDescription>
            The invitation link sent to{' '}
            <span className="font-semibold text-on-surface">{invitation?.invited_email}</span>{' '}
            will stop working. You can send a fresh invitation to this address afterwards.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <button type="button" onClick={() => onOpenChange(false)} disabled={isPending}
            className={cn('px-4 py-2 rounded-lg text-sm font-medium border border-outline-variant/20 text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:opacity-50 disabled:pointer-events-none')}>
            Keep it
          </button>
          <button type="button" onClick={() => invitation && cancel(invitation.id, { onSuccess: () => onOpenChange(false) })} disabled={isPending}
            className={cn('px-4 py-2 rounded-lg text-sm font-bold bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive hover:text-background hover:border-transparent flex items-center gap-2 transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50 disabled:opacity-70 disabled:pointer-events-none')}>
            {isPending ? <><Loader2 className="size-4 animate-spin" />Cancelling…</> : 'Cancel invitation'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Invitations empty state ────────────────────────────────────────────────────

function InvitationsEmptyState({ onInvite }: { onInvite: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col items-center justify-center py-24 gap-6"
    >
      <div className="relative w-20 h-20">
        <motion.div
          animate={{ scale: [1, 1.12, 1], opacity: [0.25, 0.55, 0.25] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute inset-0 rounded-full"
          style={{ background: 'oklch(0.82 0.14 198 / 12%)', filter: 'blur(12px)' }}
        />
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 24, repeat: Infinity, ease: 'linear' }}
          className="absolute inset-2 rounded-full"
          style={{ background: 'conic-gradient(from 0deg, oklch(0.82 0.14 198 / 0%) 0%, oklch(0.82 0.14 198 / 30%) 50%, oklch(0.82 0.14 198 / 0%) 100%)' }}
        />
        <div
          className="absolute inset-3.5 rounded-full flex items-center justify-center"
          style={{ background: 'oklch(0.18 0.015 265)', border: '1px solid oklch(0.82 0.14 198 / 20%)', boxShadow: '0 0 20px oklch(0.82 0.14 198 / 10%)' }}
        >
          <Mail className="w-5 h-5 text-primary" />
        </div>
      </div>
      <div className="text-center space-y-2">
        <h3 className="font-display font-bold text-xl text-on-surface tracking-tight">No pending invitations</h3>
        <p className="text-sm text-outline max-w-xs leading-relaxed">
          Invite teammates by email. They'll get a link to join this workspace directly.
        </p>
      </div>
      <motion.button
        whileHover={{ scale: 1.04, boxShadow: '0 4px 28px oklch(0.82 0.14 198 / 28%)' }}
        whileTap={{ scale: 0.97 }}
        onClick={onInvite}
        className="df-gradient-cta flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-primary-foreground focus:outline-none"
      >
        <UserPlus className="w-4 h-4" />
        Send first invitation
      </motion.button>
    </motion.div>
  )
}

// ── MembersPage ───────────────────────────────────────────────────────────────

export function MembersPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const currentUser     = useAppSelector((state) => state.auth.user)

  const [activeTab,       setActiveTab]       = useState<Tab>('members')
  const [inviteOpen,      setInviteOpen]      = useState(false)
  const [memberToRemove,  setMemberToRemove]  = useState<MemberResponse | null>(null)
  const [inviteToCancel,  setInviteToCancel]  = useState<PendingInvitation | null>(null)

  const { data: workspace, isLoading } = useWorkspace(workspaceId)

  const currentMember = workspace?.members.find((m) => m.user_id === currentUser?.id)
  const viewerRole    = currentMember?.role
  const canManage     = viewerRole === 'owner' || viewerRole === 'admin'

  const { data: pendingInvitations = [], isLoading: invitesLoading } = usePendingInvitations(
    workspaceId ?? '',
    canManage,
  )

  if (isLoading) {
    return (
      <div className="flex h-full min-h-screen items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-outline" />
      </div>
    )
  }

  const members     = workspace?.members ?? []
  const adminCount  = members.filter((m) => m.role === 'admin').length
  const ownerCount  = members.filter((m) => m.role === 'owner').length
  const memberCount = members.filter((m) => m.role === 'member').length

  const sortedMembers = [...members].sort((a, b) => {
    const order: Record<WorkspaceRole, number> = { owner: 0, admin: 1, member: 2 }
    if (order[a.role] !== order[b.role]) return order[a.role] - order[b.role]
    return a.name.localeCompare(b.name)
  })

  return (
    <div className="flex flex-col min-h-screen relative">
      <AmbientOrbs />

      <MembersTopbar workspaceName={workspace?.name ?? ''} />

      <div className="flex-1 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
        <div className="max-w-3xl mx-auto space-y-8">

          {/* ── Page heading ─────────────────────────────────────────── */}
          <div className="flex items-end justify-between">
            <div>
              <motion.p
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1, duration: 0.3 }}
                className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary mb-2"
              >
                Team Management
              </motion.p>
              <motion.h1
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="font-display text-[2rem] font-extrabold tracking-tight text-on-surface leading-none"
              >
                Members
              </motion.h1>
            </div>

            {canManage && (
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 280, damping: 22 }}
                whileHover={{ scale: 1.03, boxShadow: '0 0 20px oklch(0.82 0.14 198 / 18%)' }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setInviteOpen(true)}
                className={cn(
                  'df-gradient-cta px-4 py-2.5 rounded-xl',
                  'text-sm font-bold text-primary-foreground',
                  'flex items-center gap-2',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                  'shadow-[0_0_20px_oklch(0.82_0.14_198/15%)]',
                )}
              >
                <UserPlus className="size-4" />
                Invite
              </motion.button>
            )}
          </div>

          {/* ── Stats ─────────────────────────────────────────────────── */}
          <div className="grid grid-cols-3 sm:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
            <StatCard label="Total members"   value={members.length}               sublabel={`in ${workspace?.name ?? 'workspace'}`}                     index={0} />
            <StatCard label="Admins"          value={adminCount}                   sublabel={ownerCount === 1 ? '+ 1 owner' : `+ ${ownerCount} owners`}  accent="text-df-secondary" index={1} />
            {canManage
              ? <StatCard label="Pending invites" value={pendingInvitations.length} sublabel="awaiting response" accent="text-primary" index={2} />
              : <StatCard label="Members"         value={memberCount}               sublabel="standard access"   accent="text-on-surface-variant" index={2} />
            }
          </div>

          {/* ── Tabs ──────────────────────────────────────────────────── */}
          {canManage && (
            <TabSwitcher active={activeTab} onChange={setActiveTab} pendingCount={pendingInvitations.length} />
          )}

          {/* ── Tab panels ────────────────────────────────────────────── */}
          <AnimatePresence mode="wait">

            {activeTab === 'members' && (
              <motion.div
                key="members"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.14 }}
              >
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-outline">
                    {members.length} {members.length === 1 ? 'person' : 'people'}
                  </p>
                  <p className="text-[10px] font-medium text-outline/60">Sorted by role</p>
                </div>

                {sortedMembers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 rounded-xl border border-outline-variant/10 bg-surface-container-low">
                    <Users className="w-8 h-8 text-outline/30 mb-3" strokeWidth={1.5} />
                    <p className="text-sm text-outline">No members yet.</p>
                  </div>
                ) : (
                  <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-2">
                    <AnimatePresence mode="popLayout">
                      {sortedMembers.map((member) => (
                        <MemberCard
                          key={member.user_id}
                          member={member}
                          currentUserId={currentUser?.id}
                          viewerRole={viewerRole}
                          workspaceId={workspaceId ?? ''}
                          onRemove={setMemberToRemove}
                        />
                      ))}
                    </AnimatePresence>
                  </motion.div>
                )}

                {!canManage && (
                  <p className="text-center text-xs text-outline/60 mt-8">
                    Only admins and owners can invite new members.
                  </p>
                )}
              </motion.div>
            )}

            {activeTab === 'invitations' && canManage && (
              <motion.div
                key="invitations"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.14 }}
              >
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-outline">
                    {pendingInvitations.length} pending
                  </p>
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setInviteOpen(true)}
                    className="text-[10px] font-semibold text-primary hover:text-primary/80 transition-colors"
                  >
                    + New invitation
                  </motion.button>
                </div>

                {invitesLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="size-5 animate-spin text-outline" />
                  </div>
                ) : pendingInvitations.length === 0 ? (
                  <InvitationsEmptyState onInvite={() => setInviteOpen(true)} />
                ) : (
                  <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-2">
                    <AnimatePresence mode="popLayout">
                      {pendingInvitations.map((inv) => (
                        <InvitationCard key={inv.id} invitation={inv} onCancel={setInviteToCancel} />
                      ))}
                    </AnimatePresence>
                  </motion.div>
                )}
              </motion.div>
            )}

          </AnimatePresence>

        </div>
      </div>

      {/* Dialogs */}
      {workspaceId && <SendInviteDialog open={inviteOpen} onOpenChange={setInviteOpen} workspaceId={workspaceId} />}
      <RemoveDialog member={memberToRemove} onOpenChange={(o) => !o && setMemberToRemove(null)} workspaceId={workspaceId ?? ''} />
      <CancelInviteDialog invitation={inviteToCancel} onOpenChange={(o) => !o && setInviteToCancel(null)} workspaceId={workspaceId ?? ''} />
    </div>
  )
}