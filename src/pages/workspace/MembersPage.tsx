// src/pages/workspace/MembersPage.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Workspace members management page — Redesigned (Obsidian Studio)
//
// Layout changes:
//   - Topbar: workspace name + breadcrumb chip (unchanged shape, refined styling)
//   - Hero section: large stat cards (member count, role breakdown)
//   - Member list: card-based rows replacing the raw <table>
//     Each member card shows: avatar monogram, name, email, role badge, actions
//   - Invite dialog: unchanged logic, refined presentation
//   - Remove dialog: unchanged logic, refined presentation
//
// Role-gated rules are identical to the original.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { isAxiosError } from 'axios'
import {
  UserPlus,
  Trash2,
  Loader2,
  AlertCircle,
  Crown,
  ShieldCheck,
  User,
  Users,
  Mail,
} from 'lucide-react'
import { useAppSelector } from '@/store/hooks'
import { useWorkspace } from '@/hooks/useWorkspace'
import { useInviteMember } from '@/hooks/useInviteMember'
import { useRemoveMember } from '@/hooks/useRemoveMember'
import { useChangeMemberRole } from '@/hooks/useChangeMemberRole'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  inviteMemberSchema,
  type InviteMemberFormValues,
  type AssignableRole,
} from '@/lib/validations'
import type { ApiErrorCode, MemberResponse, WorkspaceRole } from '@/lib/types'
import { cn } from '@/lib/utils'
import { getInitials } from '@/lib/utils'

// ── Error mapping ─────────────────────────────────────────────────────────────

const INVITE_ERROR_MESSAGES: Partial<Record<ApiErrorCode, string>> = {
  USER_NOT_FOUND: 'No account found with that email address.',
  ALREADY_WORKSPACE_MEMBER: 'This person is already a member.',
  INSUFFICIENT_PERMISSIONS: "You don't have permission to invite members.",
  RATE_LIMITED: 'Too many attempts. Please wait a moment.',
  INTERNAL_ERROR: 'Something went wrong. Please try again.',
}

const FALLBACK_ERROR = 'Something went wrong. Please try again.'

function getInviteError(error: unknown): string | null {
  if (!isAxiosError<{ error: { code: ApiErrorCode } }>(error)) return null
  const code = error.response?.data?.error?.code
  if (!code) return FALLBACK_ERROR
  return INVITE_ERROR_MESSAGES[code] ?? FALLBACK_ERROR
}

// ── Role config ───────────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<
  WorkspaceRole,
  {
    label: string
    icon: React.ElementType
    pillClass: string
    avatarClass: string
  }
> = {
  owner: {
    label: 'Owner',
    icon: Crown,
    pillClass:
      'bg-primary/10 text-primary border border-primary/20',
    avatarClass: 'bg-primary/15 text-primary ring-1 ring-primary/25',
  },
  admin: {
    label: 'Admin',
    icon: ShieldCheck,
    pillClass:
      'bg-df-secondary/10 text-df-secondary border border-df-secondary/20',
    avatarClass:
      'bg-df-secondary/10 text-df-secondary ring-1 ring-df-secondary/20',
  },
  member: {
    label: 'Member',
    icon: User,
    pillClass:
      'bg-surface-container-highest text-on-surface-variant border border-outline-variant/20',
    avatarClass:
      'bg-df-tertiary-container text-df-on-tertiary-container ring-1 ring-df-tertiary/15',
  },
}

// ── Deterministic avatar hue (same logic as WorkspaceSwitcher) ────────────────

function getAvatarHue(id: string): string {
  const hues = [198, 280, 285, 155, 35, 320]
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0
  return `${hues[Math.abs(hash) % hues.length]}`
}

// ── MembersTopbar ─────────────────────────────────────────────────────────────

function MembersTopbar({ workspaceName }: { workspaceName: string }) {
  return (
    <header className="h-14 flex items-center gap-3 px-8 bg-background/70 backdrop-blur-md border-b border-outline-variant/10 sticky top-0 z-30">
      <span className="text-sm font-semibold text-on-surface-variant truncate">
        {workspaceName}
      </span>
      <span className="text-outline/40 text-sm">/</span>
      <span
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md',
          'text-xs font-semibold text-primary',
          'bg-primary/[0.08] border border-primary/[0.12]',
        )}
      >
        <Users className="w-3 h-3" strokeWidth={2} />
        Members
      </span>
    </header>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string
  value: number | string
  sublabel?: string
  accent?: string
}

function StatCard({ label, value, sublabel, accent }: StatCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl p-5 border border-outline-variant/15',
        'bg-surface-container-low',
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-outline mb-3">
        {label}
      </p>
      <p
        className={cn(
          'font-display text-3xl font-extrabold tracking-tight',
          accent ?? 'text-on-surface',
        )}
      >
        {value}
      </p>
      {sublabel && (
        <p className="text-xs text-on-surface-variant mt-1">{sublabel}</p>
      )}
    </div>
  )
}

// ── InviteDialog ──────────────────────────────────────────────────────────────

interface InviteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string
}

function InviteDialog({ open, onOpenChange, workspaceId }: InviteDialogProps) {
  const { mutate: invite, isPending, error, reset } = useInviteMember(workspaceId)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset: resetForm,
  } = useForm<InviteMemberFormValues>({
    resolver: zodResolver(inviteMemberSchema),
  })

  const serverError = getInviteError(error)

  function handleClose(open: boolean) {
    if (!open) {
      resetForm()
      reset()
    }
    onOpenChange(open)
  }

  function onSubmit(data: InviteMemberFormValues) {
    invite(data, {
      onSuccess: () => {
        resetForm()
        reset()
        onOpenChange(false)
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a teammate</DialogTitle>
          <DialogDescription>
            Invite someone by email. They must already have a Docflow account.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="invite-email"
              className="text-[10px] font-semibold uppercase tracking-[0.12em] text-outline"
            >
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
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? 'invite-email-error' : undefined}
              />
            </div>
            {errors.email && (
              <p
                id="invite-email-error"
                role="alert"
                className="flex items-center gap-1.5 text-[11px] font-medium text-destructive"
              >
                <AlertCircle className="size-3 shrink-0" aria-hidden="true" />
                {errors.email.message}
              </p>
            )}
          </div>

          {serverError && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-destructive/8 border border-destructive/15">
              <AlertCircle className="size-4 shrink-0 text-destructive" aria-hidden="true" />
              <p role="alert" className="text-sm text-destructive">{serverError}</p>
            </div>
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
              type="submit"
              disabled={isPending}
              className={cn(
                'df-gradient-cta px-5 py-2 rounded-lg',
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
                  Sending…
                </>
              ) : (
                <>
                  <UserPlus className="size-4" aria-hidden="true" />
                  Send invite
                </>
              )}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── RemoveDialog ──────────────────────────────────────────────────────────────

interface RemoveDialogProps {
  member: MemberResponse | null
  onOpenChange: (open: boolean) => void
  workspaceId: string
}

function RemoveDialog({ member, onOpenChange, workspaceId }: RemoveDialogProps) {
  const { mutate: remove, isPending } = useRemoveMember(workspaceId)

  function handleConfirm() {
    if (!member) return
    remove(member.user_id, {
      onSuccess: () => onOpenChange(false),
    })
  }

  return (
    <Dialog open={!!member} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Remove member</DialogTitle>
          <DialogDescription>
            Remove{' '}
            <span className="font-semibold text-on-surface">{member?.name}</span>{' '}
            from this workspace? They will lose access to all boards immediately.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
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
            onClick={handleConfirm}
            disabled={isPending}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-bold',
              'bg-destructive/10 text-destructive border border-destructive/20',
              'hover:bg-destructive hover:text-background hover:border-transparent',
              'flex items-center gap-2 transition-all duration-150',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50',
              'disabled:opacity-70 disabled:pointer-events-none',
            )}
          >
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Removing…
              </>
            ) : (
              <>
                <Trash2 className="size-4" aria-hidden="true" />
                Remove
              </>
            )}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── RoleBadge ─────────────────────────────────────────────────────────────────

interface RoleBadgeProps {
  member: MemberResponse
  viewerRole: WorkspaceRole | undefined
  workspaceId: string
}

function RoleBadge({ member, viewerRole, workspaceId }: RoleBadgeProps) {
  const { mutate: changeRole, isPending } = useChangeMemberRole(workspaceId)
  const config = ROLE_CONFIG[member.role]
  const RoleIcon = config.icon

  const canChangeRole = viewerRole === 'owner' && member.role !== 'owner'

  if (!canChangeRole) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md',
          'text-[11px] font-semibold',
          config.pillClass,
        )}
      >
        <RoleIcon className="w-3 h-3" aria-hidden="true" />
        {config.label}
      </span>
    )
  }

  return (
    <Select
      value={member.role as AssignableRole}
      onValueChange={(value) =>
        changeRole({ userId: member.user_id, role: value as AssignableRole })
      }
      disabled={isPending}
    >
      <SelectTrigger
        size="sm"
        className={cn(
          'w-auto min-w-[100px] border-transparent text-[11px] font-semibold',
          'hover:border-outline-variant/20',
          config.pillClass,
        )}
        aria-label={`Change role for ${member.name}`}
      >
        <div className="flex items-center gap-1.5">
          {isPending ? (
            <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
          ) : (
            <RoleIcon className="w-3 h-3" aria-hidden="true" />
          )}
          <SelectValue />
        </div>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="admin">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-3.5 text-df-secondary" aria-hidden="true" />
            Admin
          </div>
        </SelectItem>
        <SelectItem value="member">
          <div className="flex items-center gap-2">
            <User className="size-3.5 text-outline" aria-hidden="true" />
            Member
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  )
}

// ── MemberCard ────────────────────────────────────────────────────────────────

interface MemberCardProps {
  member: MemberResponse
  currentUserId: string | undefined
  viewerRole: WorkspaceRole | undefined
  workspaceId: string
  onRemove: (member: MemberResponse) => void
  index: number
}

function MemberCard({
  member,
  currentUserId,
  viewerRole,
  workspaceId,
  onRemove,
  index,
}: MemberCardProps) {
  const isOwner = member.role === 'owner'
  const isSelf = member.user_id === currentUserId
  const config = ROLE_CONFIG[member.role]

  const canRemove =
    !isOwner &&
    !isSelf &&
    (viewerRole === 'owner' ||
      (viewerRole === 'admin' && member.role === 'member'))

  const initials = getInitials(member.name)
  const hue = getAvatarHue(member.user_id)

  return (
    <div
      className={cn(
        'group relative flex items-center gap-4 px-5 py-4',
        'rounded-xl border border-outline-variant/10',
        'bg-surface-container-low',
        'hover:bg-surface-container hover:border-outline-variant/20',
        'transition-all duration-150',
        // Stagger via style below
      )}
      style={{ animationDelay: `${index * 30}ms` }}
    >
      {/* Avatar */}
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-[12px] font-bold select-none"
        style={{
          background: `oklch(0.38 0.12 ${hue})`,
          color: 'oklch(0.92 0.015 265)',
          boxShadow: `0 0 0 1px oklch(0.45 0.10 ${hue} / 40%)`,
        }}
        aria-hidden="true"
      >
        {initials}
      </div>

      {/* Name + email */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-[13px] font-semibold text-on-surface truncate">
            {member.name}
          </p>
          {isSelf && (
            <span className="shrink-0 inline-flex items-center px-1.5 py-px rounded text-[9px] font-bold uppercase tracking-[0.08em] bg-surface-container-highest text-outline border border-outline-variant/20">
              You
            </span>
          )}
        </div>
        <p className="text-xs text-outline truncate">{member.email}</p>
      </div>

      {/* Role badge / select */}
      <div className="shrink-0">
        <RoleBadge
          member={member}
          viewerRole={viewerRole}
          workspaceId={workspaceId}
        />
      </div>

      {/* Remove action */}
      <div className="shrink-0 w-8 flex items-center justify-center">
        {canRemove ? (
          <button
            onClick={() => onRemove(member)}
            aria-label={`Remove ${member.name} from workspace`}
            className={cn(
              'p-1.5 rounded-lg',
              'text-outline/40 hover:text-destructive',
              'hover:bg-destructive/8',
              'opacity-0 group-hover:opacity-100',
              'transition-all duration-150',
              'focus:outline-none focus:opacity-100 focus-visible:ring-2 focus-visible:ring-destructive/50',
            )}
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
          </button>
        ) : (
          /* Fixed-width spacer so layout doesn't jump on hover */
          <span className="w-7 h-7" aria-hidden="true" />
        )}
      </div>
    </div>
  )
}

// ── MembersPage ───────────────────────────────────────────────────────────────

export function MembersPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const currentUser = useAppSelector((state) => state.auth.user)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [memberToRemove, setMemberToRemove] = useState<MemberResponse | null>(null)

  const { data: workspace, isLoading } = useWorkspace(workspaceId)

  const currentMember = workspace?.members.find(
    (m) => m.user_id === currentUser?.id,
  )
  const viewerRole = currentMember?.role
  const canInvite = viewerRole === 'owner' || viewerRole === 'admin'

  if (isLoading) {
    return (
      <div className="flex h-full min-h-screen items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-outline" />
      </div>
    )
  }

  const members = workspace?.members ?? []
  const ownerCount = members.filter((m) => m.role === 'owner').length
  const adminCount = members.filter((m) => m.role === 'admin').length
  const memberCount = members.filter((m) => m.role === 'member').length

  // Sort: owner first, then admins, then members — alphabetical within group
  const sortedMembers = [...members].sort((a, b) => {
    const order: Record<WorkspaceRole, number> = { owner: 0, admin: 1, member: 2 }
    if (order[a.role] !== order[b.role]) return order[a.role] - order[b.role]
    return a.name.localeCompare(b.name)
  })

  return (
    <div className="flex flex-col min-h-screen">
      {/* Topbar */}
      <MembersTopbar workspaceName={workspace?.name ?? ''} />

      {/* Content */}
      <div className="flex-1 p-8">
        <div className="max-w-3xl mx-auto space-y-8">

          {/* ── Page heading ──────────────────────────────────────────── */}
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary mb-2">
                Team Management
              </p>
              <h1 className="font-display text-[2rem] font-extrabold tracking-tight text-on-surface leading-none">
                Members
              </h1>
            </div>

            {canInvite && (
              <button
                onClick={() => setInviteOpen(true)}
                className={cn(
                  'df-gradient-cta px-4 py-2.5 rounded-xl',
                  'text-sm font-bold text-primary-foreground',
                  'flex items-center gap-2',
                  'hover:opacity-90 transition-opacity',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                  'shadow-[0_0_20px_oklch(0.82_0.14_198/15%)]',
                )}
              >
                <UserPlus className="size-4" aria-hidden="true" />
                Invite
              </button>
            )}
          </div>

          {/* ── Stats row ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-3">
            <StatCard
              label="Total members"
              value={members.length}
              sublabel={`in ${workspace?.name ?? 'workspace'}`}
            />
            <StatCard
              label="Admins"
              value={adminCount}
              sublabel={ownerCount === 1 ? '+ 1 owner' : `+ ${ownerCount} owners`}
              accent="text-df-secondary"
            />
            <StatCard
              label="Members"
              value={memberCount}
              sublabel="standard access"
              accent="text-on-surface-variant"
            />
          </div>

          {/* ── Member list ───────────────────────────────────────────── */}
          <div>
            {/* Section header */}
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-outline">
                {members.length} {members.length === 1 ? 'person' : 'people'}
              </p>
              <p className="text-[10px] font-medium text-outline/60">
                Sorted by role
              </p>
            </div>

            {/* Cards */}
            {sortedMembers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 rounded-xl border border-outline-variant/10 bg-surface-container-low">
                <Users className="w-8 h-8 text-outline/30 mb-3" strokeWidth={1.5} />
                <p className="text-sm text-outline">No members yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sortedMembers.map((member, i) => (
                  <MemberCard
                    key={member.user_id}
                    member={member}
                    currentUserId={currentUser?.id}
                    viewerRole={viewerRole}
                    workspaceId={workspaceId ?? ''}
                    onRemove={setMemberToRemove}
                    index={i}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── Invite hint (non-admin viewers) ───────────────────────── */}
          {!canInvite && (
            <p className="text-center text-xs text-outline/60">
              Only admins and owners can invite new members.
            </p>
          )}

        </div>
      </div>

      {/* Dialogs */}
      {workspaceId && (
        <InviteDialog
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          workspaceId={workspaceId}
        />
      )}
      <RemoveDialog
        member={memberToRemove}
        onOpenChange={(open) => !open && setMemberToRemove(null)}
        workspaceId={workspaceId ?? ''}
      />
    </div>
  )
}