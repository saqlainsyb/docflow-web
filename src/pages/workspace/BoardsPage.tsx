// src/pages/workspace/BoardsPage.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Premium redesign — $500k/year caliber.
// Cinematic board gallery with:
//   • Framer Motion staggered entrance + spring physics
//   • Floating ambient orb backdrop
//   • Glassmorphic topbar with live depth
//   • Board cards with 3D lift + gradient shimmer on hover
//   • Micro-interaction on every interactive element
//   • Skeleton loaders with shimmer pulse
//   • List view with slide-in rows
//   • Empty state with animated illustration
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Search,
  Plus,
  LayoutGrid,
  List,
  Lock,
  Users,
  ArrowUpRight,
  Sparkles,
  ChevronRight,
  UserPlus,
  Layers,
} from 'lucide-react'
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
  useSpring,
  LayoutGroup,
} from 'framer-motion'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { openModal } from '@/store'
import { useWorkspace } from '@/hooks/useWorkspace'
import { useWorkspaceBoards } from '@/hooks/useWorkspaceBoards'
import type { BoardListItem, WorkspaceRole } from '@/lib/types'

// ── Types ─────────────────────────────────────────────────────────────────────

type ViewMode = 'grid' | 'list'

// ── Helpers ───────────────────────────────────────────────────────────────────

function canManageBoards(role: WorkspaceRole | undefined): boolean {
  return role === 'owner' || role === 'admin'
}

function formatUpdatedAt(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days = Math.floor(diff / 86_400_000)

  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days === 1) return '1d ago'
  return `${days}d ago`
}

// ── Motion variants ───────────────────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.1,
    },
  },
}

const cardVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.97 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 300, damping: 28 },
  },
  exit: { opacity: 0, y: -12, scale: 0.97, transition: { duration: 0.18 } },
} as const

const listRowVariants = {
  hidden: { opacity: 0, x: -16 },
  show: {
    opacity: 1,
    x: 0,
    transition: { type: 'spring', stiffness: 400, damping: 32 },
  },
  exit: { opacity: 0, x: 16, transition: { duration: 0.15 } },
} as const;

// ── Accent palette — deterministic per board ──────────────────────────────────

const BOARD_ACCENTS = [
  {
    orb: 'oklch(0.82 0.14 198)',
    glow: 'oklch(0.82 0.14 198 / 18%)',
    ring: 'oklch(0.82 0.14 198 / 25%)',
    badge: 'oklch(0.82 0.14 198 / 12%)',
    text: 'oklch(0.82 0.14 198)',
    bar: 'linear-gradient(90deg, oklch(0.82 0.14 198), oklch(0.42 0.09 198))',
  },
  {
    orb: 'oklch(0.80 0.12 280)',
    glow: 'oklch(0.80 0.12 280 / 18%)',
    ring: 'oklch(0.80 0.12 280 / 25%)',
    badge: 'oklch(0.80 0.12 280 / 12%)',
    text: 'oklch(0.80 0.12 280)',
    bar: 'linear-gradient(90deg, oklch(0.80 0.12 280), oklch(0.38 0.16 285))',
  },
  {
    orb: 'oklch(0.79 0.16 160)',
    glow: 'oklch(0.79 0.16 160 / 18%)',
    ring: 'oklch(0.79 0.16 160 / 25%)',
    badge: 'oklch(0.79 0.16 160 / 12%)',
    text: 'oklch(0.79 0.16 160)',
    bar: 'linear-gradient(90deg, oklch(0.79 0.16 160), oklch(0.42 0.18 160))',
  },
  {
    orb: 'oklch(0.80 0.18 55)',
    glow: 'oklch(0.80 0.18 55 / 18%)',
    ring: 'oklch(0.80 0.18 55 / 25%)',
    badge: 'oklch(0.80 0.18 55 / 12%)',
    text: 'oklch(0.80 0.18 55)',
    bar: 'linear-gradient(90deg, oklch(0.80 0.18 55), oklch(0.55 0.19 55))',
  },
  {
    orb: 'oklch(0.75 0.20 25)',
    glow: 'oklch(0.75 0.20 25 / 18%)',
    ring: 'oklch(0.75 0.20 25 / 25%)',
    badge: 'oklch(0.75 0.20 25 / 12%)',
    text: 'oklch(0.75 0.20 25)',
    bar: 'linear-gradient(90deg, oklch(0.75 0.20 25), oklch(0.50 0.22 25))',
  },
]

function accentForId(id: string) {
  const idx = (id.charCodeAt(0) + id.charCodeAt(id.length - 1)) % BOARD_ACCENTS.length
  return BOARD_ACCENTS[idx]
}

// ── SkeletonCard ──────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rounded-2xl p-6 overflow-hidden relative" style={{ background: 'oklch(0.18 0.015 265)', border: '1px solid oklch(0.35 0.015 265 / 10%)' }}>
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.8s_infinite]"
        style={{ background: 'linear-gradient(90deg, transparent 0%, oklch(0.91 0.015 265 / 4%) 50%, transparent 100%)' }} />
      <div className="w-11 h-11 rounded-xl mb-5" style={{ background: 'oklch(0.21 0.015 265)' }} />
      <div className="h-5 w-3/4 rounded-lg mb-2.5" style={{ background: 'oklch(0.21 0.015 265)' }} />
      <div className="h-3 w-1/2 rounded-lg mb-8" style={{ background: 'oklch(0.21 0.015 265)' }} />
      <div className="h-px w-full mb-4" style={{ background: 'oklch(0.21 0.015 265)' }} />
      <div className="flex justify-between">
        <div className="h-3 w-1/3 rounded-lg" style={{ background: 'oklch(0.21 0.015 265)' }} />
        <div className="h-3 w-6 rounded-lg" style={{ background: 'oklch(0.21 0.015 265)' }} />
      </div>
    </div>
  )
}

// ── BoardsTopbar ──────────────────────────────────────────────────────────────

interface BoardsTopbarProps {
  workspaceName: string
  boardCount: number
  canManage: boolean
  search: string
  onSearchChange: (v: string) => void
  onInvite: () => void
  onCreateBoard: () => void
}

function BoardsTopbar({
  workspaceName,
  boardCount,
  canManage,
  search,
  onSearchChange,
  onInvite,
  onCreateBoard,
}: BoardsTopbarProps) {
  const [searchFocused, setSearchFocused] = useState(false)

  return (
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="h-[60px] flex items-center justify-between px-6 sticky top-0 z-30"
      style={{
        background: 'oklch(0.12 0.015 265 / 80%)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderBottom: '1px solid oklch(0.35 0.015 265 / 10%)',
      }}
    >
      {/* Left — breadcrumb */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-display font-semibold text-sm text-on-surface-variant truncate max-w-40">
          {workspaceName}
        </span>
        <ChevronRight className="w-3.5 h-3.5 text-outline/40 shrink-0" />
        <span className="font-display font-bold text-sm text-on-surface whitespace-nowrap">
          Boards
        </span>
        {boardCount > 0 && (
          <motion.span
            key={boardCount}
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="ml-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold tabular-nums"
            style={{ background: 'oklch(0.82 0.14 198 / 12%)', color: 'oklch(0.82 0.14 198)' }}
          >
            {boardCount}
          </motion.span>
        )}
      </div>

      {/* Center — search */}
      <div className="flex-1 max-w-sm mx-6">
        <motion.div
          animate={searchFocused ? { scale: 1.015 } : { scale: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="relative"
        >
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none transition-colors duration-200"
            style={{ color: searchFocused ? 'oklch(0.82 0.14 198)' : 'oklch(0.56 0.012 265)' }}
            aria-hidden="true"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Search boards…"
            className="w-full pl-9 pr-4 py-2 text-sm rounded-xl bg-surface-container-lowest text-on-surface placeholder:text-outline/40 outline-none transition-all duration-200"
            style={{
              border: searchFocused
                ? '1px solid oklch(0.82 0.14 198 / 40%)'
                : '1px solid oklch(0.35 0.015 265 / 12%)',
              boxShadow: searchFocused
                ? '0 0 0 3px oklch(0.82 0.14 198 / 8%), 0 2px 8px oklch(0 0 0 / 20%)'
                : 'none',
            }}
          />
        </motion.div>
      </div>

      {/* Right — actions */}
      <div className="flex items-center gap-2.5 shrink-0">
        {canManage && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={onInvite}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-on-surface-variant transition-colors duration-150 focus:outline-none"
            style={{
              background: 'oklch(0.21 0.015 265)',
              border: '1px solid oklch(0.35 0.015 265 / 15%)',
            }}
          >
            <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
            Invite
          </motion.button>
        )}

        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.96 }}
          onClick={onCreateBoard}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-primary-foreground focus:outline-none df-gradient-cta"
          style={{ boxShadow: '0 2px 16px oklch(0.82 0.14 198 / 22%)' }}
        >
          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
          New Board
        </motion.button>
      </div>
    </motion.header>
  )
}

// ── BoardCard (Grid) ──────────────────────────────────────────────────────────

interface BoardCardProps {
  board: BoardListItem
  onClick: () => void
  index: number
}

function BoardCard({ board, onClick, index: _index }: BoardCardProps) {
  const accent = accentForId(board.id)
  const ref = useRef<HTMLElement>(null)

  const glowX = useMotionValue(50)
  const glowY = useMotionValue(50)
  const glowOpacity = useSpring(0, { stiffness: 200, damping: 30 })

  function handleMouseMove(e: React.MouseEvent<HTMLElement>) {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return

    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100

    glowX.set(x)
    glowY.set(y)
    glowOpacity.set(0.5)
  }

  function handleMouseLeave() {
    glowOpacity.set(0)
  }

  return (
    <motion.div variants={cardVariants} layout>
      <motion.article
        ref={ref}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onClick()
        }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        role="button"
        tabIndex={0}
        aria-label={`Open board: ${board.title}`}
        style={{
          background: 'oklch(0.18 0.015 265)',
          border: '1px solid oklch(0.35 0.015 265 / 10%)',
        }}
        whileHover={{
          y: -4,
          scale: 1.015,
          boxShadow: `0 20px 48px oklch(0 0 0 / 35%), 0 0 0 1px ${accent.ring}`,
        }}
        whileTap={{ scale: 0.985 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
        className="relative flex flex-col rounded-2xl p-6 cursor-pointer focus:outline-none overflow-hidden"
      >
        {/* Accent top bar */}
        <div
          className="absolute top-0 left-0 right-0 h-[2px] opacity-70"
          style={{ background: accent.bar }}
        />

        {/* Dynamic radial glow */}
        <motion.div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{
            background: useTransform(
              [glowX, glowY],
              ([x, y]) =>
                `radial-gradient(circle at ${x}% ${y}%, ${accent.glow} 0%, transparent 60%)`
            ),
            opacity: glowOpacity,
          }}
        />

        {/* Icon + visibility */}
        <div className="flex items-start justify-between mb-5">
          <motion.div
            whileHover={{ scale: 1.08, rotate: 3 }}
            transition={{ type: 'spring', stiffness: 320, damping: 18 }}
            className="w-11 h-11 rounded-xl flex items-center justify-center"
            style={{
              background: accent.badge,
              border: `1px solid ${accent.ring}`,
              boxShadow: `0 4px 16px ${accent.glow}`,
            }}
          >
            <Layers
              className="w-5 h-5"
              style={{ color: accent.text }}
              aria-hidden="true"
            />
          </motion.div>

          {board.visibility === 'private' ? (
            <span
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest text-outline"
              style={{
                background: 'oklch(0.21 0.015 265)',
                border: '1px solid oklch(0.35 0.015 265 / 20%)',
              }}
            >
              <Lock className="w-2 h-2" />
              Private
            </span>
          ) : (
            <span
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest"
              style={{
                background: accent.badge,
                color: accent.text,
                border: `1px solid ${accent.ring}`,
              }}
            >
              <Users className="w-2 h-2" />
              Workspace
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="font-display font-bold text-[17px] leading-snug text-on-surface mb-1.5 line-clamp-2">
          {board.title}
        </h3>

        {/* Timestamp */}
        <p className="text-xs text-outline mb-6">
          Updated {formatUpdatedAt(board.updated_at)}
        </p>

        {/* Footer */}
        <div
          className="flex items-center justify-between pt-4 mt-auto"
          style={{
            borderTop: '1px solid oklch(0.35 0.015 265 / 12%)',
          }}
        >
          <div className="flex items-center gap-3 text-xs text-outline">
            <span className="flex items-center gap-1.5">
              <Users className="w-3 h-3" />
              {board.member_count}
            </span>
            {board.card_count > 0 && (
              <>
                <span className="text-outline/25">·</span>
                <span>
                  {board.card_count} card
                  {board.card_count !== 1 ? 's' : ''}
                </span>
              </>
            )}
          </div>

          <motion.div
            whileHover={{ x: 2, y: -2 }}
            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
          >
            <ArrowUpRight
              className="w-4 h-4"
              style={{ color: accent.text }}
            />
          </motion.div>
        </div>
      </motion.article>
    </motion.div>
  )
}

// ── BoardListRow ──────────────────────────────────────────────────────────────

function BoardListRow({ board, onClick, index: _index }: BoardCardProps) {
  const accent = accentForId(board.id)

  return (
    <motion.article
      variants={listRowVariants}
      layout
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick() }}
      role="button"
      tabIndex={0}
      aria-label={`Open board: ${board.title}`}
      whileHover={{ x: 5, boxShadow: `0 4px 24px oklch(0 0 0 / 25%), 0 0 0 1px ${accent.ring}` }}
      whileTap={{ scale: 0.99 }}
      transition={{ type: 'spring', stiffness: 400, damping: 32 }}
      className="group flex items-center gap-4 px-5 py-4 rounded-xl cursor-pointer focus:outline-none"
      style={{ background: 'oklch(0.18 0.015 265)', border: '1px solid oklch(0.35 0.015 265 / 8%)' }}
    >
      {/* Accent bar */}
      <div className="w-0.5 h-10 rounded-full shrink-0" style={{ background: accent.bar }} />

      {/* Icon */}
      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: accent.badge }}>
        <Layers className="w-4 h-4" style={{ color: accent.text }} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h3 className="font-display font-bold text-sm text-on-surface truncate mb-0.5">
          {board.title}
        </h3>
        <p className="text-xs text-outline">
          Updated {formatUpdatedAt(board.updated_at)}
          <span className="mx-1.5 text-outline/25">·</span>
          {board.member_count} member{board.member_count !== 1 ? 's' : ''}
          {board.card_count > 0 && (
            <><span className="mx-1.5 text-outline/25">·</span>{board.card_count} card{board.card_count !== 1 ? 's' : ''}</>
          )}
        </p>
      </div>

      {/* Visibility badge */}
      {board.visibility === 'private' ? (
        <span className="flex items-center gap-1 text-[10px] font-semibold text-outline px-2 py-1 rounded-lg bg-surface-container-highest">
          <Lock className="w-2.5 h-2.5" /> Private
        </span>
      ) : (
        <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg"
          style={{ background: accent.badge, color: accent.text }}>
          <Users className="w-2.5 h-2.5" /> Workspace
        </span>
      )}

      <motion.div
        className="opacity-0 group-hover:opacity-100 transition-opacity duration-150"
        whileHover={{ x: 2, y: -2 }}
      >
        <ArrowUpRight className="w-4 h-4" style={{ color: accent.text }} />
      </motion.div>
    </motion.article>
  )
}

// ── CreateBoardCard ───────────────────────────────────────────────────────────

function CreateBoardCard({ onClick, viewMode }: { onClick: () => void; viewMode: ViewMode }) {
  if (viewMode === 'list') {
    return (
      <motion.button
        variants={listRowVariants}
        layout
        onClick={onClick}
        whileHover={{ x: 5 }}
        whileTap={{ scale: 0.99 }}
        className="group flex items-center gap-4 px-5 py-4 rounded-xl cursor-pointer focus:outline-none w-full text-left"
        style={{ background: 'transparent', border: '1.5px dashed oklch(0.35 0.015 265 / 18%)' }}
        aria-label="Create new board"
      >
        <div className="w-0.5 h-10" />
        <motion.div
          whileHover={{ rotate: 90 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: 'oklch(0.21 0.015 265)' }}
        >
          <Plus className="w-4 h-4 text-outline group-hover:text-primary transition-colors" />
        </motion.div>
        <span className="font-display font-bold text-sm text-outline group-hover:text-on-surface transition-colors duration-150">
          Create new board
        </span>
      </motion.button>
    )
  }

  return (
    <motion.button
      variants={cardVariants}
      layout
      onClick={onClick}
      whileHover={{
        boxShadow: '0 0 0 1.5px oklch(0.82 0.14 198 / 30%), 0 8px 32px oklch(0.82 0.14 198 / 10%)',
        borderColor: 'oklch(0.82 0.14 198 / 35%)',
        y: -3,
      }}
      whileTap={{ scale: 0.985 }}
      className="group relative flex flex-col items-center justify-center gap-4 rounded-2xl p-6 focus:outline-none min-h-[188px] transition-colors duration-200"
      style={{
        background: 'oklch(0.15 0.015 265)',
        border: '1.5px dashed oklch(0.35 0.015 265 / 18%)',
      }}
      aria-label="Create new board"
    >
      <motion.div
        whileHover={{ rotate: 90, scale: 1.1 }}
        transition={{ type: 'spring', stiffness: 280, damping: 18 }}
        className="w-12 h-12 rounded-full flex items-center justify-center"
        style={{ background: 'oklch(0.21 0.015 265)', border: '1px solid oklch(0.35 0.015 265 / 15%)' }}
      >
        <Plus className="w-5 h-5 text-outline group-hover:text-primary transition-colors duration-200" />
      </motion.div>
      <p className="font-display font-bold text-sm text-outline group-hover:text-on-surface transition-colors duration-200">
        New Board
      </p>
    </motion.button>
  )
}

// ── EmptyBoards ───────────────────────────────────────────────────────────────

function EmptyBoards({ onCreateBoard }: { onCreateBoard: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col items-center justify-center py-32 gap-7"
    >
      {/* Animated orb */}
      <div className="relative w-24 h-24">
        <motion.div
          animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute inset-0 rounded-full"
          style={{ background: 'oklch(0.82 0.14 198 / 15%)', filter: 'blur(14px)' }}
        />
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 22, repeat: Infinity, ease: 'linear' }}
          className="absolute inset-2 rounded-full"
          style={{
            background: 'conic-gradient(from 0deg, oklch(0.82 0.14 198 / 0%) 0%, oklch(0.82 0.14 198 / 35%) 50%, oklch(0.82 0.14 198 / 0%) 100%)',
          }}
        />
        <div
          className="absolute inset-4 rounded-full flex items-center justify-center"
          style={{
            background: 'oklch(0.18 0.015 265)',
            border: '1px solid oklch(0.82 0.14 198 / 20%)',
            boxShadow: '0 0 24px oklch(0.82 0.14 198 / 12%)',
          }}
        >
          <Layers className="w-7 h-7 text-primary" />
        </div>
      </div>

      <div className="text-center space-y-2">
        <h3 className="font-display font-bold text-2xl text-on-surface tracking-tight">
          No boards yet
        </h3>
        <p className="text-sm text-outline max-w-xs leading-relaxed">
          Boards are where your work takes shape. Create your first one to get started.
        </p>
      </div>

      <motion.button
        whileHover={{ scale: 1.04, boxShadow: '0 4px 32px oklch(0.82 0.14 198 / 30%)' }}
        whileTap={{ scale: 0.97 }}
        onClick={onCreateBoard}
        className="df-gradient-cta flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-primary-foreground focus:outline-none"
      >
        <Sparkles className="w-4 h-4" />
        Create your first board
      </motion.button>
    </motion.div>
  )
}

// ── BoardsGrid ────────────────────────────────────────────────────────────────

interface BoardsGridProps {
  boards: BoardListItem[]
  viewMode: ViewMode
  onCreateBoard: () => void
  onBoardClick: (boardId: string) => void
}

function BoardsGrid({ boards, viewMode, onCreateBoard, onBoardClick }: BoardsGridProps) {
  if (boards.length === 0) {
    return <EmptyBoards onCreateBoard={onCreateBoard} />
  }

  if (viewMode === 'list') {
    return (
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="flex flex-col gap-2"
      >
        <AnimatePresence mode="popLayout">
          {boards.map((board, i) => (
            <BoardListRow key={board.id} board={board} index={i} onClick={() => onBoardClick(board.id)} />
          ))}
          <CreateBoardCard key="create" onClick={onCreateBoard} viewMode={viewMode} />
        </AnimatePresence>
      </motion.div>
    )
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
    >
      <AnimatePresence mode="popLayout">
        {boards.map((board, i) => (
          <BoardCard key={board.id} board={board} index={i} onClick={() => onBoardClick(board.id)} />
        ))}
        <CreateBoardCard key="create" onClick={onCreateBoard} viewMode={viewMode} />
      </AnimatePresence>
    </motion.div>
  )
}

// ── PageHero ──────────────────────────────────────────────────────────────────

interface PageHeroProps {
  workspaceName: string
  viewMode: ViewMode
  onViewModeChange: (m: ViewMode) => void
}

function PageHero({ workspaceName, viewMode, onViewModeChange }: PageHeroProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
      className="flex items-end justify-between mb-8"
    >
      <div>
        <motion.p
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.12, duration: 0.35 }}
          className="df-label-editorial text-primary mb-2"
        >
          {workspaceName} · Boards
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="font-display text-[2rem] font-bold tracking-tight text-on-surface leading-none"
        >
          My Boards
        </motion.h1>
      </div>

      {/* View toggle */}
      <motion.div
        initial={{ opacity: 0, scale: 0.88 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.22, duration: 0.3 }}
        className="flex p-1 rounded-xl gap-0.5"
        style={{
          background: 'oklch(0.16 0.015 265)',
          border: '1px solid oklch(0.35 0.015 265 / 12%)',
        }}
        role="group"
        aria-label="Board view mode"
      >
        {([
          { mode: 'grid' as ViewMode, Icon: LayoutGrid, label: 'Grid view' },
          { mode: 'list' as ViewMode, Icon: List, label: 'List view' },
        ]).map(({ mode, Icon, label }) => (
          <div key={mode} className="relative">
            <motion.button
              onClick={() => onViewModeChange(mode)}
              aria-label={label}
              aria-pressed={viewMode === mode}
              className="relative p-2 rounded-lg focus:outline-none z-10"
              whileTap={{ scale: 0.88 }}
            >
              {viewMode === mode && (
                <motion.span
                  layoutId="view-pill"
                  className="absolute inset-0 rounded-lg z-0"
                  style={{
                    background: 'oklch(0.27 0.015 265)',
                    boxShadow: '0 1px 4px oklch(0 0 0 / 30%)',
                  }}
                  transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                />
              )}
              <Icon
                className="relative w-4 h-4 transition-colors duration-150 z-10"
                style={{ color: viewMode === mode ? 'oklch(0.82 0.14 198)' : 'oklch(0.56 0.012 265)' }}
                aria-hidden="true"
              />
            </motion.button>
          </div>
        ))}
      </motion.div>
    </motion.div>
  )
}

// ── AmbientOrbs ───────────────────────────────────────────────────────────────

function AmbientOrbs() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
      <motion.div
        animate={{ y: [0, -24, 0], x: [0, 16, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full"
        style={{ background: 'radial-gradient(circle, oklch(0.82 0.14 198 / 5%) 0%, transparent 65%)', filter: 'blur(1px)' }}
      />
      <motion.div
        animate={{ y: [0, 20, 0], x: [0, -12, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut', delay: 4 }}
        className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full"
        style={{ background: 'radial-gradient(circle, oklch(0.80 0.12 280 / 4%) 0%, transparent 65%)', filter: 'blur(1px)' }}
      />
    </div>
  )
}

// ── SkeletonLoader ────────────────────────────────────────────────────────────

function SkeletonLoader() {
  return (
    <div className="flex flex-col min-h-screen">
      <div
        className="h-[60px] flex items-center px-6"
        style={{
          background: 'oklch(0.12 0.015 265 / 80%)',
          borderBottom: '1px solid oklch(0.35 0.015 265 / 10%)',
        }}
      >
        <div className="h-4 w-32 rounded-lg animate-pulse" style={{ background: 'oklch(0.21 0.015 265)' }} />
        <div className="flex-1 mx-6">
          <div className="h-8 w-full max-w-sm rounded-xl animate-pulse" style={{ background: 'oklch(0.21 0.015 265)' }} />
        </div>
        <div className="flex gap-2.5">
          <div className="h-8 w-16 rounded-xl animate-pulse" style={{ background: 'oklch(0.21 0.015 265)' }} />
          <div className="h-8 w-24 rounded-xl animate-pulse" style={{ background: 'oklch(0.27 0.015 265)' }} />
        </div>
      </div>
      <div className="flex-1 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <div className="h-3 w-36 rounded-full animate-pulse mb-3" style={{ background: 'oklch(0.21 0.015 265)' }} />
            <div className="h-9 w-44 rounded-xl animate-pulse" style={{ background: 'oklch(0.21 0.015 265)' }} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── BoardsPage ────────────────────────────────────────────────────────────────

export function BoardsPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const user = useAppSelector((state) => state.auth.user)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [search, setSearch] = useState('')

  const { data: workspace, isLoading: isWorkspaceLoading } = useWorkspace(workspaceId)
  const { data: boards = [], isLoading: isBoardsLoading } = useWorkspaceBoards(workspaceId)

  const currentMember = workspace?.members.find((m) => m.user_id === user?.id)
  const canManage = canManageBoards(currentMember?.role)

  const filteredBoards = search.trim()
    ? boards.filter((b) =>
        b.title.toLowerCase().includes(search.trim().toLowerCase()),
      )
    : boards

  function handleCreateBoard() {
    if (!workspaceId) return
    dispatch(openModal({ type: 'createBoard', workspaceId }))
  }

  function handleBoardClick(boardId: string) {
    navigate(`/${workspaceId}/boards/${boardId}`)
  }

  function handleInvite() {
    navigate('members')
  }

  if (isWorkspaceLoading || isBoardsLoading) {
    return <SkeletonLoader />
  }

  return (
    <div className="flex flex-col min-h-screen relative">
      <AmbientOrbs />

      <BoardsTopbar
        workspaceName={workspace?.name ?? ''}
        boardCount={filteredBoards.length}
        canManage={canManage}
        search={search}
        onSearchChange={setSearch}
        onInvite={handleInvite}
        onCreateBoard={handleCreateBoard}
      />

      <div className="flex-1 p-8 relative">
        <div className="max-w-7xl mx-auto">

          <PageHero
            workspaceName={workspace?.name ?? ''}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          />

          {/* Search context label */}
          <AnimatePresence>
            {search.trim() && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="text-xs text-outline mb-5"
              >
                {filteredBoards.length > 0
                  ? `${filteredBoards.length} result${filteredBoards.length !== 1 ? 's' : ''} for "${search}"`
                  : `No boards match "${search}"`}
              </motion.p>
            )}
          </AnimatePresence>

          {/* Grid / List with view-switch animation */}
          <AnimatePresence mode="wait">
            <motion.div
              key={viewMode}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.14 }}
            >
              <BoardsGrid
                boards={filteredBoards}
                viewMode={viewMode}
                onCreateBoard={handleCreateBoard}
                onBoardClick={handleBoardClick}
              />
            </motion.div>
          </AnimatePresence>

        </div>
      </div>
    </div>
  )
}