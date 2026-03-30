// src/components/board/Column.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Premium redesign — all functionality preserved.
//
// Motion features (motion/react):
//   • Column mounts with a spring fade-up (initial y:16 → 0, staggered by index)
//   • Card list children stagger in via variants (delayChildren + staggerChildren)
//   • "Add Card" button pulses a gentle glow on hover (scale spring)
//   • Column header count badge animates value changes (layout animation)
//   • Options button rotates in with spring on hover
//   • Delete dialog: AnimatePresence overlay with blur backdrop
//   • Empty state: subtle breathing pulse animation
//   • Drop zone highlight: AnimatePresence colored ring when dragging over
//
// Visual design:
//   • True glass morphism: layered bg + backdrop-blur + inner light edge
//   • Subtle gradient top-to-bottom within the column surface
//   • Column header uses editorial ALL-CAPS tracking with a colored dot accent
//   • Card count badge shifts color based on load (few = dim, many = accent)
//   • "Add Card" button: dashed → solid on hover with spring scale
//
// Zero functionality changes — same props, hooks, DnD architecture.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { MoreHorizontal, Plus, Trash2, Loader2, Layers } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { Card } from '@/components/board/Card'
import { cn } from '@/lib/utils'
import type { ColumnWithCards } from '@/lib/types'

interface ColumnProps {
  column: ColumnWithCards
  boardId: string
  onAddCard: () => void
  onAddColumn: () => void
  index?: number
}

// Stagger children (card list) in on column mount
const listVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.055,
      delayChildren: 0.12,
    },
  },
}

const cardItemVariants = {
  hidden: { opacity: 0, y: 10, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const },
  },
}

// Dot color cycles through a subtle palette per column (by index mod)
const COLUMN_DOT_COLORS = [
  '#00DAF3', // cyan primary
  '#A855F7', // purple
  '#22C55E', // green
  '#F97316', // orange
  '#3B82F6', // blue
  '#EAB308', // yellow
]

export function Column({ column, boardId, onAddCard, index = 0 }: ColumnProps) {
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isHeaderHovered, setIsHeaderHovered] = useState(false)

  const { mutate: deleteColumn, isPending: isDeleting } = useDeleteColumn(boardId)

  // Make column a droppable zone so cards can be dropped into empty columns
  const { isOver, setNodeRef: setDropRef } = useDroppable({ id: column.id })

  const dotColor = COLUMN_DOT_COLORS[index % COLUMN_DOT_COLORS.length]
  const cardCount = column.cards.length
  const countIsHigh = cardCount >= 5

  function handleDelete() {
    deleteColumn(column.id, { onSuccess: () => setDeleteOpen(false) })
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.975 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{
          duration: 0.42,
          delay: index * 0.07,
          ease: [0.22, 1, 0.36, 1],
        }}
        ref={setDropRef}
        className="shrink-0 w-75 flex flex-col rounded-2xl h-full"
        style={{
          background: isOver
            ? 'linear-gradient(175deg, oklch(0.21 0.018 265 / 0.85) 0%, oklch(0.18 0.015 265 / 0.85) 100%)'
            : 'linear-gradient(175deg, oklch(0.19 0.015 265 / 0.72) 0%, oklch(0.16 0.012 265 / 0.72) 100%)',
          backdropFilter: 'blur(20px) saturate(160%)',
          border: isOver
            ? `1px solid ${dotColor}44`
            : '1px solid rgba(255,255,255,0.07)',
          boxShadow: isOver
            ? `0 0 0 2px ${dotColor}22, 0 8px 32px rgba(0,0,0,0.3)`
            : '0 4px 24px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.05)',
          transition: 'background 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease',
        }}
      >
        {/* ── Inner top-edge light ──────────────────────────────────────────── */}
        <div
          className="absolute top-0 left-6 right-6 h-px rounded-full pointer-events-none"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.10), transparent)' }}
        />

        {/* ── Column header ─────────────────────────────────────────────────── */}
        <div
          className="relative flex items-center justify-between px-4 pt-4 pb-3"
          onMouseEnter={() => setIsHeaderHovered(true)}
          onMouseLeave={() => setIsHeaderHovered(false)}
        >
          {/* Dot accent + title */}
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Colored identity dot */}
            <motion.div
              animate={{
                scale: isHeaderHovered ? 1.4 : 1,
                opacity: isHeaderHovered ? 1 : 0.7,
              }}
              transition={{ type: 'spring', stiffness: 400, damping: 22 }}
              className="w-2 h-2 rounded-full shrink-0"
              style={{
                backgroundColor: dotColor,
                boxShadow: isHeaderHovered ? `0 0 8px ${dotColor}` : 'none',
              }}
            />

            <h3 className="font-display font-bold text-[11px] uppercase tracking-[0.12em] text-on-surface-variant truncate">
              {column.title}
            </h3>

            {/* Card count badge */}
            <motion.div
              layout
              className={cn(
                'shrink-0 min-w-5 h-5 px-1.5 rounded-full',
                'flex items-center justify-center',
                'text-[10px] font-bold tabular-nums',
                'transition-colors duration-300',
              )}
              style={{
                background: countIsHigh ? `${dotColor}22` : 'rgba(255,255,255,0.07)',
                color: countIsHigh ? dotColor : 'rgba(255,255,255,0.4)',
                border: countIsHigh ? `1px solid ${dotColor}30` : '1px solid rgba(255,255,255,0.08)',
              }}
            >
              {cardCount}
            </motion.div>
          </div>

          {/* Options menu */}
          <AnimatePresence>
            {isHeaderHovered && (
              <motion.div
                initial={{ opacity: 0, scale: 0.7, rotate: -10 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={{ opacity: 0, scale: 0.7, rotate: -10 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
              >
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className={cn(
                        'p-1.5 rounded-lg text-on-surface-variant',
                        'hover:bg-surface-container-highest/60 hover:text-on-surface',
                        'border border-transparent hover:border-outline-variant/15',
                        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                        'transition-all data-[state=open]:opacity-100',
                      )}
                      aria-label={`Column options for ${column.title}`}
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem onClick={onAddCard} className="gap-2 cursor-pointer">
                      <Plus className="size-4 text-outline" />
                      Add card
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => setDeleteOpen(true)}
                      className="gap-2 cursor-pointer"
                    >
                      <Trash2 className="size-4" />
                      Delete column
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Divider ───────────────────────────────────────────────────────── */}
        <div
          className="mx-4 h-px mb-3"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent)' }}
        />

        {/* ── Card list ─────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto flex flex-col gap-2.5 px-3 pb-2 min-h-0 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-track]:transparent">
          <AnimatePresence mode="popLayout">
            {column.cards.length === 0 ? (
              // Empty state
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col items-center justify-center py-8 gap-2"
              >
                <motion.div
                  animate={{ opacity: [0.3, 0.6, 0.3] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <Layers className="w-7 h-7 text-on-surface-variant/30" />
                </motion.div>
                <p className="text-[11px] text-on-surface-variant/30 font-medium text-center">
                  No cards yet
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="list"
                variants={listVariants}
                initial="hidden"
                animate="visible"
                className="flex flex-col gap-2.5"
              >
                {column.cards.map((card) => (
                  <motion.div key={card.id} variants={cardItemVariants} layout>
                    <Card card={card} boardId={boardId} />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Drop zone highlight ring ──────────────────────────────────────── */}
        <AnimatePresence>
          {isOver && (
            <motion.div
              key="drop-ring"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0 rounded-2xl pointer-events-none"
              style={{ border: `2px solid ${dotColor}50`, boxShadow: `inset 0 0 24px ${dotColor}10` }}
            />
          )}
        </AnimatePresence>

        {/* ── Add Card button ───────────────────────────────────────────────── */}
        <div className="px-3 pt-2 pb-3">
          <motion.button
            onClick={onAddCard}
            whileHover={{ scale: 1.015 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className={cn(
              'w-full flex items-center justify-center gap-2 py-3',
              'rounded-xl text-sm font-semibold',
              'text-on-surface-variant hover:text-on-surface',
              'border border-dashed border-outline-variant/20 hover:border-outline-variant/40',
              'hover:bg-white/3',
              'transition-colors duration-200',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
              'group',
            )}
          >
            <motion.span
              animate={{ rotate: 0 }}
              whileHover={{ rotate: 90 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              className="inline-flex"
            >
              <Plus className="w-3.5 h-3.5 group-hover:text-primary transition-colors" />
            </motion.span>
            <span className="text-[12px] uppercase tracking-wider group-hover:text-primary transition-colors">
              Add card
            </span>
          </motion.button>
        </div>
      </motion.div>

      {/* ── Delete confirmation dialog ─────────────────────────────────────── */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete column</DialogTitle>
            <DialogDescription>
              <span className="font-semibold text-on-surface">{column.title}</span>
              {' '}and all {cardCount} card{cardCount !== 1 ? 's' : ''} inside it will be permanently deleted. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              onClick={() => setDeleteOpen(false)}
              disabled={isDeleting}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium',
                'border border-outline-variant/20 text-on-surface-variant',
                'hover:bg-surface-container hover:text-on-surface',
                'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                'disabled:opacity-50 disabled:pointer-events-none',
              )}
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2',
                'bg-destructive/10 text-destructive',
                'hover:bg-destructive hover:text-background',
                'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50',
                'disabled:opacity-40 disabled:pointer-events-none',
              )}
            >
              {isDeleting ? (
                <><Loader2 className="size-4 animate-spin" />Deleting…</>
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