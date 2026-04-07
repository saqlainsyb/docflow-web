// src/components/board/Column.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Pragmatic DnD replacement for dnd-kit's useSortable + useDroppable on columns.
//
// Architecture:
//   - draggable()           → column header (GripVertical) is the drag handle
//   - dropTargetForElements → column body receives card drops (cross-column +
//                             empty column) and column drops (reorder)
//   - autoScrollForElements → smooth scroll of the card list while dragging
//   - State changes (card-over highlight, dragging dim) are LOCAL to this
//     component — they never trigger a parent re-render during drag motion.
//   - The board-level monitorForElements (in BoardPage) handles all state
//     mutations (moveCard / reorderColumn).
//
// UI/UX: identical to the dnd-kit version —
//   - Glassmorphism shell with per-column accent color
//   - GripVertical drag handle in the header
//   - card-over state: subtle ring + background tint
//   - dragging state: 0.4 opacity ghost
//   - Empty column: animated "Drop cards here" state
//   - DropdownMenu with Add card / Rename / Delete (same fix: always mounted)
//   - Rename + Delete dialogs with Obsidian Studio styling
//
// Framer Motion note:
//   Cards inside the column use layout="position" (not layout) to avoid
//   triggering getBoundingClientRect on every frame during a drag.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react'
import {
  MoreHorizontal, Plus, Trash2, Loader2, Layers, Pencil, GripVertical,
} from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { draggable, dropTargetForElements }
  from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine'
import { autoScrollForElements }
  from '@atlaskit/pragmatic-drag-and-drop-auto-scroll/element'
import { isCardData, isColumnData } from '@/types/dnd'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useDeleteColumn } from '@/hooks/useDeleteColumn'
import { useRenameColumn } from '@/hooks/useRenameColumn'
import { Card } from '@/components/board/Card'
import { cn } from '@/lib/utils'
import type { ColumnWithCards } from '@/lib/types'

interface AccentColor {
  dot: string
  glow: string
}

interface ColumnProps {
  column: ColumnWithCards
  boardId: string
  onAddCard: () => void
  onAddColumn: () => void
  index?: number
  accentColor?: AccentColor
  // When true, the column is rendered inside the drag preview —
  // skip all DnD registrations to avoid conflicting ref assignments.
  isOverlay?: boolean
}

const DEFAULT_ACCENT: AccentColor = { dot: '#00DAF3', glow: 'rgba(0,218,243,0.18)' }

const listVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.05, delayChildren: 0.1 },
  },
}

const cardVariants = {
  hidden: { opacity: 0, y: 8, scale: 0.975 },
  visible: {
    opacity: 1, y: 0, scale: 1,
    transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const },
  },
}

const DIALOG_OVERLAY_STYLE = {
  background: 'oklch(0.10 0.015 265 / 0.85)',
  backdropFilter: 'blur(8px)',
}
void DIALOG_OVERLAY_STYLE

const DIALOG_CONTENT_STYLE = {
  background: 'linear-gradient(160deg, oklch(0.175 0.018 265) 0%, oklch(0.155 0.014 265) 100%)',
  border: '1px solid rgba(255,255,255,0.08)',
  boxShadow: '0 32px 64px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04)',
  borderRadius: '1.25rem',
}

// ── Local drag state ──────────────────────────────────────────────────────────
type ColumnDragState = 'idle' | 'card-over' | 'column-over' | 'dragging'

// ── Column ────────────────────────────────────────────────────────────────────

export function Column({
  column,
  boardId,
  onAddCard,
  index = 0,
  accentColor = DEFAULT_ACCENT,
  isOverlay = false,
}: ColumnProps) {
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameValue, setRenameValue] = useState(column.title)
  const [headerHovered, setHeaderHovered] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [dragState, setDragState] = useState<ColumnDragState>('idle')

  const columnRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)

  const { mutate: deleteColumn, isPending: isDeleting } = useDeleteColumn(boardId)
  const { mutate: renameColumn, isPending: isRenaming } = useRenameColumn(boardId)

  // ── Pragmatic DnD registration ─────────────────────────────────────────────
  useEffect(() => {
    if (isOverlay) return
    const columnEl = columnRef.current
    const headerEl = headerRef.current
    const scrollEl = scrollRef.current
    if (!columnEl || !headerEl || !scrollEl) return

    return combine(
      // Column is draggable via the header grip handle only
      draggable({
        element: columnEl,
        dragHandle: headerEl,
        getInitialData: () => ({ type: 'column', columnId: column.id }),
        onDragStart: () => setDragState('dragging'),
        onDrop: () => setDragState('idle'),
      }),

      // Column receives CARD drops (cross-column move + empty column drop)
      // Card drops onto cards are handled by each Card's own dropTarget.
      // This target fires when a card is dragged over the column background
      // (i.e., below all cards, or into an empty column).
      dropTargetForElements({
        element: columnEl,
        canDrop: ({ source }) => isCardData(source.data),
        getData: () => ({ type: 'column', columnId: column.id }),
        onDragEnter: () => setDragState('card-over'),
        onDragLeave: () => setDragState('idle'),
        onDrop: () => setDragState('idle'),
      }),

      // Auto-scroll the card list when a card drag approaches the edges
      autoScrollForElements({
        element: scrollEl,
        canScroll: ({ source }) => isCardData(source.data),
      }),
    )
  }, [column.id, isOverlay])

  const cardCount = column.cards.length
  const hasCards = cardCount > 0
  const { dot } = accentColor

  const isDragging = dragState === 'dragging'
  const isCardOver = dragState === 'card-over'

  const showMenuButton = headerHovered || menuOpen

  function handleDelete() {
    deleteColumn(column.id, { onSuccess: () => setDeleteOpen(false) })
  }

  function handleRename() {
    const trimmed = renameValue.trim()
    if (!trimmed || trimmed === column.title) {
      setRenameOpen(false)
      return
    }
    renameColumn(
      { columnId: column.id, title: trimmed },
      { onSuccess: () => setRenameOpen(false) },
    )
  }

  function openRename() {
    setRenameValue(column.title)
    setRenameOpen(true)
    setTimeout(() => renameInputRef.current?.select(), 80)
  }

  return (
    <>
      <div
        ref={columnRef}
        className="shrink-0 w-72 flex flex-col rounded-2xl relative"
        style={{
          maxHeight: 'calc(100vh - 120px)',
          minHeight: '160px',
          // Dim the original while its ghost is being dragged elsewhere
          opacity: isDragging ? 0.4 : 1,
          background: isCardOver
            ? `linear-gradient(175deg, oklch(0.21 0.020 265 / 0.9) 0%, oklch(0.18 0.017 265 / 0.88) 100%)`
            : `linear-gradient(175deg, oklch(0.195 0.016 265 / 0.82) 0%, oklch(0.165 0.014 265 / 0.80) 100%)`,
          backdropFilter: 'blur(22px) saturate(160%)',
          border: isCardOver
            ? `1px solid ${dot}44`
            : '1px solid rgba(255,255,255,0.065)',
          boxShadow: isCardOver
            ? `0 0 0 2px ${dot}20, 0 8px 40px rgba(0,0,0,0.36), inset 0 1px 0 rgba(255,255,255,0.07)`
            : '0 4px 32px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.055)',
          transition: 'background 0.22s ease, border-color 0.22s ease, box-shadow 0.22s ease, opacity 0.18s ease',
        }}
      >
        {/* Inner top-edge light seam */}
        <div
          className="absolute top-0 left-8 right-8 h-px pointer-events-none rounded-full"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.10), transparent)',
          }}
        />

        {/* ── Column header ──────────────────────────────────────────────── */}
        <div
          ref={headerRef}
          className="flex items-center justify-between px-4 pt-4 pb-3 relative cursor-grab active:cursor-grabbing"
          onMouseEnter={() => setHeaderHovered(true)}
          onMouseLeave={() => setHeaderHovered(false)}
        >
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            {/* Drag handle icon — visual affordance only; the whole header is the handle */}
            <div
              className="shrink-0 flex items-center justify-center w-4 h-4 rounded focus:outline-none"
              style={{
                opacity: showMenuButton ? 0.55 : 0.2,
                transition: 'opacity 0.15s ease',
                color: 'rgba(255,255,255,0.7)',
                touchAction: 'none',
              }}
              aria-label={`Drag to reorder ${column.title}`}
            >
              <GripVertical className="w-3.5 h-3.5" />
            </div>

            {/* Accent dot */}
            <motion.div
              animate={{
                scale: headerHovered ? 1.5 : 1,
                opacity: headerHovered ? 1 : 0.65,
              }}
              transition={{ type: 'spring', stiffness: 420, damping: 22 }}
              className="w-2 h-2 rounded-full shrink-0"
              style={{
                backgroundColor: dot,
                boxShadow: headerHovered ? `0 0 8px ${dot}` : 'none',
              }}
            />

            {/* Title */}
            <h3
              className="font-bold text-[11px] uppercase truncate"
              style={{
                color: 'rgba(255,255,255,0.55)',
                letterSpacing: '0.12em',
                fontFamily: 'var(--df-font-display)',
              }}
            >
              {column.title}
            </h3>

            {/* Card count badge — layout disabled to avoid Framer Motion + DnD loop */}
            <div
              className="shrink-0 min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center text-[10px] font-bold tabular-nums"
              style={{
                background: hasCards ? `${dot}1A` : 'rgba(255,255,255,0.06)',
                color: hasCards ? dot : 'rgba(255,255,255,0.28)',
                border: hasCards ? `1px solid ${dot}28` : '1px solid rgba(255,255,255,0.07)',
                transition: 'background 0.25s, color 0.25s, border-color 0.25s',
              }}
            >
              {cardCount}
            </div>
          </div>

          {/* ── Options button — ALWAYS mounted, visibility via opacity ──── */}
          <div
            // Stop pointer events from bubbling to the drag handle
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              opacity: showMenuButton ? 1 : 0,
              pointerEvents: showMenuButton ? 'auto' : 'none',
              transition: 'opacity 0.15s ease',
            }}
          >
            <DropdownMenu
              open={menuOpen}
              onOpenChange={(open) => {
                setMenuOpen(open)
                if (!open && !headerHovered) setHeaderHovered(false)
              }}
            >
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    'p-1.5 rounded-lg transition-all',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                  )}
                  style={{
                    color: menuOpen ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.45)',
                    background: menuOpen ? 'rgba(255,255,255,0.10)' : 'transparent',
                    border: menuOpen ? '1px solid rgba(255,255,255,0.12)' : '1px solid transparent',
                  }}
                  aria-label={`Options for ${column.title}`}
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                align="end"
                sideOffset={6}
                className="w-48"
                style={{
                  background: 'linear-gradient(160deg, oklch(0.19 0.018 265) 0%, oklch(0.16 0.014 265) 100%)',
                  border: '1px solid rgba(255,255,255,0.09)',
                  boxShadow: '0 16px 48px rgba(0,0,0,0.50), 0 0 0 1px rgba(255,255,255,0.03)',
                  borderRadius: '0.875rem',
                  padding: '6px',
                }}
              >
                <DropdownMenuLabel
                  className="text-[10px] font-bold uppercase tracking-widest px-2 pb-1"
                  style={{ color: 'rgba(255,255,255,0.28)' }}
                >
                  {column.title}
                </DropdownMenuLabel>
                <DropdownMenuSeparator
                  style={{ background: 'rgba(255,255,255,0.06)', margin: '4px 0' }}
                />

                <DropdownMenuItem
                  onClick={onAddCard}
                  className="gap-2.5 cursor-pointer rounded-lg text-[13px] font-medium py-2.5 px-2"
                  style={{ color: 'rgba(255,255,255,0.72)' }}
                >
                  <div
                    className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(0,218,243,0.12)', color: '#00DAF3' }}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </div>
                  Add card
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={openRename}
                  className="gap-2.5 cursor-pointer rounded-lg text-[13px] font-medium py-2.5 px-2"
                  style={{ color: 'rgba(255,255,255,0.72)' }}
                >
                  <div
                    className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.55)' }}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </div>
                  Rename column
                </DropdownMenuItem>

                <DropdownMenuSeparator
                  style={{ background: 'rgba(255,255,255,0.06)', margin: '4px 0' }}
                />

                <DropdownMenuItem
                  onClick={() => setDeleteOpen(true)}
                  className="gap-2.5 cursor-pointer rounded-lg text-[13px] font-medium py-2.5 px-2"
                  style={{ color: 'rgba(239,68,68,0.85)' }}
                >
                  <div
                    className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(239,68,68,0.12)', color: '#EF4444' }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </div>
                  Delete column
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Subtle divider */}
        <div
          className="mx-4 h-px mb-3"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)' }}
        />

        {/* ── Card list ─────────────────────────────────────────────────── */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto flex flex-col gap-2 px-3 pb-2 min-h-0 column-scroll"
          style={{ scrollbarWidth: 'none' }}
        >
          <style>{`.column-scroll::-webkit-scrollbar { display: none; }`}</style>

          <AnimatePresence mode="popLayout">
            {!hasCards ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col items-center justify-center py-10 gap-2.5"
              >
                <motion.div
                  animate={{ opacity: [0.25, 0.5, 0.25] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <Layers className="w-6 h-6" style={{ color: 'rgba(255,255,255,0.22)' }} />
                </motion.div>
                <p className="text-[11px] font-medium text-center" style={{ color: 'rgba(255,255,255,0.22)' }}>
                  Drop cards here
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="list"
                variants={listVariants}
                initial="hidden"
                animate="visible"
                className="flex flex-col gap-2"
              >
                {column.cards.map((card) => (
                  // layout="position" avoids triggering getBoundingClientRect
                  // recalculation on every Framer frame during a sibling drag.
                  <motion.div key={card.id} variants={cardVariants} layout="position">
                    <Card card={card} boardId={boardId} />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Drop zone highlight ring — shown when a card is dragged over */}
        <AnimatePresence>
          {isCardOver && (
            <motion.div
              key="drop-ring"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.14 }}
              className="absolute inset-0 rounded-2xl pointer-events-none"
              style={{
                border: `2px solid ${dot}55`,
                boxShadow: `inset 0 0 30px ${dot}0A`,
              }}
            />
          )}
        </AnimatePresence>

        {/* ── Add Card button ───────────────────────────────────────────── */}
        <div className="px-3 pt-1.5 pb-3">
          <motion.button
            onClick={onAddCard}
            whileHover={{ scale: 1.015 }}
            whileTap={{ scale: 0.975 }}
            transition={{ type: 'spring', stiffness: 420, damping: 26 }}
            className={cn(
              'w-full flex items-center justify-center gap-2 py-2.5',
              'rounded-xl text-[11px] font-bold uppercase tracking-widest',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
              'transition-colors duration-200 group',
            )}
            style={{
              color: 'rgba(255,255,255,0.28)',
              border: '1px dashed rgba(255,255,255,0.10)',
              background: 'transparent',
            }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLElement).style.color = dot
              ;(e.currentTarget as HTMLElement).style.borderColor = `${dot}40`
              ;(e.currentTarget as HTMLElement).style.background = `${dot}08`
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.28)'
              ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.10)'
              ;(e.currentTarget as HTMLElement).style.background = 'transparent'
            }}
          >
            <Plus className="w-3.5 h-3.5" />
            Add card
          </motion.button>
        </div>
      </div>

      {/* ── Rename dialog ──────────────────────────────────────────────────── */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent
          className="sm:max-w-sm p-0 overflow-hidden gap-0"
          style={DIALOG_CONTENT_STYLE}
        >
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle
              className="text-base font-bold"
              style={{ color: 'oklch(0.93 0.012 265)', fontFamily: 'var(--df-font-display)' }}
            >
              Rename column
            </DialogTitle>
            <DialogDescription
              className="text-[13px] mt-1"
              style={{ color: 'rgba(255,255,255,0.38)' }}
            >
              Give this column a new name.
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 pb-2">
            <input
              ref={renameInputRef}
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename()
                if (e.key === 'Escape') setRenameOpen(false)
              }}
              placeholder="Column name"
              maxLength={100}
              className="w-full rounded-xl px-3.5 py-2.5 text-sm font-medium outline-none transition-all"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.10)',
                color: 'oklch(0.91 0.015 265)',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'oklch(0.82 0.14 198 / 0.45)'
                e.currentTarget.style.boxShadow = '0 0 0 3px oklch(0.82 0.14 198 / 0.10)'
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            />
          </div>

          <DialogFooter className="px-6 pt-3 pb-5 flex gap-2 sm:gap-2">
            <button
              onClick={() => setRenameOpen(false)}
              disabled={isRenaming}
              className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold transition-all focus:outline-none disabled:opacity-50"
              style={{
                border: '1px solid rgba(255,255,255,0.09)',
                color: 'rgba(255,255,255,0.50)',
                background: 'transparent',
              }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'
                ;(e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.80)'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLElement).style.background = 'transparent'
                ;(e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.50)'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleRename}
              disabled={isRenaming || !renameValue.trim() || renameValue.trim() === column.title}
              className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold transition-all focus:outline-none disabled:opacity-40"
              style={{
                background: 'linear-gradient(135deg, oklch(0.82 0.14 198 / 0.22) 0%, oklch(0.55 0.12 198 / 0.30) 100%)',
                border: '1px solid oklch(0.82 0.14 198 / 0.30)',
                color: 'oklch(0.82 0.14 198)',
              }}
            >
              {isRenaming ? (
                <span className="inline-flex items-center gap-1.5 justify-center">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Saving…
                </span>
              ) : (
                'Rename'
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation dialog ─────────────────────────────────────── */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent
          className="sm:max-w-sm p-0 overflow-hidden gap-0"
          style={DIALOG_CONTENT_STYLE}
        >
          <DialogHeader className="px-6 pt-6 pb-4">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
              style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.20)' }}
            >
              <Trash2 className="w-5 h-5" style={{ color: '#EF4444' }} />
            </div>
            <DialogTitle
              className="text-base font-bold"
              style={{ color: 'oklch(0.93 0.012 265)', fontFamily: 'var(--df-font-display)' }}
            >
              Delete "{column.title}"?
            </DialogTitle>
            <DialogDescription
              className="text-[13px] mt-1 leading-relaxed"
              style={{ color: 'rgba(255,255,255,0.38)' }}
            >
              This will permanently delete the column and all{' '}
              <span style={{ color: 'rgba(255,255,255,0.65)', fontWeight: 600 }}>
                {cardCount} card{cardCount !== 1 ? 's' : ''}
              </span>{' '}
              inside it. This cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="px-6 pt-2 pb-5 flex gap-2 sm:gap-2">
            <button
              onClick={() => setDeleteOpen(false)}
              disabled={isDeleting}
              className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold transition-all focus:outline-none disabled:opacity-50"
              style={{
                border: '1px solid rgba(255,255,255,0.09)',
                color: 'rgba(255,255,255,0.50)',
                background: 'transparent',
              }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'
                ;(e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.80)'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLElement).style.background = 'transparent'
                ;(e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.50)'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold transition-all focus:outline-none disabled:opacity-70"
              style={{
                background: 'oklch(0.55 0.22 25)',
                border: '1px solid rgba(239,68,68,0.30)',
                color: 'white',
              }}
              onMouseEnter={(e) => {
                if (!isDeleting) (e.currentTarget as HTMLElement).style.background = 'oklch(0.60 0.22 25)'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLElement).style.background = 'oklch(0.55 0.22 25)'
              }}
            >
              {isDeleting ? (
                <span className="inline-flex items-center gap-1.5 justify-center">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Deleting…
                </span>
              ) : (
                'Delete column'
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}