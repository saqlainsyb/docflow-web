// src/pages/workspace/MembersPage.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Workspace members management page.
//
// Shows all workspace members in a table. Role-gated actions:
//   - Invite member    (admin, owner)
//   - Change role      (owner only — backend enforces this)
//   - Remove member    (admin, owner — with constraints)
//
// Sub-components (page-scoped, not exported):
//   MembersTopbar    — workspace name + breadcrumb
//   InviteDialog     — email form in a Dialog, uses useInviteMember
//   RemoveDialog     — confirmation dialog, uses useRemoveMember
//   RoleBadge        — inline role display, clickable Select for owner
//   MemberRow        — single table row
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
  INSUFFICIENT_PERMISSIONS: 'You don\'t have permission to invite members.',
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

// ── Role helpers ──────────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<
  WorkspaceRole,
  { label: string; icon: React.ElementType; className: string }
> = {
  owner: {
    label: 'Owner',
    icon: Crown,
    className: 'bg-df-primary-container/20 text-df-primary-fixed-dim',
  },
  admin: {
    label: 'Admin',
    icon: ShieldCheck,
    className: 'bg-df-tertiary/10 text-df-tertiary',
  },
  member: {
    label: 'Member',
    icon: User,
    className: 'bg-surface-container-highest text-outline',
  },
}

// ── MembersTopbar ─────────────────────────────────────────────────────────────

function MembersTopbar({ workspaceName }: { workspaceName: string }) {
  return (
    <header className="h-16 flex items-center gap-4 px-8 bg-background/80 backdrop-blur-md border-b border-outline-variant/10 sticky top-0 z-30">
      <h2 className="font-display font-bold text-lg text-on-surface truncate">
        {workspaceName}
      </h2>
      <div className="h-4 w-px bg-outline-variant/30 shrink-0" />
      <span className="text-xs text-outline font-medium">Members</span>
    </header>
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
          <DialogTitle>Invite Member</DialogTitle>
          <DialogDescription>
            Invite someone to this workspace by email. They must already have a
            Docflow account.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          {/* Email field */}
          <div className="space-y-1.5">
            <label
              htmlFor="invite-email"
              className="text-xs font-medium uppercase tracking-[0.15em] text-outline"
            >
              Email address
            </label>
            <input
              {...register('email')}
              id="invite-email"
              type="email"
              placeholder="colleague@company.com"
              autoComplete="off"
              className={cn(
                'w-full bg-surface-container-lowest rounded-lg px-4 py-2.5',
                'text-sm text-on-surface placeholder:text-outline/50',
                'border border-outline-variant/20',
                'focus:outline-none focus:border-primary/30',
                'focus:shadow-[0_0_15px_rgba(0,218,243,0.1)]',
                'transition-all duration-200',
                errors.email && 'border-destructive focus:border-destructive',
              )}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'invite-email-error' : undefined}
            />
            {errors.email && (
              <p
                id="invite-email-error"
                role="alert"
                className="flex items-center gap-1 text-[11px] font-medium text-destructive"
              >
                <AlertCircle className="size-3 shrink-0" aria-hidden="true" />
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Server error */}
          {serverError && (
            <p
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
              'bg-destructive/10 text-destructive',
              'hover:bg-destructive hover:text-background',
              'flex items-center gap-2 transition-colors duration-150',
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
// Shows the role as a pill. When the viewer is owner and the target is not owner,
// renders as a Select for inline role changing.

interface RoleBadgeProps {
  member: MemberResponse
  viewerRole: WorkspaceRole | undefined
  workspaceId: string
}

function RoleBadge({ member, viewerRole, workspaceId }: RoleBadgeProps) {
  const { mutate: changeRole, isPending } = useChangeMemberRole(workspaceId)
  const config = ROLE_CONFIG[member.role]
  const RoleIcon = config.icon

  const canChangeRole =
    viewerRole === 'owner' &&
    member.role !== 'owner'

  if (!canChangeRole) {
    // Static badge — no interaction
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-1 rounded-full',
          'text-xs font-bold',
          config.className,
        )}
      >
        <RoleIcon className="size-3" aria-hidden="true" />
        {config.label}
      </span>
    )
  }

  // Interactive Select for owner changing assignable roles
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
          'w-auto min-w-25 border-transparent',
          'hover:border-outline-variant/20',
          config.className,
        )}
        aria-label={`Change role for ${member.name}`}
      >
        <div className="flex items-center gap-1.5">
          {isPending ? (
            <Loader2 className="size-3 animate-spin" aria-hidden="true" />
          ) : (
            <RoleIcon className="size-3" aria-hidden="true" />
          )}
          <SelectValue />
        </div>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="admin">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-3.5 text-df-tertiary" aria-hidden="true" />
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

// ── MemberRow ─────────────────────────────────────────────────────────────────

interface MemberRowProps {
  member: MemberResponse
  currentUserId: string | undefined
  viewerRole: WorkspaceRole | undefined
  workspaceOwnerId: string
  workspaceId: string
  onRemove: (member: MemberResponse) => void
}

function MemberRow({
  member,
  currentUserId,
  viewerRole,
  workspaceOwnerId,
  workspaceId,
  onRemove,
}: MemberRowProps) {
  const isOwner = member.role === 'owner'
  const isSelf = member.user_id === currentUserId

  // Remove button visibility rules (mirrors backend enforcement):
  //   - Owner row: never removable
  //   - Self: cannot remove yourself
  //   - Admin removing admin: not allowed (owner only)
  //   - Member with admin/owner role viewing others: can remove
  const canRemove =
    !isOwner &&
    !isSelf &&
    (viewerRole === 'owner' ||
      (viewerRole === 'admin' && member.role === 'member'))

  const initials = getInitials(member.name)

  return (
    <tr className="border-b border-outline-variant/5 hover:bg-surface-container/50 transition-colors">
      {/* Member */}
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center shrink-0',
              'bg-df-tertiary-container text-df-on-tertiary-container',
              'text-xs font-bold select-none',
            )}
            aria-hidden="true"
          >
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-on-surface truncate">
              {member.name}
              {isSelf && (
                <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-outline">
                  You
                </span>
              )}
            </p>
          </div>
        </div>
      </td>

      {/* Email */}
      <td className="px-6 py-4">
        <span className="text-sm text-outline truncate">{member.email}</span>
      </td>

      {/* Role */}
      <td className="px-6 py-4">
        <RoleBadge
          member={member}
          viewerRole={viewerRole}
          workspaceId={workspaceId}
        />
      </td>

      {/* Actions */}
      <td className="px-6 py-4 text-right">
        {canRemove && (
          <button
            onClick={() => onRemove(member)}
            aria-label={`Remove ${member.name} from workspace`}
            className={cn(
              'p-1.5 rounded-lg text-outline',
              'hover:text-destructive hover:bg-destructive/10',
              'transition-colors duration-150',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50',
            )}
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </button>
        )}
      </td>
    </tr>
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

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex h-full min-h-screen items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-outline" />
      </div>
    )
  }

  const members = workspace?.members ?? []

  return (
    <div className="flex flex-col min-h-screen">
      {/* Topbar */}
      <MembersTopbar workspaceName={workspace?.name ?? ''} />

      {/* Page content */}
      <div className="flex-1 p-8">
        <div className="max-w-5xl mx-auto space-y-8">

          {/* Page heading row */}
          <div className="flex items-end justify-between">
            <div>
              <p className="df-label-editorial text-primary mb-2">
                Team Management
              </p>
              <h1 className="font-display text-4xl font-extrabold tracking-tight text-on-surface">
                Members
              </h1>
            </div>

            {canInvite && (
              <button
                onClick={() => setInviteOpen(true)}
                className={cn(
                  'df-gradient-cta px-5 py-2.5 rounded-full',
                  'text-sm font-bold text-primary-foreground',
                  'flex items-center gap-2',
                  'hover:opacity-90 transition-opacity',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                  'shadow-[0_0_20px_oklch(0.82_0.14_198/20%)]',
                )}
              >
                <UserPlus className="size-4" aria-hidden="true" />
                Invite Member
              </button>
            )}
          </div>

          {/* Members table */}
          <div className="bg-surface-container-low rounded-2xl overflow-hidden ring-1 ring-outline-variant/10">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container border-b border-outline-variant/10">
                  <th className="px-6 py-4 text-[10px] font-medium uppercase tracking-[0.15em] text-outline">
                    Member
                  </th>
                  <th className="px-6 py-4 text-[10px] font-medium uppercase tracking-[0.15em] text-outline">
                    Email
                  </th>
                  <th className="px-6 py-4 text-[10px] font-medium uppercase tracking-[0.15em] text-outline">
                    Role
                  </th>
                  <th className="px-6 py-4 text-[10px] font-medium uppercase tracking-[0.15em] text-outline text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/5">
                {members.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-6 py-12 text-center text-sm text-outline"
                    >
                      No members found.
                    </td>
                  </tr>
                ) : (
                  members.map((member) => (
                    <MemberRow
                      key={member.user_id}
                      member={member}
                      currentUserId={currentUser?.id}
                      viewerRole={viewerRole}
                      workspaceOwnerId={workspace?.owner_id ?? ''}
                      workspaceId={workspaceId ?? ''}
                      onRemove={setMemberToRemove}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

        </div>
      </div>

      {/* Dialogs — rendered outside the table to avoid nesting issues */}
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