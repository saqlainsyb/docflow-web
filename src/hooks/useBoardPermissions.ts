// src/hooks/useBoardPermissions.ts
// ─────────────────────────────────────────────────────────────────────────────
// Derives all UI permission flags from the caller's resolved board role.
//
// Usage:
//   const { data: board } = useBoard(boardId)
//   const perms = useBoardPermissions(board?.my_board_role)
//
// All flags default to false when myBoardRole is undefined (i.e. board
// is still loading). Components that depend on these stay hidden/disabled
// during the initial load rather than briefly flashing the wrong state.
//
// Rules mirror the backend service exactly:
//   owner  — full control
//   admin  — manage members (editors only), rename, share link
//   editor — create columns and cards only
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo } from 'react'
import type { BoardRole } from '@/lib/types'

export interface BoardPermissions {
  // Board settings
  canRename: boolean
  canChangeVisibility: boolean
  canDelete: boolean
  canManageShareLink: boolean

  // Member management
  canManageMembers: boolean  // add/remove members
  canGrantAdmin: boolean     // only owner can add admins or promote to admin
  canRemoveAdmins: boolean   // only owner can remove other admins

  // Ownership
  canTransferOwnership: boolean

  // Content (columns + cards)
  canCreateContent: boolean  // true for all roles
}

export function useBoardPermissions(myBoardRole: BoardRole | string | undefined): BoardPermissions {
  return useMemo(() => {
    const isOwner = myBoardRole === 'owner'
    const isAdmin = myBoardRole === 'admin'
    const isEditor = myBoardRole === 'editor'
    const hasAccess = isOwner || isAdmin || isEditor

    return {
      // Rename: owner + admin
      canRename: isOwner || isAdmin,

      // Visibility change: owner only (affects who can see the board)
      canChangeVisibility: isOwner,

      // Delete: owner only
      canDelete: isOwner,

      // Share link: owner + admin
      canManageShareLink: isOwner || isAdmin,

      // Add/remove members: owner + admin
      // (admins can only manage editors, enforced server-side)
      canManageMembers: isOwner || isAdmin,

      // Grant admin role: owner only
      canGrantAdmin: isOwner,

      // Remove admin: owner only
      canRemoveAdmins: isOwner,

      // Transfer ownership: owner only
      canTransferOwnership: isOwner,

      // Create columns + cards: all roles
      canCreateContent: hasAccess,
    }
  }, [myBoardRole])
}