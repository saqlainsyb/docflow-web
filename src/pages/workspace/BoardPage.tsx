// src/pages/workspace/BoardPage.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Pragmatic DnD replacement for dnd-kit's DndContext / SortableContext.
//
// Architecture (per SKILL.md "Golden Rule"):
//   monitorForElements lives HERE — this is the ONLY place that calls moveCard
//   or reorderColumn. Card and Column components contain only draggable() and
//   dropTargetForElements() registrations; they never mutate board state.
//
// Drag flow:
//   1. User grabs a card or column header.
//   2. Card/Column component sets its own local drag state (ghost placeholder,
//      opacity dim, drop indicator). Zero parent re-renders during motion.
//   3. On drop, monitorForElements fires onDrop once.
//   4. We resolve the new fractional position using the same logic as before
//      (before / between / after) and call moveCard / reorderColumn.
//   5. Both hooks apply optimistic updates to the TanStack Query cache, so the
//      UI is instant with no snap-back.
//
// Custom drag preview (ghost that follows the cursor):
//   We use setCustomNativeDragPreview + inline styles (not Tailwind, not
//   oklch) because the preview renders in a detached DOM node outside the
//   React tree where CSS variables and JIT classes are unavailable.
//   The preview is a dark glassmorphism card/column ghost.
//
// What's REMOVED vs the dnd-kit version:
//   - DndContext, DragOverlay, SortableContext — gone entirely
//   - localColumns / localColumnsRef — gone (Pragmatic DnD doesn't need
//     optimistic DOM reordering; the monitor fires once at drop time)
//   - handleDragStart / handleDragOver / handleDragEnd / handleDragCancel —
//     replaced by a single monitorForElements({ onDrop }) effect
//   - activeCard / activeColumn state — gone (preview handled natively)
//
// What's UNCHANGED:
//   - All UI: BoardTopbar, AddColumnButton, the full board shell, all dialogs
//   - All hooks: useMoveCard, useReorderColumn, useBoardWebSocket
//   - Fractional indexing logic (before/between/after/needsRebalance/rebalance)
//   - Permission gating, member avatars, archive/members/share dialogs
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  monitorForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { extractClosestEdge }
  from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import { getReorderDestinationIndex }
  from "@atlaskit/pragmatic-drag-and-drop-hitbox/util/get-reorder-destination-index";
import { setCustomNativeDragPreview }
  from "@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview";
import { pointerOutsideOfPreview }
  from "@atlaskit/pragmatic-drag-and-drop/element/pointer-outside-of-preview";
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
  ShieldCheck,
  Eye,
  ArchiveRestore,
} from "lucide-react";
import { motion } from "motion/react";
import { useAppDispatch } from "@/store/hooks";
import { openModal } from "@/store";
import { useBoard } from "@/hooks/useBoard";
import { useMoveCard } from "@/hooks/useMoveCard";
import { useReorderColumn } from "@/hooks/useReorderColumn";
import { useBoardWebSocket } from "@/hooks/useBoardWebSocket";
import { useUpdateBoard } from "@/hooks/useUpdateBoard";
import { useDeleteBoard } from "@/hooks/useDeleteBoard";
import { useBoardPermissions } from "@/hooks/useBoardPermissions";
import { Column } from "@/components/board/Column";
import { isCardData, isColumnData } from "@/types/dnd";
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
import { BoardMembersDialog } from "@/components/board/BoardMembersDialog";
import { ArchivedCardsDrawer } from "@/components/board/ArchivedCardsDrawer";

// ── Design tokens ─────────────────────────────────────────────────────────────

const COLUMN_ACCENT_COLORS = [
  { dot: "#00DAF3", glow: "rgba(0,218,243,0.18)" },
  { dot: "#A78BFA", glow: "rgba(167,139,250,0.18)" },
  { dot: "#34D399", glow: "rgba(52,211,153,0.18)" },
  { dot: "#FB923C", glow: "rgba(251,146,60,0.18)" },
  { dot: "#60A5FA", glow: "rgba(96,165,250,0.18)" },
  { dot: "#F472B6", glow: "rgba(244,114,182,0.18)" },
];

const DIALOG_CONTENT_STYLE = {
  background:
    "linear-gradient(160deg, oklch(0.175 0.018 265) 0%, oklch(0.155 0.014 265) 100%)",
  border: "1px solid rgba(255,255,255,0.08)",
  boxShadow: "0 32px 64px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04)",
  borderRadius: "1.25rem",
};

function boardRoleLabel(role: string): string {
  if (role === "owner") return "Owner";
  if (role === "admin") return "Admin";
  return "Editor";
}

function BoardRoleIcon({ role }: { role: string }) {
  if (role === "owner") return <ShieldCheck className="w-2.5 h-2.5" />;
  if (role === "admin") return <ShieldCheck className="w-2.5 h-2.5" />;
  return <Eye className="w-2.5 h-2.5" />;
}

// ── BoardTopbar ───────────────────────────────────────────────────────────────

interface BoardTopbarProps {
  board: BoardDetailResponse;
  workspaceId: string;
  onBack: () => void;
  onShareClick: () => void;
  onMembersClick: () => void;
  onArchiveClick: () => void;
  archivedCount?: number;
}

function BoardTopbar({
  board,
  workspaceId,
  onBack,
  onShareClick,
  onMembersClick,
  onArchiveClick,
  archivedCount,
}: BoardTopbarProps) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(board.title);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const { mutate: updateBoard, isPending: isRenaming } = useUpdateBoard(board.id);
  const { mutate: deleteBoard, isPending: isDeleting } = useDeleteBoard(board.id, workspaceId);
  const perms = useBoardPermissions(board.my_board_role);

  const visibleMembers = board.members.slice(0, 4);
  const overflowCount = board.members.length - visibleMembers.length;
  const totalCards = board.columns.reduce((acc, col) => acc + col.cards.length, 0);
  const isPublic = board.visibility === "workspace";

  const hasAnyMenuItems = perms.canRename || perms.canChangeVisibility || perms.canDelete;

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

          <div className="w-px h-6 bg-white/8 shrink-0" />

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
                  background: isPublic ? "rgba(52,211,153,0.10)" : "rgba(255,255,255,0.06)",
                  border: isPublic ? "1px solid rgba(52,211,153,0.20)" : "1px solid rgba(255,255,255,0.08)",
                  color: isPublic ? "#34D399" : "rgba(255,255,255,0.4)",
                }}
              >
                {isPublic ? <Globe className="w-2.5 h-2.5" /> : <Lock className="w-2.5 h-2.5" />}
                {board.visibility}
              </span>

              {/* My board role pill */}
              <span
                className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "rgba(255,255,255,0.38)",
                }}
              >
                {boardRoleLabel(board.my_board_role)}
              </span>
            </div>

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
          {visibleMembers.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2.5">
                {visibleMembers.map((member, i) => (
                  <motion.div
                    key={member.user_id}
                    initial={{ opacity: 0, scale: 0.7, x: 8 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    transition={{ delay: i * 0.06, type: "spring", stiffness: 400, damping: 22 }}
                    title={`${member.name} · ${boardRoleLabel(member.board_role)}`}
                    className={cn(
                      "w-8 h-8 rounded-full shrink-0",
                      "flex items-center justify-center text-[9px] font-bold select-none cursor-default",
                    )}
                    style={{
                      background: "oklch(0.38 0.16 285)",
                      color: "oklch(0.88 0.08 285)",
                      border: "2px solid oklch(0.13 0.015 265)",
                      boxShadow: "0 0 0 1px rgba(255,255,255,0.06)",
                    }}
                  >
                    {member.avatar_url ? (
                      <img src={member.avatar_url} alt={member.name} className="w-full h-full rounded-full object-cover" />
                    ) : (
                      getInitials(member.name)
                    )}
                  </motion.div>
                ))}
              </div>

              {overflowCount > 0 && (
                <span className="text-[11px] font-bold" style={{ color: "rgba(255,255,255,0.4)" }}>
                  +{overflowCount} more
                </span>
              )}

              <span className="flex items-center gap-1 text-[11px]" style={{ color: "rgba(255,255,255,0.3)" }}>
                <Users className="w-2.75 h-2.75" />
                {board.members.length}
              </span>
            </div>
          )}

          <div className="w-px h-5 bg-white/8" />

          {/* Archive */}
          <motion.button
            onClick={onArchiveClick}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 450, damping: 25 }}
            className={cn(
              "relative flex items-center gap-2 px-3.5 py-2 rounded-xl text-[12px] font-bold",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 transition-colors",
            )}
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.09)",
              color: "rgba(255,255,255,0.55)",
            }}
          >
            <ArchiveRestore className="w-3.5 h-3.5" />
            Archive
            {archivedCount !== undefined && archivedCount > 0 && (
              <span
                className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center"
                style={{
                  background: "oklch(0.42 0.09 198)",
                  color: "oklch(0.91 0.015 265)",
                  border: "1.5px solid oklch(0.155 0.016 265)",
                }}
              >
                {archivedCount > 99 ? "99+" : archivedCount}
              </span>
            )}
          </motion.button>

          {/* Members */}
          <motion.button
            onClick={onMembersClick}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 450, damping: 25 }}
            className={cn(
              "flex items-center gap-2 px-3.5 py-2 rounded-xl text-[12px] font-bold",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 transition-colors",
            )}
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.09)",
              color: "rgba(255,255,255,0.55)",
            }}
          >
            <Users className="w-3.5 h-3.5" />
            Members
          </motion.button>

          {/* Share — owner + admin only */}
          {perms.canManageShareLink && (
            <motion.button
              onClick={onShareClick}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", stiffness: 450, damping: 25 }}
              className={cn(
                "flex items-center gap-2 px-3.5 py-2 rounded-xl text-[12px] font-bold",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 transition-colors",
              )}
              style={{
                background: "linear-gradient(135deg, oklch(0.82 0.14 198 / 0.15) 0%, oklch(0.42 0.09 198 / 0.10) 100%)",
                border: "1px solid oklch(0.82 0.14 198 / 0.22)",
                color: "oklch(0.82 0.14 198)",
              }}
            >
              <Share2 className="w-3.5 h-3.5" />
              Share
            </motion.button>
          )}

          {/* Board ⋯ menu */}
          {hasAnyMenuItems && (
            <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
              <DropdownMenuTrigger asChild>
                <motion.button
                  whileHover={{ scale: 1.06 }}
                  whileTap={{ scale: 0.94 }}
                  transition={{ type: "spring", stiffness: 450, damping: 25 }}
                  aria-label="Board options"
                  className={cn(
                    "w-9 h-9 flex items-center justify-center rounded-xl",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 transition-colors",
                  )}
                  style={{
                    background: menuOpen ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.05)",
                    border: menuOpen ? "1px solid rgba(255,255,255,0.14)" : "1px solid rgba(255,255,255,0.07)",
                    color: menuOpen ? "rgba(255,255,255,0.90)" : "rgba(255,255,255,0.55)",
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
                  background: "linear-gradient(160deg, oklch(0.19 0.018 265) 0%, oklch(0.16 0.014 265) 100%)",
                  border: "1px solid rgba(255,255,255,0.09)",
                  boxShadow: "0 16px 48px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.03)",
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
                <DropdownMenuSeparator style={{ background: "rgba(255,255,255,0.06)", margin: "4px 0" }} />

                {perms.canRename && (
                  <DropdownMenuItem
                    onClick={openRename}
                    className="gap-2.5 cursor-pointer rounded-lg text-[13px] font-medium py-2.5 px-2"
                    style={{ color: "rgba(255,255,255,0.72)" }}
                  >
                    <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.55)" }}>
                      <Pencil className="w-3.5 h-3.5" />
                    </div>
                    Rename board
                  </DropdownMenuItem>
                )}

                {perms.canChangeVisibility && (
                  <DropdownMenuItem
                    onClick={() => {
                      setMenuOpen(false);
                      updateBoard({ visibility: board.visibility === "workspace" ? "private" : "workspace" });
                    }}
                    className="gap-2.5 cursor-pointer rounded-lg text-[13px] font-medium py-2.5 px-2"
                    style={{ color: "rgba(255,255,255,0.72)" }}
                  >
                    <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.55)" }}>
                      {board.visibility === "workspace" ? <Lock className="w-3.5 h-3.5" /> : <Globe className="w-3.5 h-3.5" />}
                    </div>
                    Make {board.visibility === "workspace" ? "private" : "workspace"}
                  </DropdownMenuItem>
                )}

                {perms.canDelete && (
                  <>
                    <DropdownMenuSeparator style={{ background: "rgba(255,255,255,0.06)", margin: "4px 0" }} />
                    <DropdownMenuItem
                      onClick={() => { setMenuOpen(false); setDeleteOpen(true); }}
                      className="gap-2.5 cursor-pointer rounded-lg text-[13px] font-medium py-2.5 px-2"
                      style={{ color: "rgba(239,68,68,0.85)" }}
                    >
                      <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: "rgba(239,68,68,0.12)", color: "#EF4444" }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </div>
                      Delete board
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </motion.header>

      {/* Rename dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-sm p-0 overflow-hidden gap-0" style={DIALOG_CONTENT_STYLE}>
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle className="text-base font-bold" style={{ color: "oklch(0.93 0.012 265)", fontFamily: "var(--df-font-display)" }}>
              Rename board
            </DialogTitle>
            <DialogDescription className="text-[13px] mt-1" style={{ color: "rgba(255,255,255,0.38)" }}>
              Give this board a new name.
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 pb-2">
            <input
              ref={renameInputRef}
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") setRenameOpen(false); }}
              placeholder="Board name"
              maxLength={100}
              className="w-full rounded-xl px-3.5 py-2.5 text-sm font-medium outline-none transition-all"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", color: "oklch(0.91 0.015 265)" }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "oklch(0.82 0.14 198 / 0.45)"; e.currentTarget.style.boxShadow = "0 0 0 3px oklch(0.82 0.14 198 / 0.10)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)"; e.currentTarget.style.boxShadow = "none"; }}
            />
          </div>
          <DialogFooter className="px-6 pt-3 pb-5 flex gap-2 sm:gap-2">
            <button onClick={() => setRenameOpen(false)} disabled={isRenaming} className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold transition-all focus:outline-none disabled:opacity-50" style={{ border: "1px solid rgba(255,255,255,0.09)", color: "rgba(255,255,255,0.50)", background: "transparent" }}>
              Cancel
            </button>
            <button onClick={handleRename} disabled={isRenaming || !renameValue.trim() || renameValue.trim() === board.title} className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold transition-all focus:outline-none disabled:opacity-40" style={{ background: "linear-gradient(135deg, oklch(0.82 0.14 198 / 0.22) 0%, oklch(0.55 0.12 198 / 0.30) 100%)", border: "1px solid oklch(0.82 0.14 198 / 0.30)", color: "oklch(0.82 0.14 198)" }}>
              {isRenaming ? <span className="inline-flex items-center gap-1.5 justify-center"><Loader2 className="w-3.5 h-3.5 animate-spin" />Saving…</span> : "Rename"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      {perms.canDelete && (
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent className="sm:max-w-sm p-0 overflow-hidden gap-0" style={DIALOG_CONTENT_STYLE}>
            <DialogHeader className="px-6 pt-6 pb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.20)" }}>
                <Trash2 className="w-5 h-5" style={{ color: "#EF4444" }} />
              </div>
              <DialogTitle className="text-base font-bold" style={{ color: "oklch(0.93 0.012 265)", fontFamily: "var(--df-font-display)" }}>
                Delete "{board.title}"?
              </DialogTitle>
              <DialogDescription className="text-[13px] mt-1 leading-relaxed" style={{ color: "rgba(255,255,255,0.38)" }}>
                This will permanently delete the board, all its columns, cards, and documents. This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="px-6 pt-2 pb-5 flex gap-2 sm:gap-2">
              <button onClick={() => setDeleteOpen(false)} disabled={isDeleting} className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold transition-all focus:outline-none disabled:opacity-50" style={{ border: "1px solid rgba(255,255,255,0.09)", color: "rgba(255,255,255,0.50)", background: "transparent" }}>
                Cancel
              </button>
              <button onClick={handleDelete} disabled={isDeleting} className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold transition-all focus:outline-none disabled:opacity-70" style={{ background: "oklch(0.55 0.22 25)", border: "1px solid rgba(239,68,68,0.30)", color: "white" }}>
                {isDeleting ? <span className="inline-flex items-center gap-1.5 justify-center"><Loader2 className="w-3.5 h-3.5 animate-spin" />Deleting…</span> : "Delete board"}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
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
        "rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 transition-all",
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
          background: hovered ? "oklch(0.82 0.14 198 / 0.12)" : "rgba(255,255,255,0.05)",
          border: hovered ? "1px solid oklch(0.82 0.14 198 / 0.25)" : "1px solid rgba(255,255,255,0.07)",
        }}
      >
        <Plus
          className="w-5 h-5 transition-colors"
          style={{ color: hovered ? "oklch(0.82 0.14 198)" : "rgba(255,255,255,0.35)" }}
        />
      </motion.div>
      <span
        className="text-[11px] font-bold uppercase tracking-[0.12em] transition-colors"
        style={{ color: hovered ? "oklch(0.82 0.14 198)" : "rgba(255,255,255,0.28)" }}
      >
        New Column
      </span>
    </motion.button>
  );
}

// ── BoardPage ─────────────────────────────────────────────────────────────────

export function BoardPage() {
  const { workspaceId, boardId } = useParams<{ workspaceId: string; boardId: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const { data: board, isLoading, isError } = useBoard(boardId);
  const { mutate: moveCard } = useMoveCard(boardId ?? "");
  const { mutate: reorderColumn } = useReorderColumn(boardId ?? "");

  useBoardWebSocket(boardId);

  const perms = useBoardPermissions(board?.my_board_role);

  const [shareOpen, setShareOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  // We keep a ref to the latest columns from the query so the monitor closure
  // always sees up-to-date data without being a stale closure.
  const boardColumnsRef = useRef<ColumnWithCards[]>([]);
  if (board) boardColumnsRef.current = board.columns;

  // ── Board-level DnD monitor ────────────────────────────────────────────────
  // This is the SINGLE place that mutates board state.
  // Per SKILL.md: card/column components ONLY register draggable() and
  // dropTargetForElements(); they NEVER call state setters from drag events.
  useEffect(() => {
    return monitorForElements({
      onDrop({ source, location }) {
        const destination = location.current.dropTargets[0];
        if (!destination) return; // dropped outside any registered target

        const sourceData = source.data;
        const destData = destination.data;
        const cols = boardColumnsRef.current;

        // ── Card dropped ────────────────────────────────────────────────────
        if (isCardData(sourceData)) {
          const sourceCardId = sourceData.cardId;
          const sourceColumnId = sourceData.columnId;

          // ── Card → Card: reorder in same column or move cross-column ──────
          if (isCardData(destData)) {
            const destColumnId = destData.columnId;
            const closestEdge = extractClosestEdge(destData);

            const sourceCol = cols.find((c) => c.id === sourceColumnId);
            const destCol = cols.find((c) => c.id === destColumnId);
            if (!sourceCol || !destCol) return;

            const sourceIndex = sourceCol.cards.findIndex((c) => c.id === sourceCardId);
            const destIndex = destCol.cards.findIndex((c) => c.id === destData.cardId);
            if (sourceIndex === -1 || destIndex === -1) return;

            if (sourceColumnId === destColumnId) {
              // Same-column reorder
              const targetIndex = getReorderDestinationIndex({
                startIndex: sourceIndex,
                indexOfTarget: destIndex,
                closestEdgeOfTarget: closestEdge,
                axis: "vertical",
              });
              if (targetIndex === sourceIndex) return; // no-op

              // Build the new ordered array to compute fractional position
              const newCards = [...sourceCol.cards];
              const [movedCard] = newCards.splice(sourceIndex, 1);
              newCards.splice(targetIndex, 0, movedCard);

              const prevCard = newCards[targetIndex - 1];
              const nextCard = newCards[targetIndex + 1];

              let newPosition: number;
              if (!prevCard && !nextCard) newPosition = 1000;
              else if (!prevCard) newPosition = before(nextCard.position);
              else if (!nextCard) newPosition = after(prevCard.position);
              else newPosition = between(prevCard.position, nextCard.position);

              // Rebalance if positions have collapsed too close together
              const sortedPositions = newCards
                .filter((c) => c.id !== sourceCardId)
                .map((c) => c.position)
                .sort((a, b) => a - b);

              if (needsRebalance(sortedPositions)) {
                const rebalanced = rebalance(newCards.length);
                newCards.forEach((card, i) => {
                  if (card.id !== sourceCardId) {
                    moveCard({ cardId: card.id, column_id: sourceColumnId, position: rebalanced[i] });
                  }
                });
                newPosition = rebalanced[targetIndex];
              }

              moveCard({ cardId: sourceCardId, column_id: sourceColumnId, position: newPosition });

            } else {
              // Cross-column move — insert at closest edge of target card
              const insertAt = closestEdge === "bottom" ? destIndex + 1 : destIndex;
              const newDestCards = [...destCol.cards];
              const movingCard = sourceCol.cards[sourceIndex];
              newDestCards.splice(insertAt, 0, movingCard);

              const prevCard = newDestCards[insertAt - 1];
              const nextCard = newDestCards[insertAt + 1];

              let newPosition: number;
              if (!prevCard && !nextCard) newPosition = 1000;
              else if (!prevCard) newPosition = before(nextCard.position);
              else if (!nextCard) newPosition = after(prevCard.position);
              else newPosition = between(prevCard.position, nextCard.position);

              moveCard({ cardId: sourceCardId, column_id: destColumnId, position: newPosition });
            }
            return;
          }

          // ── Card → Column: append to end of target column ─────────────────
          if (isColumnData(destData)) {
            const destColumnId = destData.columnId;
            if (sourceColumnId === destColumnId) return; // no-op

            const destCol = cols.find((c) => c.id === destColumnId);
            if (!destCol) return;

            const lastCard = destCol.cards[destCol.cards.length - 1];
            const newPosition = lastCard ? after(lastCard.position) : 1000;
            moveCard({ cardId: sourceCardId, column_id: destColumnId, position: newPosition });
          }
        }

        // ── Column dropped → reorder columns ──────────────────────────────────
        if (isColumnData(sourceData) && isColumnData(destData)) {
          const sourceIndex = cols.findIndex((c) => c.id === sourceData.columnId);
          const destIndex = cols.findIndex((c) => c.id === destData.columnId);
          if (sourceIndex === -1 || destIndex === -1 || sourceIndex === destIndex) return;

          // Compute new fractional position at the destination slot
          const reordered = [...cols];
          const [movedCol] = reordered.splice(sourceIndex, 1);
          reordered.splice(destIndex, 0, movedCol);

          const prevCol = reordered[destIndex - 1];
          const nextCol = reordered[destIndex + 1];

          let newPosition: number;
          if (!prevCol && !nextCol) newPosition = 1000;
          else if (!prevCol) newPosition = before(nextCol.position);
          else if (!nextCol) newPosition = after(prevCol.position);
          else newPosition = between(prevCol.position, nextCol.position);

          reorderColumn({ columnId: sourceData.columnId, position: newPosition });
        }
      },
    });
  }, [moveCard, reorderColumn]);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center flex-col gap-4" style={{ background: "oklch(0.12 0.015 265)" }}>
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}>
          <Loader2 className="w-7 h-7 text-primary" />
        </motion.div>
        <p className="text-xs text-on-surface-variant/50 font-medium tracking-wide">Loading board…</p>
      </div>
    );
  }

  if (isError || !board) {
    return (
      <div className="flex h-screen items-center justify-center flex-col gap-4" style={{ background: "oklch(0.12 0.015 265)" }}>
        <p className="text-on-surface-variant text-sm">Board not found or you don't have access.</p>
        <button onClick={() => navigate(`/${workspaceId}/boards`)} className="text-primary text-sm hover:underline focus:outline-none">
          ← Back to boards
        </button>
      </div>
    );
  }

  const columns = board.columns;

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: "oklch(0.12 0.015 265)" }}>
      {/* Dot-grid background */}
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.028) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
      {/* Ambient top glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[180px] pointer-events-none z-0"
        style={{ background: "radial-gradient(ellipse at top, oklch(0.82 0.14 198 / 0.06) 0%, transparent 70%)" }}
      />

      <BoardTopbar
        board={board}
        workspaceId={workspaceId ?? ""}
        onBack={() => navigate(`/${workspaceId}/boards`)}
        onShareClick={() => setShareOpen(true)}
        onMembersClick={() => setMembersOpen(true)}
        onArchiveClick={() => setArchiveOpen(true)}
      />

      <ShareBoardDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        boardId={board.id}
        boardTitle={board.title}
        myBoardRole={board.my_board_role}
      />
      <BoardMembersDialog
        open={membersOpen}
        onOpenChange={setMembersOpen}
        boardId={board.id}
        boardTitle={board.title}
        workspaceId={board.workspace_id}
        members={board.members}
        myBoardRole={board.my_board_role}
      />
      <ArchivedCardsDrawer
        boardId={board.id}
        open={archiveOpen}
        onClose={() => setArchiveOpen(false)}
      />

      <main className="flex-1 overflow-x-auto overflow-y-hidden relative z-10">
        <div className="flex gap-4 p-6 h-full items-start min-w-max">
          {columns.map((column, index) => (
            <Column
              key={column.id}
              column={column}
              boardId={boardId ?? ""}
              index={index}
              accentColor={COLUMN_ACCENT_COLORS[index % COLUMN_ACCENT_COLORS.length]}
              onAddCard={() =>
                dispatch(openModal({ type: "createCard", columnId: column.id }))
              }
              onAddColumn={() =>
                dispatch(openModal({ type: "createColumn", boardId: boardId ?? "" }))
              }
            />
          ))}

          {perms.canCreateContent && (
            <AddColumnButton
              onClick={() =>
                dispatch(openModal({ type: "createColumn", boardId: boardId ?? "" }))
              }
            />
          )}
        </div>
      </main>
    </div>
  );
}