// src/components/board/BoardMembersDialog.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Dialog for managing board-level membership.
//
// Features (all gated by useBoardPermissions):
//   - Member list with board role badges (Owner / Admin / Editor)
//   - Change role dropdown  — board owner only (admin ↔ editor)
//   - Remove member button  — board owner/admin (with guards)
//   - Transfer ownership    — board owner only (with confirm step)
//   - Add member panel      — board owner/admin
//     Pulls workspace members not yet on the board, lets requester pick
//     one and assign a role (admin option only visible to board owner)
//
// All permission enforcement is also on the backend — the UI just hides
// controls the user cannot use.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Crown,
  ShieldCheck,
  Pencil,
  Trash2,
  UserPlus,
  Loader2,
  ArrowLeftRight,
  Users,
  Check,
  ChevronDown,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { getInitials } from '@/lib/utils'
import { useAppSelector } from '@/store/hooks'
import { useWorkspace } from '@/hooks/useWorkspace'
import { useAddBoardMember } from '@/hooks/useAddBoardMember'
import { useRemoveBoardMember } from '@/hooks/useRemoveBoardMember'
import { useUpdateBoardMemberRole } from '@/hooks/useUpdateBoardMemberRole'
import { useTransferOwnership } from '@/hooks/useTransferOwnership'
import { useBoardPermissions } from '@/hooks/useBoardPermissions'
import type { BoardMember, BoardRole } from '@/lib/types'

// ── Design tokens ─────────────────────────────────────────────────────────────

const DIALOG_CONTENT_STYLE = {
  background:
    'linear-gradient(160deg, oklch(0.175 0.018 265) 0%, oklch(0.155 0.014 265) 100%)',
  border: '1px solid rgba(255,255,255,0.08)',
  boxShadow: '0 32px 64px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04)',
  borderRadius: '1.25rem',
}

// Board role display config
const BOARD_ROLE_CONFIG: Record<BoardRole, {
  label: string
  icon: React.ElementType
  color: string
  bg: string
  border: string
}> = {
  owner: {
    label: 'Owner',
    icon: Crown,
    color: 'oklch(0.82 0.14 198)',
    bg: 'rgba(0,218,243,0.10)',
    border: 'rgba(0,218,243,0.20)',
  },
  admin: {
    label: 'Admin',
    icon: ShieldCheck,
    color: 'oklch(0.80 0.12 280)',
    bg: 'rgba(167,139,250,0.10)',
    border: 'rgba(167,139,250,0.20)',
  },
  editor: {
    label: 'Editor',
    icon: Pencil,
    color: 'rgba(255,255,255,0.55)',
    bg: 'rgba(255,255,255,0.06)',
    border: 'rgba(255,255,255,0.10)',
  },
}

// Deterministic avatar hue per user id
function getAvatarHue(id: string): string {
  const hues = [198, 280, 285, 155, 35, 320]
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0
  return `${hues[Math.abs(hash) % hues.length]}`
}

// ── BoardRoleBadge ────────────────────────────────────────────────────────────

function BoardRoleBadge({ role }: { role: BoardRole }) {
  const cfg = BOARD_ROLE_CONFIG[role]
  const Icon = cfg.icon

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold shrink-0"
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}
    >
      <Icon className="w-2.5 h-2.5" />
      {cfg.label}
    </span>
  )
}

// ── MemberRow ─────────────────────────────────────────────────────────────────

interface MemberRowProps {
  member: BoardMember
  boardId: string
  currentUserId: string | undefined
  myBoardRole: BoardRole | string
  onTransferClick: (member: BoardMember) => void
}

function MemberRow({ member, boardId, currentUserId, myBoardRole, onTransferClick }: MemberRowProps) {
  const perms = useBoardPermissions(myBoardRole)
  const isSelf = member.user_id === currentUserId
  const isOwner = member.board_role === 'owner'
  const isAdmin = member.board_role === 'admin'

  const { mutate: updateRole, isPending: isUpdatingRole } = useUpdateBoardMemberRole(boardId)
  const { mutate: removeMember, isPending: isRemoving } = useRemoveBoardMember(boardId)

  // Can change this member's role:
  // - Only board owner can change roles
  // - Cannot change the owner's role (use transfer instead)
  const canChangeRole = perms.canGrantAdmin && !isOwner && !isSelf

  // Can remove this member:
  // - Owner/admin can remove, but not the board owner
  // - Admin cannot remove another admin (enforced server-side too)
  const canRemove =
    perms.canManageMembers &&
    !isOwner &&
    !isSelf &&
    !(isAdmin && !perms.canRemoveAdmins)

  const hue = getAvatarHue(member.user_id)
  const cfg = BOARD_ROLE_CONFIG[member.board_role]

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -16 }}
      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
      className="group flex items-center gap-3 px-4 py-3 rounded-xl transition-colors"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Avatar */}
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold select-none"
        style={{
          background: `oklch(0.38 0.12 ${hue})`,
          color: 'oklch(0.92 0.015 265)',
          boxShadow: `0 0 0 1px oklch(0.45 0.10 ${hue} / 40%)`,
        }}
      >
        {member.avatar_url ? (
          <img src={member.avatar_url} alt={member.name} className="w-full h-full rounded-full object-cover" />
        ) : (
          getInitials(member.name)
        )}
      </div>

      {/* Name + email */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <p className="text-[13px] font-semibold truncate" style={{ color: 'rgba(255,255,255,0.82)' }}>
            {member.name}
          </p>
          {isSelf && (
            <span
              className="shrink-0 px-1.5 py-px rounded text-[9px] font-bold uppercase tracking-wide"
              style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.35)' }}
            >
              You
            </span>
          )}
        </div>
        <p className="text-[11px] truncate" style={{ color: 'rgba(255,255,255,0.35)' }}>
          {member.email}
        </p>
      </div>

      {/* Role — editable for board owner (except for the owner row) */}
      <div className="shrink-0">
        {canChangeRole ? (
          <Select
            value={member.board_role}
            onValueChange={(value) =>
              updateRole({ userId: member.user_id, role: value as 'admin' | 'editor' })
            }
            disabled={isUpdatingRole}
          >
            <SelectTrigger
              className="w-auto min-w-[90px] h-7 text-[11px] font-semibold border-transparent"
              style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}
              aria-label={`Change role for ${member.name}`}
            >
              <div className="flex items-center gap-1.5">
                {isUpdatingRole ? (
                  <Loader2 className="w-2.5 h-2.5 animate-spin" />
                ) : (
                  <cfg.icon className="w-2.5 h-2.5" />
                )}
                <SelectValue />
                <ChevronDown className="w-2.5 h-2.5 opacity-50" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">
                <div className="flex items-center gap-2 text-[12px]">
                  <ShieldCheck className="w-3 h-3" style={{ color: BOARD_ROLE_CONFIG.admin.color }} />
                  Admin
                </div>
              </SelectItem>
              <SelectItem value="editor">
                <div className="flex items-center gap-2 text-[12px]">
                  <Pencil className="w-3 h-3" style={{ color: BOARD_ROLE_CONFIG.editor.color }} />
                  Editor
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <BoardRoleBadge role={member.board_role} />
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Transfer ownership — only shown on non-owner rows when viewer is board owner */}
        {perms.canTransferOwnership && !isOwner && (
          <button
            onClick={() => onTransferClick(member)}
            title={`Transfer ownership to ${member.name}`}
            className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all focus:opacity-100 focus:outline-none"
            style={{ color: 'rgba(255,255,255,0.35)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(0,218,243,0.10)'
              e.currentTarget.style.color = 'oklch(0.82 0.14 198)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'rgba(255,255,255,0.35)'
            }}
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Remove member */}
        {canRemove && (
          <button
            onClick={() => removeMember(member.user_id)}
            disabled={isRemoving}
            title={`Remove ${member.name} from board`}
            className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all focus:opacity-100 focus:outline-none disabled:opacity-30"
            style={{ color: 'rgba(255,255,255,0.35)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(239,68,68,0.10)'
              e.currentTarget.style.color = '#EF4444'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'rgba(255,255,255,0.35)'
            }}
          >
            {isRemoving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
          </button>
        )}

        {/* Fixed-width spacer so layout doesn't jump */}
        {!canRemove && !perms.canTransferOwnership && (
          <span className="w-7" aria-hidden />
        )}
      </div>
    </motion.div>
  )
}

// ── TransferConfirmDialog ─────────────────────────────────────────────────────

interface TransferConfirmProps {
  member: BoardMember | null
  boardId: string
  onClose: () => void
}

function TransferConfirmDialog({ member, boardId, onClose }: TransferConfirmProps) {
  const { mutate: transfer, isPending } = useTransferOwnership(boardId)

  function handleConfirm() {
    if (!member) return
    transfer(
      { user_id: member.user_id },
      { onSuccess: onClose },
    )
  }

  return (
    <Dialog open={!!member} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="sm:max-w-sm p-0 overflow-hidden gap-0"
        style={DIALOG_CONTENT_STYLE}
      >
        <DialogHeader className="px-6 pt-6 pb-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
            style={{ background: 'rgba(0,218,243,0.10)', border: '1px solid rgba(0,218,243,0.20)' }}
          >
            <ArrowLeftRight className="w-5 h-5" style={{ color: 'oklch(0.82 0.14 198)' }} />
          </div>
          <DialogTitle
            className="text-base font-bold"
            style={{ color: 'oklch(0.93 0.012 265)', fontFamily: 'var(--df-font-display)' }}
          >
            Transfer ownership to {member?.name}?
          </DialogTitle>
          <DialogDescription
            className="text-[13px] mt-1 leading-relaxed"
            style={{ color: 'rgba(255,255,255,0.38)' }}
          >
            They will become the new board owner. You will be downgraded to admin.
            This can be undone only if they transfer ownership back to you.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-5 flex gap-2">
          <button
            onClick={onClose}
            disabled={isPending}
            className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold focus:outline-none disabled:opacity-50"
            style={{
              border: '1px solid rgba(255,255,255,0.09)',
              color: 'rgba(255,255,255,0.50)',
              background: 'transparent',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isPending}
            className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold focus:outline-none disabled:opacity-50 flex items-center justify-center gap-1.5"
            style={{
              background: 'linear-gradient(135deg, oklch(0.82 0.14 198 / 0.22) 0%, oklch(0.55 0.12 198 / 0.30) 100%)',
              border: '1px solid oklch(0.82 0.14 198 / 0.30)',
              color: 'oklch(0.82 0.14 198)',
            }}
          >
            {isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Check className="w-3.5 h-3.5" />
            )}
            Transfer
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── AddMemberPanel ────────────────────────────────────────────────────────────

interface AddMemberPanelProps {
  boardId: string
  workspaceId: string
  currentBoardMemberIds: Set<string>
  myBoardRole: BoardRole | string
}

function AddMemberPanel({ boardId, workspaceId, currentBoardMemberIds, myBoardRole }: AddMemberPanelProps) {
  const perms = useBoardPermissions(myBoardRole)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedRole, setSelectedRole] = useState<'admin' | 'editor'>('editor')

  const { data: workspace } = useWorkspace(workspaceId)
  const { mutate: addMember, isPending } = useAddBoardMember(boardId)

  // Workspace members not yet on the board
  const eligibleMembers = useMemo(() =>
    (workspace?.members ?? []).filter((m) => !currentBoardMemberIds.has(m.user_id)),
    [workspace?.members, currentBoardMemberIds],
  )

  function handleAdd() {
    if (!selectedUserId) return
    addMember(
      { user_id: selectedUserId, role: selectedRole },
      {
        onSuccess: () => {
          setSelectedUserId('')
          setSelectedRole('editor')
        },
      },
    )
  }

  if (eligibleMembers.length === 0) {
    return (
      <p className="text-center text-[12px] py-3" style={{ color: 'rgba(255,255,255,0.30)' }}>
        All workspace members are already on this board.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {/* Member selector */}
      <Select value={selectedUserId} onValueChange={setSelectedUserId}>
        <SelectTrigger
          className="w-full text-[12px]"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.10)',
            color: selectedUserId ? 'rgba(255,255,255,0.80)' : 'rgba(255,255,255,0.30)',
            borderRadius: '0.75rem',
            height: '38px',
          }}
        >
          <SelectValue placeholder="Select a workspace member…" />
        </SelectTrigger>
        <SelectContent>
          {eligibleMembers.map((m) => (
            <SelectItem key={m.user_id} value={m.user_id}>
              <div className="flex items-center gap-2 text-[12px]">
                <span className="font-medium">{m.name}</span>
                <span className="text-outline text-[11px]">{m.email}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Role + Add button */}
      <div className="flex gap-2">
        <Select
          value={selectedRole}
          onValueChange={(v) => setSelectedRole(v as 'admin' | 'editor')}
        >
          <SelectTrigger
            className="w-32 text-[12px] shrink-0"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.10)',
              color: 'rgba(255,255,255,0.70)',
              borderRadius: '0.75rem',
              height: '38px',
            }}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {/* Admin option only visible to board owner */}
            {perms.canGrantAdmin && (
              <SelectItem value="admin">
                <div className="flex items-center gap-2 text-[12px]">
                  <ShieldCheck className="w-3 h-3" style={{ color: BOARD_ROLE_CONFIG.admin.color }} />
                  Admin
                </div>
              </SelectItem>
            )}
            <SelectItem value="editor">
              <div className="flex items-center gap-2 text-[12px]">
                <Pencil className="w-3 h-3" style={{ color: BOARD_ROLE_CONFIG.editor.color }} />
                Editor
              </div>
            </SelectItem>
          </SelectContent>
        </Select>

        <button
          onClick={handleAdd}
          disabled={!selectedUserId || isPending}
          className="flex-1 flex items-center justify-center gap-2 rounded-xl text-[13px] font-bold transition-all focus:outline-none disabled:opacity-40"
          style={{
            background: selectedUserId
              ? 'linear-gradient(135deg, oklch(0.82 0.14 198 / 0.18) 0%, oklch(0.42 0.09 198 / 0.12) 100%)'
              : 'rgba(255,255,255,0.04)',
            border: selectedUserId
              ? '1px solid oklch(0.82 0.14 198 / 0.28)'
              : '1px solid rgba(255,255,255,0.08)',
            color: selectedUserId ? 'oklch(0.82 0.14 198)' : 'rgba(255,255,255,0.25)',
            height: '38px',
          }}
        >
          {isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <UserPlus className="w-3.5 h-3.5" />
          )}
          Add to board
        </button>
      </div>
    </div>
  )
}

// ── BoardMembersDialog ────────────────────────────────────────────────────────

interface BoardMembersDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  boardId: string
  boardTitle: string
  workspaceId: string
  members: BoardMember[]
  myBoardRole: BoardRole | string
}

export function BoardMembersDialog({
  open,
  onOpenChange,
  boardId,
  boardTitle,
  workspaceId,
  members,
  myBoardRole,
}: BoardMembersDialogProps) {
  const perms = useBoardPermissions(myBoardRole)
  const currentUser = useAppSelector((s) => s.auth.user)
  const [transferTarget, setTransferTarget] = useState<BoardMember | null>(null)
  const [showAddPanel, setShowAddPanel] = useState(false)

  const currentBoardMemberIds = useMemo(
    () => new Set(members.map((m) => m.user_id)),
    [members],
  )

  // Sort: owner first, then admins, then editors
  const sortedMembers = useMemo(() =>
    [...members].sort((a, b) => {
      const order: Record<BoardRole, number> = { owner: 0, admin: 1, editor: 2 }
      return order[a.board_role] - order[b.board_role]
    }),
    [members],
  )

  const ownerCount = members.filter((m) => m.board_role === 'owner').length
  const adminCount = members.filter((m) => m.board_role === 'admin').length
  const editorCount = members.filter((m) => m.board_role === 'editor').length

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="sm:max-w-md p-0 overflow-hidden gap-0 flex flex-col"
          style={{ ...DIALOG_CONTENT_STYLE, maxHeight: '85vh' }}
        >
          {/* Header */}
          <DialogHeader className="px-6 pt-6 pb-0 shrink-0">
            <div className="flex items-center gap-3 mb-1">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(167,139,250,0.10)', border: '1px solid rgba(167,139,250,0.20)' }}
              >
                <Users className="w-4 h-4" style={{ color: 'oklch(0.80 0.12 280)' }} />
              </div>
              <div>
                <DialogTitle
                  className="text-[15px] font-bold tracking-tight leading-none"
                  style={{ color: 'oklch(0.93 0.012 265)' }}
                >
                  Board members
                </DialogTitle>
                <p className="text-[12px] mt-0.5 truncate max-w-[260px]" style={{ color: 'rgba(255,255,255,0.38)' }}>
                  {boardTitle}
                </p>
              </div>
            </div>
            <DialogDescription className="sr-only">
              Manage who has access to this board and their roles.
            </DialogDescription>
          </DialogHeader>

          {/* Stats row */}
          <div className="px-6 pt-4 pb-3 shrink-0 flex gap-2">
            {[
              { label: 'Owner', count: ownerCount, role: 'owner' as BoardRole },
              { label: 'Admins', count: adminCount, role: 'admin' as BoardRole },
              { label: 'Editors', count: editorCount, role: 'editor' as BoardRole },
            ].map(({ label, count, role }) => {
              const cfg = BOARD_ROLE_CONFIG[role]
              return (
                <div
                  key={role}
                  className="flex-1 rounded-xl px-3 py-2.5 text-center"
                  style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
                >
                  <p className="text-[18px] font-bold" style={{ color: cfg.color }}>{count}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: cfg.color, opacity: 0.7 }}>{label}</p>
                </div>
              )
            })}
          </div>

          <div className="h-px mx-6" style={{ background: 'rgba(255,255,255,0.06)' }} />

          {/* Member list — scrollable */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2 min-h-0">
            <AnimatePresence initial={false}>
              {sortedMembers.map((member) => (
                <MemberRow
                  key={member.user_id}
                  member={member}
                  boardId={boardId}
                  currentUserId={currentUser?.id}
                  myBoardRole={myBoardRole}
                  onTransferClick={setTransferTarget}
                />
              ))}
            </AnimatePresence>
          </div>

          {/* Add member panel — owner + admin only */}
          {perms.canManageMembers && (
            <div className="px-6 pb-5 pt-2 shrink-0">
              <div className="h-px mb-4" style={{ background: 'rgba(255,255,255,0.06)' }} />

              <button
                onClick={() => setShowAddPanel((p) => !p)}
                className="w-full flex items-center justify-between rounded-xl px-4 py-2.5 text-[13px] font-semibold transition-all focus:outline-none mb-2"
                style={{
                  background: showAddPanel ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: showAddPanel ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.45)',
                }}
              >
                <span className="flex items-center gap-2">
                  <UserPlus className="w-3.5 h-3.5" />
                  Add member
                </span>
                <motion.span
                  animate={{ rotate: showAddPanel ? 180 : 0 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </motion.span>
              </button>

              <AnimatePresence>
                {showAddPanel && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                  >
                    <AddMemberPanel
                      boardId={boardId}
                      workspaceId={workspaceId}
                      currentBoardMemberIds={currentBoardMemberIds}
                      myBoardRole={myBoardRole}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Transfer ownership confirm dialog */}
      <TransferConfirmDialog
        member={transferTarget}
        boardId={boardId}
        onClose={() => setTransferTarget(null)}
      />
    </>
  )
}