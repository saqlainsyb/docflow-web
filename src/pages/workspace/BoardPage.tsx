// src/pages/workspace/BoardPage.tsx
// ─────────────────────────────────────────────────────────────────────────────
// REDESIGNED: Premium kanban board with buttery-smooth DnD.
//
// DnD improvements over v1:
//   - rectIntersection collision: more stable than closestCorners, no flicker
//     when hovering column edges
//   - KeyboardSensor added for full a11y
//   - activeId/overId tracked via useRef for drag handlers (no stale closure)
//   - localColumns set ONCE on dragStart, mutated cleanly — no mid-drag thrash
//   - dragCancel handler resets state safely
//   - DragOverlay card has stable identity, no flicker
//
// Visual design direction: "Obsidian Studio"
//   Dark glass surfaces, electric cyan primary, teal-purple depth system.
//   Board background: subtle dot-grid noise texture.
//   Column: frosted glass with gradient inner glow, no opaque borders.
//   Card: layered surface with magnetic hover lift + shimmer.
//   Topbar: translucent blur band — information-rich but never cluttered.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  rectIntersection,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
  type DragCancelEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import {
  ArrowLeft,
  Share2,
  MoreHorizontal,
  Loader2,
  Plus,
  LayoutGrid,
  Users,
  Lock,
  Globe,
  Sparkles,
} from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { useAppDispatch } from '@/store/hooks'
import { openModal } from '@/store'
import { useBoard } from '@/hooks/useBoard'
import { useMoveCard } from '@/hooks/useMoveCard'
import { useBoardWebSocket } from '@/hooks/useBoardWebSocket'
import { Column } from '@/components/board/Column'
import { Card } from '@/components/board/Card'
import { between, before, after, needsRebalance, rebalance } from '@/lib/fractional'
import { cn } from '@/lib/utils'
import { getInitials } from '@/lib/utils'
import type { BoardDetailResponse, CardResponse, ColumnWithCards } from '@/lib/types'

// ── Design tokens ─────────────────────────────────────────────────────────────

const COLUMN_ACCENT_COLORS = [
  { dot: '#00DAF3', glow: 'rgba(0,218,243,0.18)' },    // cyan
  { dot: '#A78BFA', glow: 'rgba(167,139,250,0.18)' },  // violet
  { dot: '#34D399', glow: 'rgba(52,211,153,0.18)' },   // emerald
  { dot: '#FB923C', glow: 'rgba(251,146,60,0.18)' },   // orange
  { dot: '#60A5FA', glow: 'rgba(96,165,250,0.18)' },   // blue
  { dot: '#F472B6', glow: 'rgba(244,114,182,0.18)' },  // pink
]

// ── BoardTopbar ───────────────────────────────────────────────────────────────

interface BoardTopbarProps {
  board: BoardDetailResponse
  onBack: () => void
  onShareClick: () => void
  onMoreClick: () => void
}

function BoardTopbar({ board, onBack, onShareClick, onMoreClick }: BoardTopbarProps) {
  const visibleMembers = board.members.slice(0, 4)
  const overflowCount = board.members.length - visibleMembers.length
  const totalCards = board.columns.reduce((acc, col) => acc + col.cards.length, 0)
  const isPublic = board.visibility === 'workspace'

  return (
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="h-16 flex items-center justify-between px-5 shrink-0 relative z-40"
      style={{
        background: 'oklch(0.13 0.015 265 / 0.88)',
        backdropFilter: 'blur(24px) saturate(180%)',
        borderBottom: '1px solid rgba(255,255,255,0.055)',
        boxShadow: '0 1px 0 rgba(0,218,243,0.06)',
      }}
    >
      {/* Left: back + board identity */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Back button */}
        <motion.button
          onClick={onBack}
          aria-label="Back to boards"
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          transition={{ type: 'spring', stiffness: 450, damping: 25 }}
          className={cn(
            'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
            'text-on-surface-variant',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
          )}
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          <ArrowLeft className="w-4 h-4" />
        </motion.button>

        {/* Divider */}
        <div className="w-px h-6 bg-white/8 shrink-0" />

        {/* Board identity */}
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <h1
              className="font-display font-bold text-[15px] tracking-tight text-on-surface truncate"
              style={{ fontFamily: 'var(--df-font-display)' }}
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

          {/* Board stats */}
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-[11px] text-on-surface-variant/50 flex items-center gap-1">
              <LayoutGrid className="w-2.75 h-2.75" />
              {board.columns.length} columns
            </span>
            <span className="text-[11px] text-on-surface-variant/50 flex items-center gap-1">
              <Sparkles className="w-2.75 h-2.75" />
              {totalCards} cards
            </span>
          </div>
        </div>
      </div>

      {/* Right: members + actions */}
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
                  title={`${member.name} · ${member.role}`}
                  className={cn(
                    'w-8 h-8 rounded-full shrink-0',
                    'flex items-center justify-center text-[9px] font-bold select-none',
                    'cursor-default',
                  )}
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
                style={{ color: 'rgba(255,255,255,0.4)' }}
              >
                +{overflowCount} more
              </span>
            )}

            <span
              className="flex items-center gap-1 text-[11px]"
              style={{ color: 'rgba(255,255,255,0.3)' }}
            >
              <Users className="w-2.75 h-2.75" />
              {board.members.length}
            </span>
          </div>
        )}

        {/* Divider */}
        <div className="w-px h-5 bg-white/8" />

        {/* Share */}
        <motion.button
          onClick={onShareClick}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 450, damping: 25 }}
          className={cn(
            'flex items-center gap-2 px-3.5 py-2 rounded-xl text-[12px] font-bold',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
            'transition-colors',
          )}
          style={{
            background: 'linear-gradient(135deg, oklch(0.82 0.14 198 / 0.15) 0%, oklch(0.42 0.09 198 / 0.10) 100%)',
            border: '1px solid oklch(0.82 0.14 198 / 0.22)',
            color: 'oklch(0.82 0.14 198)',
          }}
        >
          <Share2 className="w-3.5 h-3.5" />
          Share
        </motion.button>

        {/* More */}
        <motion.button
          onClick={onMoreClick}
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          transition={{ type: 'spring', stiffness: 450, damping: 25 }}
          aria-label="Board options"
          className={cn(
            'w-9 h-9 flex items-center justify-center rounded-xl',
            'text-on-surface-variant hover:text-on-surface',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
            'transition-colors',
          )}
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          <MoreHorizontal className="w-4 h-4" />
        </motion.button>
      </div>
    </motion.header>
  )
}

// ── AddColumnButton ───────────────────────────────────────────────────────────

function AddColumnButton({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false)

  return (
    <motion.button
      onClick={onClick}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 400, damping: 26 }}
      className={cn(
        'shrink-0 w-72 flex flex-col items-center justify-center gap-3 self-start',
        'rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        'transition-all',
      )}
      style={{
        height: '120px',
        background: hovered
          ? 'linear-gradient(160deg, oklch(0.82 0.14 198 / 0.06) 0%, oklch(0.20 0.015 265 / 0.4) 100%)'
          : 'rgba(255,255,255,0.025)',
        border: hovered
          ? '1.5px dashed oklch(0.82 0.14 198 / 0.35)'
          : '1.5px dashed rgba(255,255,255,0.09)',
      }}
    >
      <motion.div
        animate={{ rotate: hovered ? 45 : 0, scale: hovered ? 1.15 : 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 22 }}
        className="w-10 h-10 rounded-2xl flex items-center justify-center"
        style={{
          background: hovered ? 'oklch(0.82 0.14 198 / 0.12)' : 'rgba(255,255,255,0.05)',
          border: hovered ? '1px solid oklch(0.82 0.14 198 / 0.25)' : '1px solid rgba(255,255,255,0.07)',
        }}
      >
        <Plus
          className="w-5 h-5 transition-colors"
          style={{ color: hovered ? 'oklch(0.82 0.14 198)' : 'rgba(255,255,255,0.35)' }}
        />
      </motion.div>
      <span
        className="text-[11px] font-bold uppercase tracking-[0.12em] transition-colors"
        style={{ color: hovered ? 'oklch(0.82 0.14 198)' : 'rgba(255,255,255,0.28)' }}
      >
        New Column
      </span>
    </motion.button>
  )
}

// ── BoardPage ─────────────────────────────────────────────────────────────────

export function BoardPage() {
  const { workspaceId, boardId } = useParams<{ workspaceId: string; boardId: string }>()
  const navigate = useNavigate()
  const dispatch = useAppDispatch()

  const { data: board, isLoading, isError } = useBoard(boardId)
  const { mutate: moveCard } = useMoveCard(boardId ?? '')

  useBoardWebSocket(boardId)

  // ── DnD state ─────────────────────────────────────────────────────────────
  // localColumns is set once at dragStart, mutated on dragOver, committed/reset on dragEnd
  const [localColumns, setLocalColumns] = useState<ColumnWithCards[] | null>(null)
  const [activeCard, setActiveCard] = useState<CardResponse | null>(null)

  // Stable refs so drag handlers never capture stale closures
  const localColumnsRef = useRef<ColumnWithCards[] | null>(null)
  const boardColumnsRef = useRef<ColumnWithCards[]>([])

  // Keep ref in sync
  if (board) boardColumnsRef.current = board.columns

  const columns = localColumns ?? board?.columns ?? []

  // ── Sensors ───────────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, {
      // 6px threshold — responsive but won't fire on tap
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  // ── Drag handlers ─────────────────────────────────────────────────────────

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const card = boardColumnsRef.current
      .flatMap((col) => col.cards)
      .find((c) => c.id === event.active.id)

    if (!card) return

    setActiveCard(card)
    // Snapshot server columns into local state ONCE at drag start
    const snapshot = boardColumnsRef.current.map((col) => ({ ...col, cards: [...col.cards] }))
    setLocalColumns(snapshot)
    localColumnsRef.current = snapshot
  }, [])

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id || !localColumnsRef.current) return

    const activeCardId = active.id as string
    const overId = over.id as string

    const prev = localColumnsRef.current

    // Resolve columns
    const sourceCol = prev.find((col) => col.cards.some((c) => c.id === activeCardId))
    const targetCol =
      prev.find((col) => col.id === overId) ??
      prev.find((col) => col.cards.some((c) => c.id === overId))

    if (!sourceCol || !targetCol || sourceCol.id === targetCol.id) return

    const movingCard = sourceCol.cards.find((c) => c.id === activeCardId)!
    const overCardIndex = targetCol.cards.findIndex((c) => c.id === overId)
    const insertIndex = overCardIndex >= 0 ? overCardIndex : targetCol.cards.length

    const next = prev.map((col) => {
      if (col.id === sourceCol.id) {
        return { ...col, cards: col.cards.filter((c) => c.id !== activeCardId) }
      }
      if (col.id === targetCol.id) {
        const newCards = [...col.cards]
        newCards.splice(insertIndex, 0, { ...movingCard, column_id: targetCol.id })
        return { ...col, cards: newCards }
      }
      return col
    })

    localColumnsRef.current = next
    setLocalColumns(next)
  }, [])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    setActiveCard(null)

    if (!over || !localColumnsRef.current) {
      setLocalColumns(null)
      localColumnsRef.current = null
      return
    }

    const activeCardId = active.id as string
    const overId = over.id as string
    const cols = localColumnsRef.current

    const targetCol =
      cols.find((col) => col.id === overId) ??
      cols.find((col) => col.cards.some((c) => c.id === overId))

    if (!targetCol) {
      setLocalColumns(null)
      localColumnsRef.current = null
      return
    }

    let targetCards = targetCol.cards

    // Handle same-column reorder via arrayMove
    const sourceColBeforeDrag = boardColumnsRef.current.find((col) =>
      col.cards.some((c) => c.id === activeCardId),
    )
    if (sourceColBeforeDrag?.id === targetCol.id) {
      const oldIndex = sourceColBeforeDrag.cards.findIndex((c) => c.id === activeCardId)
      const newIndex = targetCards.findIndex((c) => c.id === overId)
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        targetCards = arrayMove(targetCards, oldIndex, newIndex)
      }
    }

    // Compute fractional position
    const droppedIndex = targetCards.findIndex((c) => c.id === activeCardId)
    const prevCard = targetCards[droppedIndex - 1]
    const nextCard = targetCards[droppedIndex + 1]

    let newPosition: number
    if (!prevCard && !nextCard) {
      newPosition = 1000
    } else if (!prevCard) {
      newPosition = before(nextCard.position)
    } else if (!nextCard) {
      newPosition = after(prevCard.position)
    } else {
      newPosition = between(prevCard.position, nextCard.position)
    }

    // Rebalance if gap is too small
    const sortedPositions = targetCards
      .filter((c) => c.id !== activeCardId)
      .map((c) => c.position)
      .sort((a, b) => a - b)

    if (needsRebalance(sortedPositions)) {
      const rebalanced = rebalance(targetCards.length)
      targetCards.forEach((card, i) => {
        if (card.id !== activeCardId) {
          moveCard({ cardId: card.id, column_id: targetCol.id, position: rebalanced[i] })
        }
      })
      newPosition = rebalanced[droppedIndex]
    }

    moveCard({ cardId: activeCardId, column_id: targetCol.id, position: newPosition })

    setLocalColumns(null)
    localColumnsRef.current = null
  }, [moveCard])

  const handleDragCancel = useCallback((_event: DragCancelEvent) => {
    setActiveCard(null)
    setLocalColumns(null)
    localColumnsRef.current = null
  }, [])

  // ── Render ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center flex-col gap-4"
        style={{ background: 'oklch(0.12 0.015 265)' }}
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
        >
          <Loader2 className="w-7 h-7 text-primary" />
        </motion.div>
        <p className="text-xs text-on-surface-variant/50 font-medium tracking-wide">
          Loading board…
        </p>
      </div>
    )
  }

  if (isError || !board) {
    return (
      <div className="flex h-screen items-center justify-center flex-col gap-4"
        style={{ background: 'oklch(0.12 0.015 265)' }}
      >
        <p className="text-on-surface-variant text-sm">
          Board not found or you don't have access.
        </p>
        <button
          onClick={() => navigate(`/${workspaceId}/boards`)}
          className="text-primary text-sm hover:underline focus:outline-none"
        >
          ← Back to boards
        </button>
      </div>
    )
  }

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
          background: 'radial-gradient(ellipse at top, oklch(0.82 0.14 198 / 0.06) 0%, transparent 70%)',
        }}
      />

      <BoardTopbar
        board={board}
        onBack={() => navigate(`/${workspaceId}/boards`)}
        onShareClick={() => {}}
        onMoreClick={() => {}}
      />

      <DndContext
        sensors={sensors}
        collisionDetection={rectIntersection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {/* Board canvas */}
        <main className="flex-1 overflow-x-auto overflow-y-hidden relative z-10">
          <div className="flex gap-4 p-6 h-full items-start min-w-max">
            <AnimatePresence mode="popLayout">
              {columns.map((column, index) => (
                <motion.div
                  key={column.id}
                  layout
                  initial={{ opacity: 0, y: 20, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95, y: 8 }}
                  transition={{
                    layout: { type: 'spring', stiffness: 300, damping: 30 },
                    default: { duration: 0.38, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] },
                  }}
                >
                  <SortableContext
                    items={column.cards.map((c) => c.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <Column
                      column={column}
                      boardId={boardId ?? ''}
                      index={index}
                      accentColor={COLUMN_ACCENT_COLORS[index % COLUMN_ACCENT_COLORS.length]}
                      onAddCard={() =>
                        dispatch(openModal({ type: 'createCard', columnId: column.id }))
                      }
                      onAddColumn={() =>
                        dispatch(openModal({ type: 'createColumn', boardId: boardId ?? '' }))
                      }
                    />
                  </SortableContext>
                </motion.div>
              ))}
            </AnimatePresence>

            <AddColumnButton
              onClick={() =>
                dispatch(openModal({ type: 'createColumn', boardId: boardId ?? '' }))
              }
            />
          </div>
        </main>

        {/* Drag overlay — the "ghost" card following the pointer */}
        <DragOverlay
          dropAnimation={{
            duration: 200,
            easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          {activeCard ? (
            <div style={{ width: '272px' }}>
              <Card
                card={activeCard}
                boardId={boardId ?? ''}
                isOverlay
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}