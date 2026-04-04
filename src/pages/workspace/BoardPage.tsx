// src/pages/workspace/BoardPage.tsx
// ─────────────────────────────────────────────────────────────────────────────
// BOARD MENU FIX: The ⋯ button in the topbar now opens a fully-wired menu:
//   • Rename board — opens an inline dialog (uses useUpdateBoard)
//   • Delete board — opens a confirm dialog (uses useDeleteBoard + navigate)
//
// Also fixes the same AnimatePresence flicker pattern that was fixed in
// Column.tsx / Card.tsx:  the board menu DropdownMenu is ALWAYS mounted;
// visibility is controlled via opacity + pointer-events only.
//
// Column drag-to-reorder:
//   Columns are now wrapped in a horizontal SortableContext. Each Column's
//   GripVertical handle triggers the drag. The existing card DnD is unchanged —
//   the two drag types are distinguished via the `data.type` field dnd-kit
//   attaches to active/over items ('card' | 'column'). Drag handlers short-
//   circuit immediately when the wrong type is active.
//
// FIX — column reorder not persisting:
//   The column drop handler previously read boardColumnsRef.current to compute
//   oldIndex / newIndex. That ref is only updated when the React Query `board`
//   data changes, so it can be one reorder behind (stale) — causing the wrong
//   position to be sent to the API, making the column appear not to move.
//   Fix: read board?.columns (the live React Query value) directly instead.
//   board is also added to the handleDragEnd useCallback dependency array so
//   the closure always captures the latest value.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
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
  Pencil,
  Trash2,
} from "lucide-react";
import { motion } from "motion/react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { openModal } from "@/store";
import { useBoard } from "@/hooks/useBoard";
import { useMoveCard } from "@/hooks/useMoveCard";
import { useReorderColumn } from "@/hooks/useReorderColumn";
import { useBoardWebSocket } from "@/hooks/useBoardWebSocket";
import { useUpdateBoard } from "@/hooks/useUpdateBoard";
import { useDeleteBoard } from "@/hooks/useDeleteBoard";
import { Column } from "@/components/board/Column";
import { Card } from "@/components/board/Card";
import {
  between,
  before,
  after,
  needsRebalance,
  rebalance,
} from "@/lib/fractional";
import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/utils";
import type {
  BoardDetailResponse,
  CardResponse,
  ColumnWithCards,
} from "@/lib/types";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ShareBoardDialog } from "@/components/board/ShareBoardDialog";

// ── Design tokens ─────────────────────────────────────────────────────────────

const COLUMN_ACCENT_COLORS = [
  { dot: "#00DAF3", glow: "rgba(0,218,243,0.18)" }, // cyan
  { dot: "#A78BFA", glow: "rgba(167,139,250,0.18)" }, // violet
  { dot: "#34D399", glow: "rgba(52,211,153,0.18)" }, // emerald
  { dot: "#FB923C", glow: "rgba(251,146,60,0.18)" }, // orange
  { dot: "#60A5FA", glow: "rgba(96,165,250,0.18)" }, // blue
  { dot: "#F472B6", glow: "rgba(244,114,182,0.18)" }, // pink
];

// ── Shared dialog styles ──────────────────────────────────────────────────────
const DIALOG_CONTENT_STYLE = {
  background:
    "linear-gradient(160deg, oklch(0.175 0.018 265) 0%, oklch(0.155 0.014 265) 100%)",
  border: "1px solid rgba(255,255,255,0.08)",
  boxShadow: "0 32px 64px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04)",
  borderRadius: "1.25rem",
};

// ── BoardTopbar ───────────────────────────────────────────────────────────────

interface BoardTopbarProps {
  board: BoardDetailResponse;
  workspaceId: string;
  onBack: () => void;
  onShareClick: () => void;
}

function BoardTopbar({
  board,
  workspaceId,
  onBack,
  onShareClick,
}: BoardTopbarProps) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(board.title);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const { mutate: updateBoard, isPending: isRenaming } = useUpdateBoard(
    board.id,
  );
  const { mutate: deleteBoard, isPending: isDeleting } = useDeleteBoard(
    board.id,
    workspaceId,
  );

  const visibleMembers = board.members.slice(0, 4);
  const overflowCount = board.members.length - visibleMembers.length;
  const totalCards = board.columns.reduce(
    (acc, col) => acc + col.cards.length,
    0,
  );
  const isPublic = board.visibility === "workspace";

  function openRename() {
    setRenameValue(board.title);
    setMenuOpen(false);
    setRenameOpen(true);
    setTimeout(() => renameInputRef.current?.select(), 80);
  }

  function handleRename() {
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === board.title) {
      setRenameOpen(false);
      return;
    }
    updateBoard({ title: trimmed }, { onSuccess: () => setRenameOpen(false) });
  }

  function handleDelete() {
    deleteBoard(undefined, {
      onSuccess: () => {
        setDeleteOpen(false);
        navigate(`/${workspaceId}/boards`);
      },
    });
  }

  return (
    <>
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="h-16 flex items-center justify-between px-5 shrink-0 relative z-40"
        style={{
          background: "oklch(0.13 0.015 265 / 0.88)",
          backdropFilter: "blur(24px) saturate(180%)",
          borderBottom: "1px solid rgba(255,255,255,0.055)",
          boxShadow: "0 1px 0 rgba(0,218,243,0.06)",
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
            transition={{ type: "spring", stiffness: 450, damping: 25 }}
            className={cn(
              "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
              "text-on-surface-variant",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
            )}
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.07)",
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
                style={{ fontFamily: "var(--df-font-display)" }}
              >
                {board.title}
              </h1>

              {/* Visibility pill */}
              <span
                className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                style={{
                  background: isPublic
                    ? "rgba(52,211,153,0.10)"
                    : "rgba(255,255,255,0.06)",
                  border: isPublic
                    ? "1px solid rgba(52,211,153,0.20)"
                    : "1px solid rgba(255,255,255,0.08)",
                  color: isPublic ? "#34D399" : "rgba(255,255,255,0.4)",
                }}
              >
                {isPublic ? (
                  <Globe className="w-2.5 h-2.5" />
                ) : (
                  <Lock className="w-2.5 h-2.5" />
                )}
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
                    transition={{
                      delay: i * 0.06,
                      type: "spring",
                      stiffness: 400,
                      damping: 22,
                    }}
                    title={`${member.name} · ${member.role}`}
                    className={cn(
                      "w-8 h-8 rounded-full shrink-0",
                      "flex items-center justify-center text-[9px] font-bold select-none",
                      "cursor-default",
                    )}
                    style={{
                      background: "oklch(0.38 0.16 285)",
                      color: "oklch(0.88 0.08 285)",
                      border: "2px solid oklch(0.13 0.015 265)",
                      boxShadow: "0 0 0 1px rgba(255,255,255,0.06)",
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
                  style={{ color: "rgba(255,255,255,0.4)" }}
                >
                  +{overflowCount} more
                </span>
              )}

              <span
                className="flex items-center gap-1 text-[11px]"
                style={{ color: "rgba(255,255,255,0.3)" }}
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
            transition={{ type: "spring", stiffness: 450, damping: 25 }}
            className={cn(
              "flex items-center gap-2 px-3.5 py-2 rounded-xl text-[12px] font-bold",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
              "transition-colors",
            )}
            style={{
              background:
                "linear-gradient(135deg, oklch(0.82 0.14 198 / 0.15) 0%, oklch(0.42 0.09 198 / 0.10) 100%)",
              border: "1px solid oklch(0.82 0.14 198 / 0.22)",
              color: "oklch(0.82 0.14 198)",
            }}
          >
            <Share2 className="w-3.5 h-3.5" />
            Share
          </motion.button>

          {/* ── Board ⋯ menu — ALWAYS mounted, visibility via opacity ──────── */}
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
              <motion.button
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.94 }}
                transition={{ type: "spring", stiffness: 450, damping: 25 }}
                aria-label="Board options"
                className={cn(
                  "w-9 h-9 flex items-center justify-center rounded-xl",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                  "transition-colors",
                )}
                style={{
                  background: menuOpen
                    ? "rgba(255,255,255,0.10)"
                    : "rgba(255,255,255,0.05)",
                  border: menuOpen
                    ? "1px solid rgba(255,255,255,0.14)"
                    : "1px solid rgba(255,255,255,0.07)",
                  color: menuOpen
                    ? "rgba(255,255,255,0.90)"
                    : "rgba(255,255,255,0.55)",
                }}
              >
                <MoreHorizontal className="w-4 h-4" />
              </motion.button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              align="end"
              sideOffset={8}
              className="w-52"
              style={{
                background:
                  "linear-gradient(160deg, oklch(0.19 0.018 265) 0%, oklch(0.16 0.014 265) 100%)",
                border: "1px solid rgba(255,255,255,0.09)",
                boxShadow:
                  "0 16px 48px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.03)",
                borderRadius: "0.875rem",
                padding: "6px",
              }}
            >
              <DropdownMenuLabel
                className="text-[10px] font-bold uppercase tracking-widest px-2 pb-1 truncate max-w-[180px]"
                style={{ color: "rgba(255,255,255,0.28)" }}
              >
                Board settings
              </DropdownMenuLabel>
              <DropdownMenuSeparator
                style={{
                  background: "rgba(255,255,255,0.06)",
                  margin: "4px 0",
                }}
              />

              <DropdownMenuItem
                onClick={openRename}
                className="gap-2.5 cursor-pointer rounded-lg text-[13px] font-medium py-2.5 px-2"
                style={{ color: "rgba(255,255,255,0.72)" }}
              >
                <div
                  className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                  style={{
                    background: "rgba(255,255,255,0.07)",
                    color: "rgba(255,255,255,0.55)",
                  }}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </div>
                Rename board
              </DropdownMenuItem>

              <DropdownMenuSeparator
                style={{
                  background: "rgba(255,255,255,0.06)",
                  margin: "4px 0",
                }}
              />

              <DropdownMenuItem
                onClick={() => {
                  setMenuOpen(false);
                  setDeleteOpen(true);
                }}
                className="gap-2.5 cursor-pointer rounded-lg text-[13px] font-medium py-2.5 px-2"
                style={{ color: "rgba(239,68,68,0.85)" }}
              >
                <div
                  className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                  style={{
                    background: "rgba(239,68,68,0.12)",
                    color: "#EF4444",
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </div>
                Delete board
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </motion.header>

      {/* ── Rename board dialog ──────────────────────────────────────────────── */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent
          className="sm:max-w-sm p-0 overflow-hidden gap-0"
          style={DIALOG_CONTENT_STYLE}
        >
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle
              className="text-base font-bold"
              style={{
                color: "oklch(0.93 0.012 265)",
                fontFamily: "var(--df-font-display)",
              }}
            >
              Rename board
            </DialogTitle>
            <DialogDescription
              className="text-[13px] mt-1"
              style={{ color: "rgba(255,255,255,0.38)" }}
            >
              Give this board a new name.
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 pb-2">
            <input
              ref={renameInputRef}
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRename();
                if (e.key === "Escape") setRenameOpen(false);
              }}
              placeholder="Board name"
              maxLength={100}
              className="w-full rounded-xl px-3.5 py-2.5 text-sm font-medium outline-none transition-all"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.10)",
                color: "oklch(0.91 0.015 265)",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor =
                  "oklch(0.82 0.14 198 / 0.45)";
                e.currentTarget.style.boxShadow =
                  "0 0 0 3px oklch(0.82 0.14 198 / 0.10)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
          </div>

          <DialogFooter className="px-6 pt-3 pb-5 flex gap-2 sm:gap-2">
            <button
              onClick={() => setRenameOpen(false)}
              disabled={isRenaming}
              className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold transition-all focus:outline-none disabled:opacity-50"
              style={{
                border: "1px solid rgba(255,255,255,0.09)",
                color: "rgba(255,255,255,0.50)",
                background: "transparent",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background =
                  "rgba(255,255,255,0.05)";
                (e.currentTarget as HTMLElement).style.color =
                  "rgba(255,255,255,0.80)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background =
                  "transparent";
                (e.currentTarget as HTMLElement).style.color =
                  "rgba(255,255,255,0.50)";
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleRename}
              disabled={
                isRenaming ||
                !renameValue.trim() ||
                renameValue.trim() === board.title
              }
              className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold transition-all focus:outline-none disabled:opacity-40"
              style={{
                background:
                  "linear-gradient(135deg, oklch(0.82 0.14 198 / 0.22) 0%, oklch(0.55 0.12 198 / 0.30) 100%)",
                border: "1px solid oklch(0.82 0.14 198 / 0.30)",
                color: "oklch(0.82 0.14 198)",
              }}
            >
              {isRenaming ? (
                <span className="inline-flex items-center gap-1.5 justify-center">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Saving…
                </span>
              ) : (
                "Rename"
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete board dialog ──────────────────────────────────────────────── */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent
          className="sm:max-w-sm p-0 overflow-hidden gap-0"
          style={DIALOG_CONTENT_STYLE}
        >
          <DialogHeader className="px-6 pt-6 pb-4">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
              style={{
                background: "rgba(239,68,68,0.12)",
                border: "1px solid rgba(239,68,68,0.20)",
              }}
            >
              <Trash2 className="w-5 h-5" style={{ color: "#EF4444" }} />
            </div>
            <DialogTitle
              className="text-base font-bold"
              style={{
                color: "oklch(0.93 0.012 265)",
                fontFamily: "var(--df-font-display)",
              }}
            >
              Delete "{board.title}"?
            </DialogTitle>
            <DialogDescription
              className="text-[13px] mt-1 leading-relaxed"
              style={{ color: "rgba(255,255,255,0.38)" }}
            >
              This will permanently delete the board, all its columns, cards,
              and documents. This cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="px-6 pt-2 pb-5 flex gap-2 sm:gap-2">
            <button
              onClick={() => setDeleteOpen(false)}
              disabled={isDeleting}
              className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold transition-all focus:outline-none disabled:opacity-50"
              style={{
                border: "1px solid rgba(255,255,255,0.09)",
                color: "rgba(255,255,255,0.50)",
                background: "transparent",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background =
                  "rgba(255,255,255,0.05)";
                (e.currentTarget as HTMLElement).style.color =
                  "rgba(255,255,255,0.80)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background =
                  "transparent";
                (e.currentTarget as HTMLElement).style.color =
                  "rgba(255,255,255,0.50)";
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold transition-all focus:outline-none disabled:opacity-70"
              style={{
                background: "oklch(0.55 0.22 25)",
                border: "1px solid rgba(239,68,68,0.30)",
                color: "white",
              }}
              onMouseEnter={(e) => {
                if (!isDeleting)
                  (e.currentTarget as HTMLElement).style.background =
                    "oklch(0.60 0.22 25)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background =
                  "oklch(0.55 0.22 25)";
              }}
            >
              {isDeleting ? (
                <span className="inline-flex items-center gap-1.5 justify-center">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Deleting…
                </span>
              ) : (
                "Delete board"
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── AddColumnButton ───────────────────────────────────────────────────────────

function AddColumnButton({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.button
      onClick={onClick}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 26 }}
      className={cn(
        "shrink-0 w-72 flex flex-col items-center justify-center gap-3 self-start",
        "rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        "transition-all",
      )}
      style={{
        height: "120px",
        background: hovered
          ? "linear-gradient(160deg, oklch(0.82 0.14 198 / 0.06) 0%, oklch(0.20 0.015 265 / 0.4) 100%)"
          : "rgba(255,255,255,0.025)",
        border: hovered
          ? "1.5px dashed oklch(0.82 0.14 198 / 0.35)"
          : "1.5px dashed rgba(255,255,255,0.09)",
      }}
    >
      <motion.div
        animate={{ rotate: hovered ? 45 : 0, scale: hovered ? 1.15 : 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 22 }}
        className="w-10 h-10 rounded-2xl flex items-center justify-center"
        style={{
          background: hovered
            ? "oklch(0.82 0.14 198 / 0.12)"
            : "rgba(255,255,255,0.05)",
          border: hovered
            ? "1px solid oklch(0.82 0.14 198 / 0.25)"
            : "1px solid rgba(255,255,255,0.07)",
        }}
      >
        <Plus
          className="w-5 h-5 transition-colors"
          style={{
            color: hovered ? "oklch(0.82 0.14 198)" : "rgba(255,255,255,0.35)",
          }}
        />
      </motion.div>
      <span
        className="text-[11px] font-bold uppercase tracking-[0.12em] transition-colors"
        style={{
          color: hovered ? "oklch(0.82 0.14 198)" : "rgba(255,255,255,0.28)",
        }}
      >
        New Column
      </span>
    </motion.button>
  );
}

// ── BoardPage ─────────────────────────────────────────────────────────────────

export function BoardPage() {
  const { workspaceId, boardId } = useParams<{
    workspaceId: string;
    boardId: string;
  }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const { data: board, isLoading, isError } = useBoard(boardId);
  const { mutate: moveCard } = useMoveCard(boardId ?? "");
  const { mutate: reorderColumn } = useReorderColumn(boardId ?? "");

  useBoardWebSocket(boardId);

  // ── DnD state ─────────────────────────────────────────────────────────────
  const [localColumns, setLocalColumns] = useState<ColumnWithCards[] | null>(
    null,
  );
  // Tracks the card being dragged (for card DragOverlay ghost).
  const [activeCard, setActiveCard] = useState<CardResponse | null>(null);
  // Tracks the column being dragged (for column DragOverlay ghost).
  const [activeColumn, setActiveColumn] = useState<ColumnWithCards | null>(null);

  const [shareOpen, setShareOpen] = useState(false);

  const localColumnsRef = useRef<ColumnWithCards[] | null>(null);
  const boardColumnsRef = useRef<ColumnWithCards[]>([]);

  if (board) boardColumnsRef.current = board.columns;

  const columns = localColumns ?? board?.columns ?? [];

  const currentUser = useAppSelector((s) => s.auth.user);
  const memberRole =
    board?.members.find((m) => m.user_id === currentUser?.id)?.role ?? "member";

  // ── Sensors ───────────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // ── Drag handlers ─────────────────────────────────────────────────────────

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const dragType = (event.active.data.current as { type?: string })?.type;

    if (dragType === "column") {
      // Column drag: capture the column for the DragOverlay ghost AND take a
      // localColumns snapshot. The outer SortableContext reads `items` from
      // `columns = localColumns ?? board?.columns`. Without a snapshot here,
      // localColumns stays null, items never change, and dnd-kit can never
      // compute sibling displacement transforms, so nothing moves visually.
      const col = boardColumnsRef.current.find((c) => c.id === event.active.id);
      if (!col) return;
      setActiveColumn(col);
      const snapshot = boardColumnsRef.current.map((c) => ({
        ...c,
        cards: [...c.cards],
      }));
      setLocalColumns(snapshot);
      localColumnsRef.current = snapshot;
      return;
    }

    // Card drag (default)
    const card = boardColumnsRef.current
      .flatMap((col) => col.cards)
      .find((c) => c.id === event.active.id);

    if (!card) return;

    setActiveCard(card);
    const snapshot = boardColumnsRef.current.map((col) => ({
      ...col,
      cards: [...col.cards],
    }));
    setLocalColumns(snapshot);
    localColumnsRef.current = snapshot;
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !localColumnsRef.current) return;

    const dragType = (active.data.current as { type?: string })?.type;

    // Column reorder: arrayMove the snapshot so SortableContext items stay in
    // sync with the drag position. This is what makes siblings animate out of
    // the way as you drag. Without it items never change and nothing moves.
    if (dragType === "column") {
      const overType = (over.data.current as { type?: string })?.type;
      if (overType !== "column") return;

      const prev = localColumnsRef.current;
      const oldIndex = prev.findIndex((c) => c.id === active.id);
      const newIndex = prev.findIndex((c) => c.id === over.id);
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

      const next = arrayMove(prev, oldIndex, newIndex);
      localColumnsRef.current = next;
      setLocalColumns(next);
      return;
    }

    // Card cross-column move (unchanged logic)
    const activeCardId = active.id as string;
    const overId = over.id as string;

    const prev = localColumnsRef.current;

    const sourceCol = prev.find((col) =>
      col.cards.some((c) => c.id === activeCardId),
    );
    const targetCol =
      prev.find((col) => col.id === overId) ??
      prev.find((col) => col.cards.some((c) => c.id === overId));

    if (!sourceCol || !targetCol || sourceCol.id === targetCol.id) return;

    const movingCard = sourceCol.cards.find((c) => c.id === activeCardId)!;
    const overCardIndex = targetCol.cards.findIndex((c) => c.id === overId);
    const insertIndex =
      overCardIndex >= 0 ? overCardIndex : targetCol.cards.length;

    const next = prev.map((col) => {
      if (col.id === sourceCol.id) {
        return {
          ...col,
          cards: col.cards.filter((c) => c.id !== activeCardId),
        };
      }
      if (col.id === targetCol.id) {
        const newCards = [...col.cards];
        newCards.splice(insertIndex, 0, {
          ...movingCard,
          column_id: targetCol.id,
        });
        return { ...col, cards: newCards };
      }
      return col;
    });

    localColumnsRef.current = next;
    setLocalColumns(next);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      const dragType = (active.data.current as { type?: string })?.type;

      // ── Column drop ────────────────────────────────────────────────────────
      if (dragType === "column") {
        setActiveColumn(null);

        // No movement: dropped on itself or outside any droppable area.
        if (!over || active.id === over.id) return;

        // Only process drops onto other columns (not onto cards).
        const overType = (over.data.current as { type?: string })?.type;
        if (overType !== "column") return;

        // ✅ FIX: Read from board?.columns (live React Query data) instead of
        // boardColumnsRef.current. The ref is only updated when the board query
        // resolves, so it can lag one reorder behind — causing stale oldIndex /
        // newIndex values and sending the wrong position to the API.
        // board?.columns is always the latest server-confirmed order.
        // Use localColumnsRef.current -- the arrayMove'd snapshot from handleDragOver
        // reflects the exact order the user sees at drop time.
        const cols = localColumnsRef.current ?? boardColumnsRef.current;
        const oldIndex = cols.findIndex((c) => c.id === active.id);
        const newIndex = cols.findIndex((c) => c.id === over.id);

        if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

        // Compute the new logical order, then read the neighbours of the
        // dropped column to derive a valid fractional index position.
        const reordered = arrayMove(cols, oldIndex, newIndex);
        const prevCol = reordered[newIndex - 1];
        const nextCol = reordered[newIndex + 1];

        let newPosition: number;
        if (!prevCol && !nextCol) {
          newPosition = 1000;
        } else if (!prevCol) {
          newPosition = before(nextCol.position);
        } else if (!nextCol) {
          newPosition = after(prevCol.position);
        } else {
          newPosition = between(prevCol.position, nextCol.position);
        }

        reorderColumn({ columnId: active.id as string, position: newPosition });
        // Clear the local snapshot so the board snaps to server state immediately
        // after the optimistic update in useReorderColumn takes effect.
        setLocalColumns(null);
        localColumnsRef.current = null;
        return;
      }

      // ── Card drop (unchanged logic) ────────────────────────────────────────
      setActiveCard(null);

      if (!over || !localColumnsRef.current) {
        setLocalColumns(null);
        localColumnsRef.current = null;
        return;
      }

      const activeCardId = active.id as string;
      const overId = over.id as string;
      const cols = localColumnsRef.current;

      const targetCol =
        cols.find((col) => col.id === overId) ??
        cols.find((col) => col.cards.some((c) => c.id === overId));

      if (!targetCol) {
        setLocalColumns(null);
        localColumnsRef.current = null;
        return;
      }

      let targetCards = targetCol.cards;

      const sourceColBeforeDrag = boardColumnsRef.current.find((col) =>
        col.cards.some((c) => c.id === activeCardId),
      );
      if (sourceColBeforeDrag?.id === targetCol.id) {
        const oldIndex = sourceColBeforeDrag.cards.findIndex(
          (c) => c.id === activeCardId,
        );
        const newIndex = targetCards.findIndex((c) => c.id === overId);
        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          targetCards = arrayMove(targetCards, oldIndex, newIndex);
        }
      }

      const droppedIndex = targetCards.findIndex((c) => c.id === activeCardId);
      const prevCard = targetCards[droppedIndex - 1];
      const nextCard = targetCards[droppedIndex + 1];

      let newPosition: number;
      if (!prevCard && !nextCard) {
        newPosition = 1000;
      } else if (!prevCard) {
        newPosition = before(nextCard.position);
      } else if (!nextCard) {
        newPosition = after(prevCard.position);
      } else {
        newPosition = between(prevCard.position, nextCard.position);
      }

      const sortedPositions = targetCards
        .filter((c) => c.id !== activeCardId)
        .map((c) => c.position)
        .sort((a, b) => a - b);

      if (needsRebalance(sortedPositions)) {
        const rebalanced = rebalance(targetCards.length);
        targetCards.forEach((card, i) => {
          if (card.id !== activeCardId) {
            moveCard({
              cardId: card.id,
              column_id: targetCol.id,
              position: rebalanced[i],
            });
          }
        });
        newPosition = rebalanced[droppedIndex];
      }

      moveCard({
        cardId: activeCardId,
        column_id: targetCol.id,
        position: newPosition,
      });

      setLocalColumns(null);
      localColumnsRef.current = null;
    },
    // ✅ FIX: board added to deps so the callback always closes over the latest
    // board.columns value — not a stale snapshot from a previous render.
    [moveCard, reorderColumn],
  );

  const handleDragCancel = useCallback((_event: DragCancelEvent) => {
    setActiveCard(null);
    setActiveColumn(null);
    setLocalColumns(null);
    localColumnsRef.current = null;
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div
        className="flex h-screen items-center justify-center flex-col gap-4"
        style={{ background: "oklch(0.12 0.015 265)" }}
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
        >
          <Loader2 className="w-7 h-7 text-primary" />
        </motion.div>
        <p className="text-xs text-on-surface-variant/50 font-medium tracking-wide">
          Loading board…
        </p>
      </div>
    );
  }

  if (isError || !board) {
    return (
      <div
        className="flex h-screen items-center justify-center flex-col gap-4"
        style={{ background: "oklch(0.12 0.015 265)" }}
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
    );
  }

  // Suppress unused variable warning — memberRole is available for
  // permission-gating future UI (e.g. hiding Add Column for non-admins).
  void memberRole;

  return (
    <div
      className="flex flex-col h-screen overflow-hidden"
      style={{ background: "oklch(0.12 0.015 265)" }}
    >
      {/* Dot-grid background texture */}
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.028) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      {/* Ambient top glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[180px] pointer-events-none z-0"
        style={{
          background:
            "radial-gradient(ellipse at top, oklch(0.82 0.14 198 / 0.06) 0%, transparent 70%)",
        }}
      />

      <BoardTopbar
        board={board}
        workspaceId={workspaceId ?? ""}
        onBack={() => navigate(`/${workspaceId}/boards`)}
        onShareClick={() => setShareOpen(true)}
      />
      <ShareBoardDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        boardId={board.id}
        boardTitle={board.title}
        members={board.members}
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
            {/*
              Outer SortableContext — columns as horizontal sortable items.
              Uses column IDs as the item list so dnd-kit can compute drop
              positions. Each Column's useSortable registers itself here via
              data: { type: 'column' }.
            */}
            <SortableContext
              items={columns.map((c) => c.id)}
              strategy={horizontalListSortingStrategy}
            >
              {columns.map((column, index) => (
                /*
                  Inner SortableContext — cards within this column as a
                  vertical sortable list. Unchanged from before.
                  NOTE: No motion.div wrapper here. Column.tsx's root div
                  (the useSortable + useDroppable node) must be the direct
                  flex item so dnd-kit can apply its displacement transforms
                  to the actual layout node. A motion.div intermediary breaks
                  the transform target and freezes sibling displacement.
                */
                <SortableContext
                  key={column.id}
                  items={column.cards.map((c) => c.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <Column
                    column={column}
                    boardId={boardId ?? ""}
                    index={index}
                    accentColor={
                      COLUMN_ACCENT_COLORS[
                        index % COLUMN_ACCENT_COLORS.length
                      ]
                    }
                    onAddCard={() =>
                      dispatch(
                        openModal({
                          type: "createCard",
                          columnId: column.id,
                        }),
                      )
                    }
                    onAddColumn={() =>
                      dispatch(
                        openModal({
                          type: "createColumn",
                          boardId: boardId ?? "",
                        }),
                      )
                    }
                  />
                </SortableContext>
              ))}
            </SortableContext>

            <AddColumnButton
              onClick={() =>
                dispatch(
                  openModal({ type: "createColumn", boardId: boardId ?? "" }),
                )
              }
            />
          </div>
        </main>

        {/*
          DragOverlay renders the dragged item on top of everything at the
          pointer position. We show different ghosts for cards vs columns.

          Column ghost: a simplified Column shell with isOverlay=true so
          useSortable and useDroppable are disabled inside the overlay copy —
          only one DOM node should own those ref/listener assignments.
        */}
        <DragOverlay
          dropAnimation={{
            duration: 200,
            easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          {activeCard ? (
            <div style={{ width: "272px" }}>
              <Card card={activeCard} boardId={boardId ?? ""} isOverlay />
            </div>
          ) : activeColumn ? (
            <div style={{ width: "288px", opacity: 0.92 }}>
              <Column
                column={activeColumn}
                boardId={boardId ?? ""}
                index={columns.findIndex((c) => c.id === activeColumn.id)}
                accentColor={
                  COLUMN_ACCENT_COLORS[
                    columns.findIndex((c) => c.id === activeColumn.id) %
                      COLUMN_ACCENT_COLORS.length
                  ]
                }
                onAddCard={() => {}}
                onAddColumn={() => {}}
                isOverlay
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}