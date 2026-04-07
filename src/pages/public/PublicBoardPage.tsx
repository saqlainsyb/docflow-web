// src/pages/public/PublicBoardPage.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Read-only board view for /share/:token — no authentication required.
//
// What this page does:
//   1. Reads the share token from the URL param
//   2. Fetches GET /api/v1/share/:token — returns BoardDetailResponse with
//      is_public_view: true
//   3. Renders the full board (columns + cards) in a read-only layout that
//      mirrors the authenticated BoardPage aesthetic exactly
//   4. All interactive elements (add card, add column, drag, context menus)
//      are absent — this is a pure display
//   5. A "view-only" banner in the topbar makes it clear to visitors
//
// Design: matches the rest of the app's "Obsidian Studio" dark aesthetic.
// ─────────────────────────────────────────────────────────────────────────────

import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { motion, AnimatePresence } from 'motion/react'
import {
  Eye,
  Globe,
  Lock,
  LayoutGrid,
  Sparkles,
  Users,
  Loader2,
  LinkIcon,
  FileText,
  User,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getInitials } from '@/lib/utils'
import type { BoardDetailResponse, CardResponse, ColumnWithCards } from '@/lib/types'

// ── Data fetching ─────────────────────────────────────────────────────────────

function usePublicBoard(token: string | undefined) {
  return useQuery<BoardDetailResponse>({
    queryKey: ['public-board', token],
    queryFn: () =>
      axios
        .get<BoardDetailResponse>(`/api/v1/share/${token}`)
        .then((r) => r.data),
    enabled: Boolean(token),
    retry: (failureCount, error: unknown) => {
      const status = (error as { response?: { status?: number } })?.response?.status
      if (status === 404) return false
      return failureCount < 2
    },
  })
}

// ── Design tokens ─────────────────────────────────────────────────────────────

const COLUMN_ACCENT_COLORS = [
  { dot: '#00DAF3', glow: 'rgba(0,218,243,0.18)' },
  { dot: '#A78BFA', glow: 'rgba(167,139,250,0.18)' },
  { dot: '#34D399', glow: 'rgba(52,211,153,0.18)' },
  { dot: '#FB923C', glow: 'rgba(251,146,60,0.18)' },
  { dot: '#60A5FA', glow: 'rgba(96,165,250,0.18)' },
  { dot: '#F472B6', glow: 'rgba(244,114,182,0.18)' },
]

const COLOR_MAP: Record<string, { bar: string; glow: string; border: string }> = {
  '#EF4444': { bar: '#EF4444', glow: 'rgba(239,68,68,0.16)', border: 'rgba(239,68,68,0.32)' },
  '#F97316': { bar: '#F97316', glow: 'rgba(249,115,22,0.16)', border: 'rgba(249,115,22,0.32)' },
  '#EAB308': { bar: '#EAB308', glow: 'rgba(234,179,8,0.16)', border: 'rgba(234,179,8,0.32)' },
  '#22C55E': { bar: '#22C55E', glow: 'rgba(34,197,94,0.16)', border: 'rgba(34,197,94,0.32)' },
  '#3B82F6': { bar: '#3B82F6', glow: 'rgba(59,130,246,0.16)', border: 'rgba(59,130,246,0.32)' },
  '#A855F7': { bar: '#A855F7', glow: 'rgba(168,85,247,0.16)', border: 'rgba(168,85,247,0.32)' },
}

// ── PublicCard ────────────────────────────────────────────────────────────────
// Stripped-down card — no drag handles, no context menu, no click-to-open.

function PublicCard({ card }: { card: CardResponse }) {
  const colorEntry = card.color ? COLOR_MAP[card.color] : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="relative rounded-xl overflow-hidden select-none"
      style={{
        background: colorEntry
          ? `linear-gradient(160deg, ${colorEntry.glow} 0%, oklch(0.175 0.018 265) 60%)`
          : 'oklch(0.175 0.018 265)',
        border: colorEntry
          ? `1px solid ${colorEntry.border}`
          : '1px solid rgba(255,255,255,0.07)',
        boxShadow: colorEntry
          ? `0 4px 16px ${colorEntry.glow}`
          : '0 2px 8px rgba(0,0,0,0.28)',
      }}
    >
      {/* Color accent bar */}
      {colorEntry && (
        <div
          className="absolute top-0 left-0 right-0 h-[3px]"
          style={{ background: colorEntry.bar, opacity: 0.85 }}
        />
      )}

      <div className={cn('px-3 pb-3', colorEntry ? 'pt-3.5' : 'pt-3')}>
        {/* Title */}
        <p
          className="text-[13px] font-semibold leading-snug"
          style={{ color: 'oklch(0.91 0.015 265)' }}
        >
          {card.title}
        </p>

        {/* Footer: assignee + doc indicator */}
        {(card.assignee || card.document_id) && (
          <div className="flex items-center justify-between mt-2.5 gap-2">
            {card.assignee ? (
              <div className="flex items-center gap-1.5 min-w-0">
                {card.assignee.avatar_url ? (
                  <img
                    src={card.assignee.avatar_url}
                    alt={card.assignee.name}
                    className="w-4 h-4 rounded-full object-cover shrink-0"
                    style={{ border: '1px solid rgba(255,255,255,0.12)' }}
                  />
                ) : (
                  <div
                    className="w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-bold shrink-0"
                    style={{
                      background: 'oklch(0.38 0.16 285)',
                      color: 'oklch(0.88 0.08 285)',
                    }}
                  >
                    {getInitials(card.assignee.name)}
                  </div>
                )}
                <span
                  className="text-[11px] truncate"
                  style={{ color: 'rgba(255,255,255,0.42)' }}
                >
                  {card.assignee.name}
                </span>
              </div>
            ) : (
              <div />
            )}

            {card.document_id && (
              <div
                className="flex items-center gap-1 shrink-0"
                title="Has document"
              >
                <FileText
                  className="w-3 h-3"
                  style={{ color: 'rgba(255,255,255,0.22)' }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ── PublicColumn ──────────────────────────────────────────────────────────────

interface PublicColumnProps {
  column: ColumnWithCards
  index: number
}

function PublicColumn({ column, index }: PublicColumnProps) {
  const accent = COLUMN_ACCENT_COLORS[index % COLUMN_ACCENT_COLORS.length]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.38,
        delay: index * 0.06,
        ease: [0.22, 1, 0.36, 1],
      }}
      className="shrink-0 w-72 flex flex-col rounded-2xl"
      style={{
        background: 'linear-gradient(180deg, oklch(0.165 0.017 265) 0%, oklch(0.152 0.015 265) 100%)',
        border: '1px solid rgba(255,255,255,0.065)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.32)',
        maxHeight: 'calc(100vh - 6rem)',
      }}
    >
      {/* Column header */}
      <div
        className="flex items-center gap-2.5 px-3.5 py-3 shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.055)' }}
      >
        <div
          className="w-2 h-2 rounded-full shrink-0"
          style={{
            background: accent.dot,
            boxShadow: `0 0 6px ${accent.glow}`,
          }}
        />
        <h3
          className="text-[13px] font-bold truncate flex-1"
          style={{ color: 'oklch(0.88 0.015 265)' }}
        >
          {column.title}
        </h3>
        <span
          className="text-[11px] font-bold px-1.5 py-0.5 rounded-md shrink-0"
          style={{
            background: 'rgba(255,255,255,0.06)',
            color: 'rgba(255,255,255,0.35)',
          }}
        >
          {column.cards.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-2 p-2.5 overflow-y-auto flex-1">
        <AnimatePresence initial={false}>
          {column.cards.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center justify-center py-8 rounded-xl"
              style={{
                border: '1.5px dashed rgba(255,255,255,0.07)',
                color: 'rgba(255,255,255,0.18)',
              }}
            >
              <p className="text-[11px] font-medium">No cards</p>
            </motion.div>
          ) : (
            column.cards.map((card) => (
              <PublicCard key={card.id} card={card} />
            ))
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

// ── PublicTopbar ──────────────────────────────────────────────────────────────

function PublicTopbar({ board }: { board: BoardDetailResponse }) {
  const isPublic = board.visibility === 'workspace'
  const visibleMembers = board.members.slice(0, 4)
  const overflowCount = board.members.length - visibleMembers.length
  const totalCards = board.columns.reduce((acc, col) => acc + col.cards.length, 0)

  return (
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="h-16 flex items-center justify-between px-5 shrink-0 relative z-40"
      style={{
        background: 'oklch(0.13 0.015 265 / 0.92)',
        backdropFilter: 'blur(24px) saturate(180%)',
        borderBottom: '1px solid rgba(255,255,255,0.055)',
        boxShadow: '0 1px 0 rgba(0,218,243,0.06)',
      }}
    >
      {/* Left: Docflow wordmark + board identity */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Docflow logo mark */}
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 font-black text-[13px]"
          style={{
            background: 'linear-gradient(135deg, oklch(0.82 0.14 198) 0%, oklch(0.55 0.18 265) 100%)',
            color: 'white',
            letterSpacing: '-0.04em',
          }}
        >
          D
        </div>

        <div className="w-px h-6 bg-white/8 shrink-0" />

        {/* Board identity */}
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <h1
              className="font-bold text-[15px] tracking-tight truncate"
              style={{
                color: 'oklch(0.93 0.012 265)',
                fontFamily: 'var(--df-font-display)',
              }}
            >
              {board.title}
            </h1>

            {/* Visibility pill */}
            <span
              className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
              style={{
                background: isPublic ? 'rgba(52,211,153,0.10)' : 'rgba(255,255,255,0.06)',
                border: isPublic ? '1px solid rgba(52,211,153,0.20)' : '1px solid rgba(255,255,255,0.08)',
                color: isPublic ? '#34D399' : 'rgba(255,255,255,0.4)',
              }}
            >
              {isPublic ? <Globe className="w-2.5 h-2.5" /> : <Lock className="w-2.5 h-2.5" />}
              {board.visibility}
            </span>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-3 mt-0.5">
            <span
              className="text-[11px] flex items-center gap-1"
              style={{ color: 'rgba(255,255,255,0.35)' }}
            >
              <LayoutGrid className="w-2.75 h-2.75" />
              {board.columns.length} columns
            </span>
            <span
              className="text-[11px] flex items-center gap-1"
              style={{ color: 'rgba(255,255,255,0.35)' }}
            >
              <Sparkles className="w-2.75 h-2.75" />
              {totalCards} cards
            </span>
          </div>
        </div>
      </div>

      {/* Right: members + view-only badge */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Member stack */}
        {visibleMembers.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2.5">
              {visibleMembers.map((member, i) => (
                <motion.div
                  key={member.user_id}
                  initial={{ opacity: 0, scale: 0.7, x: 8 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  transition={{ delay: i * 0.06, type: 'spring', stiffness: 400, damping: 22 }}
                  title={`${member.name} · ${(member as any).role}`}
                  className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-[9px] font-bold select-none cursor-default"
                  style={{
                    background: 'oklch(0.38 0.16 285)',
                    color: 'oklch(0.88 0.08 285)',
                    border: '2px solid oklch(0.13 0.015 265)',
                    boxShadow: '0 0 0 1px rgba(255,255,255,0.06)',
                  }}
                >
                  {member.avatar_url ? (
                    <img
                      src={member.avatar_url}
                      alt={member.name}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    getInitials(member.name)
                  )}
                </motion.div>
              ))}
            </div>

            {overflowCount > 0 && (
              <span
                className="text-[11px] font-bold"
                style={{ color: 'rgba(255,255,255,0.35)' }}
              >
                +{overflowCount}
              </span>
            )}

            <span
              className="flex items-center gap-1 text-[11px]"
              style={{ color: 'rgba(255,255,255,0.28)' }}
            >
              <Users className="w-2.75 h-2.75" />
              {board.members.length}
            </span>
          </div>
        )}

        <div className="w-px h-5 bg-white/8" />

        {/* View-only badge */}
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-bold"
          style={{
            background: 'rgba(0,218,243,0.08)',
            border: '1px solid rgba(0,218,243,0.18)',
            color: 'oklch(0.82 0.14 198)',
          }}
        >
          <Eye className="w-3.5 h-3.5" />
          View only
        </div>
      </div>
    </motion.header>
  )
}

// ── Loading state ─────────────────────────────────────────────────────────────

function PublicBoardSkeleton() {
  return (
    <div
      className="flex h-screen items-center justify-center flex-col gap-4"
      style={{ background: 'oklch(0.12 0.015 265)' }}
    >
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
      >
        <Loader2 className="w-6 h-6" style={{ color: 'oklch(0.82 0.14 198)' }} />
      </motion.div>
      <p
        className="text-[12px] font-medium tracking-wide"
        style={{ color: 'rgba(255,255,255,0.35)' }}
      >
        Loading board…
      </p>
    </div>
  )
}

// ── Error states ──────────────────────────────────────────────────────────────

function PublicBoardError({ is404 }: { is404: boolean }) {
  return (
    <div
      className="flex h-screen items-center justify-center flex-col gap-5"
      style={{ background: 'oklch(0.12 0.015 265)' }}
    >
      {/* Docflow wordmark */}
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-[15px] mb-2"
        style={{
          background: 'linear-gradient(135deg, oklch(0.82 0.14 198) 0%, oklch(0.55 0.18 265) 100%)',
          color: 'white',
          letterSpacing: '-0.04em',
        }}
      >
        D
      </div>

      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center"
        style={{
          background: 'rgba(248,113,113,0.10)',
          border: '1px solid rgba(248,113,113,0.20)',
        }}
      >
        <LinkIcon className="w-6 h-6" style={{ color: '#F87171' }} />
      </div>

      <div className="text-center space-y-1.5">
        <p
          className="font-bold text-[16px]"
          style={{ color: 'oklch(0.91 0.015 265)' }}
        >
          {is404 ? 'Link not found' : 'Something went wrong'}
        </p>
        <p
          className="text-[13px] max-w-xs"
          style={{ color: 'rgba(255,255,255,0.38)' }}
        >
          {is404
            ? 'This share link is invalid or has been revoked by the board owner.'
            : 'Unable to load this board. Try refreshing the page.'}
        </p>
      </div>
    </div>
  )
}

// ── PublicBoardPage ───────────────────────────────────────────────────────────

export function PublicBoardPage() {
  const { token } = useParams<{ token: string }>()

  const { data: board, isLoading, isError, error } = usePublicBoard(token)

  const is404 =
    (error as { response?: { status?: number } })?.response?.status === 404

  if (isLoading) return <PublicBoardSkeleton />
  if (isError || !board) return <PublicBoardError is404={is404} />

  // Sort columns + cards by position (mirrors useBoard's select transform)
  const sortedColumns = [...board.columns]
    .sort((a, b) => a.position - b.position)
    .map((col) => ({
      ...col,
      cards: [...col.cards].sort((a, b) => a.position - b.position),
    }))

  return (
    <div
      className="flex flex-col h-screen overflow-hidden"
      style={{ background: 'oklch(0.12 0.015 265)' }}
    >
      {/* Dot-grid background texture */}
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.028) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />

      {/* Ambient top glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[180px] pointer-events-none z-0"
        style={{
          background: 'radial-gradient(ellipse at top, oklch(0.82 0.14 198 / 0.05) 0%, transparent 70%)',
        }}
      />

      <PublicTopbar board={board} />

      {/* Board canvas — read-only, no DnD */}
      <main className="flex-1 overflow-x-auto overflow-y-hidden relative z-10">
        <div className="flex gap-4 p-6 h-full items-start min-w-max">
          <AnimatePresence>
            {sortedColumns.map((column, index) => (
              <PublicColumn key={column.id} column={column} index={index} />
            ))}
          </AnimatePresence>

          {/* Empty state when board has no columns */}
          {sortedColumns.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center gap-3 w-80 py-16 rounded-2xl"
              style={{
                border: '1.5px dashed rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.22)',
              }}
            >
              <LayoutGrid className="w-8 h-8 opacity-40" />
              <p className="text-[13px] font-medium">This board has no columns yet</p>
            </motion.div>
          )}
        </div>
      </main>
    </div>
  )
}