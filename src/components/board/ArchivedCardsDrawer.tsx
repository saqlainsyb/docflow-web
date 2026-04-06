// src/components/board/ArchivedCardsDrawer.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Slide-over drawer that lists all archived cards for the current board.
//
// Layout:
//   - Fixed right-side panel, slides in over the board (not push)
//   - Header: title + count badge + close button
//   - Body: cards grouped by column_title (column position order from API)
//   - Each card row: color bar + title + assignee chip + archived-at + Restore btn
//   - Empty state: archive box illustration + copy
//   - Loading: skeleton rows
//   - Error: inline error message with retry
//
// Data:
//   - Fetches GET /boards/:id/archived-cards via useArchivedCards (enabled=open)
//   - Restore via useUnarchiveCard — invalidates both live board + archived list
//   - Grouped by column_title client-side (API already orders by col position)
//
// Behaviour:
//   - Backdrop click or Escape closes the drawer
//   - Restoring a card removes it from the list immediately (query invalidation)
//   - CARD_UNARCHIVED WS event on other tabs also updates the live board
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  X,
  Archive,
  RotateCcw,
  Loader2,
  AlertCircle,
  Inbox,
} from 'lucide-react'
import { useArchivedCards } from '@/hooks/useArchivedCards'
import { useUnarchiveCard } from '@/hooks/useArchiveCard'
import { getInitials } from '@/lib/utils'
import type { ArchivedCardResponse } from '@/lib/types'

// ── Design tokens (match rest of the board UI) ────────────────────────────────

const DRAWER_BG =
  'linear-gradient(180deg, oklch(0.155 0.016 265) 0%, oklch(0.138 0.014 265) 100%)'

const COLOR_BAR: Record<string, { bar: string; glow: string }> = {
  '#EF4444': { bar: '#EF4444', glow: 'rgba(239,68,68,0.20)' },
  '#F97316': { bar: '#F97316', glow: 'rgba(249,115,22,0.20)' },
  '#EAB308': { bar: '#EAB308', glow: 'rgba(234,179,8,0.20)'  },
  '#22C55E': { bar: '#22C55E', glow: 'rgba(34,197,94,0.20)'  },
  '#3B82F6': { bar: '#3B82F6', glow: 'rgba(59,130,246,0.20)' },
  '#A855F7': { bar: '#A855F7', glow: 'rgba(168,85,247,0.20)' },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatArchivedAt(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60_000)
  const diffHrs  = Math.floor(diffMs / 3_600_000)
  const diffDays = Math.floor(diffMs / 86_400_000)

  if (diffMins < 1)  return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHrs  < 24) return `${diffHrs}h ago`
  if (diffDays < 7)  return `${diffDays}d ago`

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Group cards by column_title preserving the order they appear in the API
// response (which is already sorted by col.position ASC, updated_at DESC).
function groupByColumn(cards: ArchivedCardResponse[]): [string, ArchivedCardResponse[]][] {
  const map = new Map<string, ArchivedCardResponse[]>()
  for (const card of cards) {
    const key = card.column_title
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(card)
  }
  return Array.from(map.entries())
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl animate-pulse"
      style={{ background: 'rgba(255,255,255,0.03)' }}
    >
      <div className="w-[3px] h-10 rounded-full shrink-0" style={{ background: 'rgba(255,255,255,0.08)' }} />
      <div className="flex-1 space-y-2">
        <div className="h-3 rounded-md w-3/4"  style={{ background: 'rgba(255,255,255,0.07)' }} />
        <div className="h-2.5 rounded-md w-1/3" style={{ background: 'rgba(255,255,255,0.05)' }} />
      </div>
      <div className="w-16 h-7 rounded-lg shrink-0" style={{ background: 'rgba(255,255,255,0.06)' }} />
    </div>
  )
}

interface CardRowProps {
  card: ArchivedCardResponse
  boardId: string
  isRestoring: boolean
  onRestore: (cardId: string) => void
}

function CardRow({ card, boardId: _boardId, isRestoring, onRestore }: CardRowProps) {
  const color = card.color ? COLOR_BAR[card.color] : null

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 12, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="flex items-center gap-3 px-4 py-3 rounded-xl group"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.05)',
        boxShadow: color
          ? `inset 0 0 0 0 transparent, 0 1px 3px rgba(0,0,0,0.20)`
          : '0 1px 3px rgba(0,0,0,0.20)',
      }}
    >
      {/* Color bar */}
      <div
        className="w-[3px] self-stretch rounded-full shrink-0"
        style={{
          background: color ? color.bar : 'rgba(255,255,255,0.10)',
          boxShadow: color ? `0 0 6px ${color.glow}` : 'none',
        }}
      />

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <p
          className="text-[13px] font-semibold leading-snug truncate"
          style={{ color: 'oklch(0.85 0.012 265)' }}
        >
          {card.title}
        </p>
        <div className="flex items-center gap-2 mt-1">
          {/* Assignee */}
          {card.assignee && (
            <div className="flex items-center gap-1">
              <div
                className="w-4 h-4 rounded-full shrink-0 flex items-center justify-center text-[7px] font-bold overflow-hidden"
                style={{
                  background: 'oklch(0.38 0.16 285)',
                  color: 'oklch(0.88 0.08 285)',
                  boxShadow: '0 0 0 1px rgba(255,255,255,0.08)',
                }}
                title={card.assignee.name}
              >
                {card.assignee.avatar_url ? (
                  <img
                    src={card.assignee.avatar_url}
                    alt={card.assignee.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  getInitials(card.assignee.name)
                )}
              </div>
              <span className="text-[10px] truncate max-w-[80px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                {card.assignee.name.split(' ')[0]}
              </span>
            </div>
          )}

          {/* Archived-at timestamp */}
          <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
            {card.assignee ? '·' : ''} {formatArchivedAt(card.archived_at)}
          </span>
        </div>
      </div>

      {/* Restore button */}
      <motion.button
        onClick={() => onRestore(card.id)}
        disabled={isRestoring}
        whileHover={!isRestoring ? { scale: 1.04 } : undefined}
        whileTap={!isRestoring  ? { scale: 0.96 } : undefined}
        transition={{ type: 'spring', stiffness: 450, damping: 25 }}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold shrink-0 focus:outline-none disabled:opacity-50 disabled:pointer-events-none"
        style={{
          background: 'rgba(0,218,243,0.10)',
          border:     '1px solid rgba(0,218,243,0.22)',
          color:      'oklch(0.82 0.14 198)',
        }}
      >
        {isRestoring ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <RotateCcw className="w-3 h-3" />
        )}
        {isRestoring ? 'Restoring…' : 'Restore'}
      </motion.button>
    </motion.div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface ArchivedCardsDrawerProps {
  boardId: string
  open: boolean
  onClose: () => void
}

export function ArchivedCardsDrawer({ boardId, open, onClose }: ArchivedCardsDrawerProps) {
  const { data: cards, isLoading, isError, refetch } = useArchivedCards(boardId, open)
  const { mutate: unarchiveCard, isPending: isRestoring, variables: restoringId } =
    useUnarchiveCard(boardId)

  // Close on Escape
  const drawerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Derived data
  const groups = cards ? groupByColumn(cards) : []
  const totalCount = cards?.length ?? 0

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop — transparent so the board is still visible */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)' }}
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Drawer panel */}
          <motion.div
            key="drawer"
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Archived cards"
            initial={{ x: '100%', opacity: 0.6 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 340, damping: 34, mass: 0.9 }}
            className="fixed right-0 top-0 bottom-0 z-50 flex flex-col w-full max-w-[400px]"
            style={{
              background: DRAWER_BG,
              borderLeft: '1px solid rgba(255,255,255,0.07)',
              boxShadow: '-24px 0 80px rgba(0,0,0,0.55), -1px 0 0 rgba(255,255,255,0.04)',
            }}
          >
            {/* ── Header ─────────────────────────────────────────────────── */}
            <div
              className="flex items-center justify-between px-5 py-4 shrink-0"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div className="flex items-center gap-3">
                {/* Icon */}
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.09)',
                  }}
                >
                  <Archive className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.50)' }} />
                </div>

                <div>
                  <h2
                    className="text-[15px] font-bold leading-tight"
                    style={{ color: 'oklch(0.91 0.015 265)', fontFamily: 'var(--df-font-display)' }}
                  >
                    Archived Cards
                  </h2>
                  <p className="text-[11px] mt-px" style={{ color: 'rgba(255,255,255,0.32)' }}>
                    {isLoading
                      ? 'Loading…'
                      : `${totalCount} card${totalCount !== 1 ? 's' : ''} archived`}
                  </p>
                </div>
              </div>

              {/* Close */}
              <motion.button
                onClick={onClose}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                transition={{ type: 'spring', stiffness: 450, damping: 25 }}
                className="w-8 h-8 rounded-xl flex items-center justify-center focus:outline-none"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  color: 'rgba(255,255,255,0.40)',
                }}
                aria-label="Close archived cards"
              >
                <X className="w-4 h-4" />
              </motion.button>
            </div>

            {/* ── Body ───────────────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">

              {/* Loading */}
              {isLoading && (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <SkeletonRow key={i} />
                  ))}
                </div>
              )}

              {/* Error */}
              {isError && !isLoading && (
                <div
                  className="flex flex-col items-center gap-3 py-10 text-center px-4"
                >
                  <AlertCircle className="w-8 h-8" style={{ color: 'rgba(239,68,68,0.60)' }} />
                  <p className="text-[13px] font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>
                    Failed to load archived cards
                  </p>
                  <button
                    onClick={() => refetch()}
                    className="text-[12px] font-semibold px-4 py-2 rounded-lg focus:outline-none"
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.09)',
                      color: 'rgba(255,255,255,0.55)',
                    }}
                  >
                    Try again
                  </button>
                </div>
              )}

              {/* Empty state */}
              {!isLoading && !isError && totalCount === 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                  className="flex flex-col items-center gap-4 py-14 text-center px-6"
                >
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.07)',
                    }}
                  >
                    <Inbox className="w-7 h-7" style={{ color: 'rgba(255,255,255,0.22)' }} />
                  </div>
                  <div>
                    <p
                      className="text-[14px] font-semibold"
                      style={{ color: 'rgba(255,255,255,0.50)', fontFamily: 'var(--df-font-display)' }}
                    >
                      No archived cards
                    </p>
                    <p className="text-[12px] mt-1" style={{ color: 'rgba(255,255,255,0.28)' }}>
                      Cards you archive will appear here
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Card groups */}
              {!isLoading && !isError && groups.length > 0 && (
                <AnimatePresence mode="popLayout">
                  {groups.map(([columnTitle, columnCards]) => (
                    <motion.section
                      key={columnTitle}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.18 }}
                    >
                      {/* Column group header */}
                      <div className="flex items-center gap-2 mb-2 px-1">
                        <div
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ background: 'rgba(255,255,255,0.25)' }}
                        />
                        <span
                          className="text-[10px] font-bold uppercase tracking-[0.14em] truncate"
                          style={{ color: 'rgba(255,255,255,0.32)' }}
                        >
                          {columnTitle}
                        </span>
                        <span
                          className="text-[10px] font-semibold ml-auto shrink-0"
                          style={{ color: 'rgba(255,255,255,0.20)' }}
                        >
                          {columnCards.length}
                        </span>
                      </div>

                      {/* Cards in this column */}
                      <div className="space-y-2">
                        <AnimatePresence mode="popLayout">
                          {columnCards.map((card) => (
                            <CardRow
                              key={card.id}
                              card={card}
                              boardId={boardId}
                              isRestoring={isRestoring && restoringId === card.id}
                              onRestore={(cardId) => unarchiveCard(cardId)}
                            />
                          ))}
                        </AnimatePresence>
                      </div>
                    </motion.section>
                  ))}
                </AnimatePresence>
              )}
            </div>

            {/* ── Footer ─────────────────────────────────────────────────── */}
            {!isLoading && !isError && totalCount > 0 && (
              <div
                className="px-5 py-3 shrink-0"
                style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
              >
                <p className="text-[11px] text-center" style={{ color: 'rgba(255,255,255,0.22)' }}>
                  Restored cards return to their original column
                </p>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}