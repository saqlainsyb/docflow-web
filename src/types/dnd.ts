// src/types/dnd.ts
// ─────────────────────────────────────────────────────────────────────────────
// Typed drag data + type guards for Pragmatic DnD.
// Every draggable element in the kanban board carries one of these shapes as
// its "initial data". The type guards are used in both drop targets (canDrop)
// and the board-level monitor (onDrop) to narrow safely without unsafe casts.
// ─────────────────────────────────────────────────────────────────────────────

export type CardDragData = {
  type: 'card'
  cardId: string
  columnId: string
}

export type ColumnDragData = {
  type: 'column'
  columnId: string
}

export type DragData = CardDragData | ColumnDragData

export function isCardData(data: Record<string, unknown>): data is CardDragData {
  return data.type === 'card'
}

export function isColumnData(data: Record<string, unknown>): data is ColumnDragData {
  return data.type === 'column'
}