// src/components/board/Card.tsx
// ─────────────────────────────────────────────────────────────────────────────
// REDESIGNED: Premium kanban card — "Obsidian Studio" aesthetic.
//
// Interaction design:
//   • Magnetic hover lift (y: -3, subtle shadow bloom)
//   • Shimmer sweep animates across on hover (AnimatePresence)
//   • Color accent: thin left bar with soft glow halo
//   • Title text animates to primary cyan on hover
//   • Options button (⋯) appears on hover with spring pop — positioned top-right
//   • Delete confirmation slides up INSIDE the card (no dialog)
//   • Drag ghost: tilted 2°, scaled up slightly, deep shadow
//   • Footer: assignee + doc indicator + date — staggered mount
//   • isDragging: the card slot becomes a ghost placeholder (opacity 0 + dashed border)
//
// All functionality preserved: useSortable, navigate, archiveCard, deleteCard.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef } from 'react'
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
} from '@/components/ui/dropdown-menu'
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

// ── Card ──────────────────────────────────────────────────────────────────────

export function Card({ card, boardId, isOverlay = false }: CardProps) {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const menuOpenRef = useRef(false)

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
        onHoverStart={() => { if (!menuOpenRef.current) setIsHovered(true) }}
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
          border: `1px solid ${isHovered ? hoverBorder : 'rgba(255,255,255,0.068)'}`,
          boxShadow: isHovered
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
              color: isHovered ? 'oklch(0.82 0.14 198)' : 'oklch(0.91 0.015 265)',
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
                  background: isHovered ? 'rgba(0,218,243,0.10)' : 'rgba(255,255,255,0.04)',
                }}
                transition={{ duration: 0.18 }}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded-md"
              >
                <FileText
                  className="w-2.75 h-2.75 transition-colors duration-200"
                  style={{ color: isHovered ? 'oklch(0.82 0.14 198)' : 'rgba(255,255,255,0.32)' }}
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

        {/* Options button — appears on hover */}
        {!isOverlay && (
          <AnimatePresence>
            {isHovered && !deleteOpen && (
              <motion.div
                key="opts"
                initial={{ opacity: 0, scale: 0.6, rotate: -10 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={{ opacity: 0, scale: 0.6, rotate: -10 }}
                transition={{ duration: 0.13, ease: 'easeOut' }}
                className="absolute top-2.5 right-2.5 z-20"
              >
                <DropdownMenu
                  onOpenChange={(open) => {
                    menuOpenRef.current = open
                    if (!open) setIsHovered(false)
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
                        background: 'oklch(0.22 0.015 265 / 0.9)',
                        backdropFilter: 'blur(8px)',
                        border: '1px solid rgba(255,255,255,0.10)',
                        color: 'rgba(255,255,255,0.65)',
                      }}
                    >
                      <MoreHorizontal className="w-3.5 h-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem
                      onClick={() => dispatch(openModal({ type: 'editCard', cardId: card.id }))}
                      className="gap-2 cursor-pointer"
                    >
                      <Pencil className="size-4 text-outline" />
                      Edit card
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => archiveCard(card.id)}
                      disabled={isArchiving}
                      className="gap-2 cursor-pointer"
                    >
                      {isArchiving
                        ? <Loader2 className="size-4 animate-spin" />
                        : <Archive className="size-4 text-outline" />
                      }
                      Archive
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => setDeleteOpen(true)}
                      className="gap-2 cursor-pointer"
                    >
                      <Trash2 className="size-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </motion.div>
            )}
          </AnimatePresence>
        )}

        {/* Delete confirmation — slides up inside card */}
        <AnimatePresence>
          {deleteOpen && (
            <motion.div
              key="delete"
              initial={{ opacity: 0, y: 14, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 14, scale: 0.96 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-0 z-30 rounded-2xl p-4 flex flex-col justify-between"
              style={{
                background: 'oklch(0.13 0.018 265 / 0.97)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(239,68,68,0.20)',
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div>
                <p
                  className="text-sm font-semibold"
                  style={{ color: 'oklch(0.91 0.015 265)', fontFamily: 'var(--df-font-display)' }}
                >
                  Delete this card?
                </p>
                <p className="text-[11px] mt-1 leading-relaxed" style={{ color: 'rgba(255,255,255,0.40)' }}>
                  Permanently removes the card and its document.
                </p>
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => setDeleteOpen(false)}
                  disabled={isDeleting}
                  className={cn(
                    'flex-1 py-2 rounded-xl text-xs font-bold transition-colors',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                    'disabled:opacity-50',
                  )}
                  style={{
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: 'rgba(255,255,255,0.55)',
                    background: 'transparent',
                  }}
                  onMouseEnter={(e) => {
                    ;(e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'
                    ;(e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.85)'
                  }}
                  onMouseLeave={(e) => {
                    ;(e.currentTarget as HTMLElement).style.background = 'transparent'
                    ;(e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.55)'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => { deleteCard(card.id); setDeleteOpen(false) }}
                  disabled={isDeleting}
                  className={cn(
                    'flex-1 py-2 rounded-xl text-xs font-bold transition-all',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50',
                    'disabled:opacity-70',
                  )}
                  style={{
                    background: 'oklch(0.65 0.22 25)',
                    color: 'white',
                  }}
                  onMouseEnter={(e) => { ;(e.currentTarget as HTMLElement).style.background = 'oklch(0.70 0.22 25)' }}
                  onMouseLeave={(e) => { ;(e.currentTarget as HTMLElement).style.background = 'oklch(0.65 0.22 25)' }}
                >
                  {isDeleting
                    ? <Loader2 className="size-3.5 animate-spin mx-auto" />
                    : 'Delete'
                  }
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}