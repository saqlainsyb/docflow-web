// src/components/board/Card.tsx
// ─────────────────────────────────────────────────────────────────────────────
// FIX: Card options menu no longer flickers / immediately closes.
//
// Root cause: wrapping <DropdownMenu> in <AnimatePresence> was unmounting the
// trigger button the moment hover ended — even if the menu was mid-open —
// causing Radix to close it immediately.
//
// Fix (mirrors Column.tsx): the DropdownMenu + trigger are ALWAYS mounted.
// Visibility is controlled purely through CSS opacity + pointer-events so the
// DOM element is stable throughout the menu's open lifecycle.
//
// All functionality preserved: useSortable, navigate to document editor,
// archiveCard, deleteCard, editCard modal.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { motion, AnimatePresence } from 'motion/react'
import {
  MoreHorizontal, FileText, Pencil, Archive, Trash2, Loader2, User,
} from 'lucide-react'
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
import { useAppDispatch } from '@/store/hooks'
import { openModal } from '@/store'
import { useArchiveCard } from '@/hooks/useArchiveCard'
import { useDeleteCard } from '@/hooks/useDeleteCard'
import { cn } from '@/lib/utils'
import { getInitials } from '@/lib/utils'
import type { CardResponse } from '@/lib/types'

interface CardProps {
  card: CardResponse
  boardId: string
  isOverlay?: boolean
}

// ── Color system ──────────────────────────────────────────────────────────────
const COLOR_MAP: Record<string, { bar: string; glow: string; border: string }> = {
  '#EF4444': { bar: '#EF4444', glow: 'rgba(239,68,68,0.16)', border: 'rgba(239,68,68,0.32)' },
  '#F97316': { bar: '#F97316', glow: 'rgba(249,115,22,0.16)', border: 'rgba(249,115,22,0.32)' },
  '#EAB308': { bar: '#EAB308', glow: 'rgba(234,179,8,0.16)', border: 'rgba(234,179,8,0.32)' },
  '#22C55E': { bar: '#22C55E', glow: 'rgba(34,197,94,0.16)', border: 'rgba(34,197,94,0.32)' },
  '#3B82F6': { bar: '#3B82F6', glow: 'rgba(59,130,246,0.16)', border: 'rgba(59,130,246,0.32)' },
  '#A855F7': { bar: '#A855F7', glow: 'rgba(168,85,247,0.16)', border: 'rgba(168,85,247,0.32)' },
}

const DEFAULT_HOVER_BORDER = 'rgba(0,218,243,0.30)'
const DEFAULT_HOVER_SHADOW = '0 8px 32px rgba(0,218,243,0.10)'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── Shared dialog styles ──────────────────────────────────────────────────────
const DIALOG_CONTENT_STYLE = {
  background: 'linear-gradient(160deg, oklch(0.175 0.018 265) 0%, oklch(0.155 0.014 265) 100%)',
  border: '1px solid rgba(255,255,255,0.08)',
  boxShadow: '0 32px 64px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04)',
  borderRadius: '1.25rem',
}

// ── Card ──────────────────────────────────────────────────────────────────────

export function Card({ card, boardId, isOverlay = false }: CardProps) {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { workspaceId } = useParams<{ workspaceId: string }>()

  // ── Hover + menu state ────────────────────────────────────────────────────
  const [isHovered, setIsHovered] = useState(false)
  // Track menu open state independently — keeps button visible while menu is open
  const [menuOpen, setMenuOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const { mutate: archiveCard, isPending: isArchiving } = useArchiveCard(boardId)
  const { mutate: deleteCard, isPending: isDeleting } = useDeleteCard(boardId)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    disabled: isOverlay,
  })

  const dndStyle = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? undefined : transition,
  }

  function handleTitleClick(e: React.MouseEvent) {
    e.stopPropagation()
    if (!workspaceId) return
    navigate(`/${workspaceId}/boards/${boardId}/cards/${card.id}`)
  }

  const colorConfig = card.color ? COLOR_MAP[card.color] : null
  const hoverBorder = colorConfig ? colorConfig.border : DEFAULT_HOVER_BORDER
  const hoverShadow = colorConfig
    ? `0 8px 32px ${colorConfig.glow}, 0 2px 8px rgba(0,0,0,0.36), inset 0 1px 0 rgba(255,255,255,0.055)`
    : `${DEFAULT_HOVER_SHADOW}, 0 2px 8px rgba(0,0,0,0.36), inset 0 1px 0 rgba(255,255,255,0.055)`

  // Button is visible when hovering OR menu is open (same pattern as Column.tsx)
  const showMenuButton = (isHovered || menuOpen) && !deleteOpen

  // ── Placeholder slot while dragging ───────────────────────────────────────
  if (isDragging && !isOverlay) {
    return (
      <div
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        className="rounded-2xl"
        style={{
          height: '80px',
          border: '1.5px dashed rgba(255,255,255,0.10)',
          background: 'rgba(255,255,255,0.02)',
          borderRadius: '1rem',
          ...dndStyle,
        }}
      />
    )
  }

  return (
    <div
      ref={setNodeRef}
      style={dndStyle}
      {...attributes}
      {...listeners}
      className="relative"
    >
      <motion.div
        onHoverStart={() => setIsHovered(true)}
        onHoverEnd={() => setIsHovered(false)}
        whileHover={!isOverlay ? {
          y: -3,
          transition: { type: 'spring', stiffness: 420, damping: 28 },
        } : undefined}
        whileTap={!isOverlay ? {
          scale: 0.985,
          y: 0,
          transition: { duration: 0.08 },
        } : undefined}
        animate={isOverlay ? {
          rotate: 1.8,
          scale: 1.04,
        } : undefined}
        className="relative rounded-2xl overflow-hidden cursor-grab active:cursor-grabbing select-none"
        style={{
          background: 'linear-gradient(155deg, oklch(0.205 0.015 265) 0%, oklch(0.175 0.013 265) 100%)',
          border: `1px solid ${(isHovered || menuOpen) ? hoverBorder : 'rgba(255,255,255,0.068)'}`,
          boxShadow: (isHovered || menuOpen)
            ? hoverShadow
            : isOverlay
              ? '0 28px 56px rgba(0,0,0,0.55), 0 0 0 1px rgba(0,218,243,0.20)'
              : '0 1px 4px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.042)',
          transition: 'border-color 0.18s ease, box-shadow 0.18s ease',
        }}
      >
        {/* Color accent bar */}
        {colorConfig && (
          <motion.div
            initial={{ scaleY: 0, originY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
            className="absolute left-0 top-0 bottom-0 w-[3px]"
            style={{
              backgroundColor: colorConfig.bar,
              boxShadow: `0 0 14px ${colorConfig.bar}70`,
              borderRadius: '0 2px 2px 0',
            }}
          />
        )}

        {/* Shimmer sweep on hover */}
        <AnimatePresence>
          {isHovered && !isOverlay && (
            <motion.div
              key="shimmer"
              initial={{ x: '-120%' }}
              animate={{ x: '220%' }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.55, ease: 'easeInOut' }}
              className="absolute inset-0 pointer-events-none z-0"
              style={{
                background: 'linear-gradient(108deg, transparent 30%, rgba(255,255,255,0.032) 50%, transparent 70%)',
              }}
            />
          )}
        </AnimatePresence>

        {/* Card body */}
        <div className={cn('relative z-10 p-4 pb-3', colorConfig ? 'pl-4.5' : '')}>
          {/* Title */}
          <motion.h4
            onClick={handleTitleClick}
            onPointerDown={(e) => e.stopPropagation()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') handleTitleClick(e as unknown as React.MouseEvent)
            }}
            aria-label={`Open document for ${card.title}`}
            className={cn(
              'font-semibold text-sm leading-snug mb-3.5 pr-7 transition-colors duration-200',
              'cursor-pointer focus:outline-none',
            )}
            style={{
              color: (isHovered || menuOpen) ? 'oklch(0.82 0.14 198)' : 'oklch(0.91 0.015 265)',
              fontFamily: 'var(--df-font-body)',
            }}
          >
            {card.title}
          </motion.h4>

          {/* Footer */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {/* Assignee avatar */}
              {card.assignee ? (
                <div
                  title={card.assignee.name}
                  className="w-5.5 h-5.5 rounded-full shrink-0 flex items-center justify-center text-[8px] font-bold select-none"
                  style={{
                    background: 'oklch(0.38 0.16 285)',
                    color: 'oklch(0.88 0.08 285)',
                    boxShadow: '0 0 0 1.5px rgba(255,255,255,0.08)',
                  }}
                >
                  {card.assignee.avatar_url ? (
                    <img
                      src={card.assignee.avatar_url}
                      alt={card.assignee.name}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    getInitials(card.assignee.name)
                  )}
                </div>
              ) : (
                <div
                  title="Unassigned"
                  className="w-5.5 h-5.5 rounded-full flex items-center justify-center"
                  style={{ border: '1px dashed rgba(255,255,255,0.16)' }}
                >
                  <User className="w-2.5 h-2.5" style={{ color: 'rgba(255,255,255,0.22)' }} />
                </div>
              )}

              {/* Doc indicator */}
              <motion.div
                animate={{
                  background: (isHovered || menuOpen) ? 'rgba(0,218,243,0.10)' : 'rgba(255,255,255,0.04)',
                }}
                transition={{ duration: 0.18 }}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded-md"
              >
                <FileText
                  className="w-2.75 h-2.75 transition-colors duration-200"
                  style={{ color: (isHovered || menuOpen) ? 'oklch(0.82 0.14 198)' : 'rgba(255,255,255,0.32)' }}
                />
              </motion.div>
            </div>

            <span
              className="text-[10px] font-medium tabular-nums"
              style={{ color: 'rgba(255,255,255,0.30)' }}
            >
              {formatDate(card.created_at)}
            </span>
          </div>
        </div>

        {/* ── Options button — ALWAYS mounted, visibility via opacity ──────── */}
        {/* Critical fix: never unmount DropdownMenu. Same pattern as Column.tsx */}
        {!isOverlay && (
          <div
            className="absolute top-2.5 right-2.5 z-20"
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
              }}
            >
              <DropdownMenuTrigger asChild>
                <button
                  onPointerDown={(e) => e.stopPropagation()}
                  aria-label="Card options"
                  className={cn(
                    'p-1.5 rounded-lg transition-all',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                  )}
                  style={{
                    background: menuOpen ? 'rgba(255,255,255,0.12)' : 'oklch(0.22 0.015 265 / 0.9)',
                    backdropFilter: 'blur(8px)',
                    border: menuOpen ? '1px solid rgba(255,255,255,0.14)' : '1px solid rgba(255,255,255,0.10)',
                    color: menuOpen ? 'rgba(255,255,255,0.90)' : 'rgba(255,255,255,0.65)',
                  }}
                >
                  <MoreHorizontal className="w-3.5 h-3.5" />
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
                  className="text-[10px] font-bold uppercase tracking-widest px-2 pb-1 truncate max-w-[160px]"
                  style={{ color: 'rgba(255,255,255,0.28)' }}
                >
                  {card.title}
                </DropdownMenuLabel>
                <DropdownMenuSeparator
                  style={{ background: 'rgba(255,255,255,0.06)', margin: '4px 0' }}
                />

                <DropdownMenuItem
                  onClick={() => dispatch(openModal({ type: 'editCard', cardId: card.id }))}
                  className="gap-2.5 cursor-pointer rounded-lg text-[13px] font-medium py-2.5 px-2"
                  style={{ color: 'rgba(255,255,255,0.72)' }}
                >
                  <div
                    className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.55)' }}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </div>
                  Edit card
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => archiveCard(card.id)}
                  disabled={isArchiving}
                  className="gap-2.5 cursor-pointer rounded-lg text-[13px] font-medium py-2.5 px-2"
                  style={{ color: 'rgba(255,255,255,0.72)' }}
                >
                  <div
                    className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.55)' }}
                  >
                    {isArchiving
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Archive className="w-3.5 h-3.5" />
                    }
                  </div>
                  {isArchiving ? 'Archiving…' : 'Archive'}
                </DropdownMenuItem>

                <DropdownMenuSeparator
                  style={{ background: 'rgba(255,255,255,0.06)', margin: '4px 0' }}
                />

                <DropdownMenuItem
                  onClick={() => { setMenuOpen(false); setDeleteOpen(true) }}
                  className="gap-2.5 cursor-pointer rounded-lg text-[13px] font-medium py-2.5 px-2"
                  style={{ color: 'rgba(239,68,68,0.85)' }}
                >
                  <div
                    className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(239,68,68,0.12)', color: '#EF4444' }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </div>
                  Delete card
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </motion.div>

      {/* ── Delete confirmation dialog ──────────────────────────────────────── */}
      {/* Rendered outside the motion card so it's never clipped by overflow:hidden */}
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
              Delete this card?
            </DialogTitle>
            <DialogDescription
              className="text-[13px] mt-1 leading-relaxed"
              style={{ color: 'rgba(255,255,255,0.38)' }}
            >
              Permanently removes{' '}
              <span style={{ color: 'rgba(255,255,255,0.65)', fontWeight: 600 }}>
                "{card.title}"
              </span>{' '}
              and its document. This cannot be undone.
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
              onClick={() => { deleteCard(card.id); setDeleteOpen(false) }}
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
                'Delete card'
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}