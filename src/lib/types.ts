// src/lib/types.ts
// ─────────────────────────────────────────────────────────────────────────────
// All API-shaped types for Docflow.
// These mirror the backend DTOs exactly — if the backend changes a field,
// change it here first and TypeScript will surface every broken callsite.
//
// Rules:
// - No Zod here. Zod schemas live in validations.ts (form concerns).
// - No Redux here. Store types import FROM here, not the other way around.
// - Nullable fields use `string | null`, not `string | undefined` —
//   the backend sends explicit nulls, not missing keys.
// - All timestamps are ISO 8601 strings (Go's time.Time JSON encoding).
// ─────────────────────────────────────────────────────────────────────────────

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface User {
  id: string
  email: string
  name: string
  avatar_url: string | null
  created_at: string
}

export interface AuthResponse {
  user: User
  access_token: string
  // refresh_token arrives as an HttpOnly cookie — never in the response body
}

// ── Workspaces ────────────────────────────────────────────────────────────────

export type WorkspaceRole = 'owner' | 'admin' | 'member'

export interface MemberResponse {
  user_id: string
  name: string
  email: string
  avatar_url: string | null
  role: WorkspaceRole
  joined_at: string
}

export interface WorkspaceListItem {
  id: string
  name: string
  owner_id: string
  created_at: string
  updated_at: string
}

export interface WorkspaceDetail {
  id: string
  name: string
  owner_id: string
  members: MemberResponse[]
  created_at: string
}

// ── Boards ────────────────────────────────────────────────────────────────────

export type BoardVisibility = 'workspace' | 'private'

// The 6-color palette enforced at DB level (cards.color constraint)
export type CardColor =
  | '#EF4444'
  | '#F97316'
  | '#EAB308'
  | '#22C55E'
  | '#3B82F6'
  | '#A855F7'

export interface CardResponse {
  id: string
  board_id: string
  column_id: string
  title: string
  position: number
  color: CardColor | null
  assignee: User | null
  document_id: string
  archived: boolean
  created_at: string
}

export interface ColumnWithCards {
  id: string
  title: string
  position: number
  cards: CardResponse[]
}

export interface BoardListItem {
  id: string
  workspace_id: string
  title: string
  visibility: BoardVisibility
  member_count: number  // added: backend sends this in BoardResponse
  card_count: number    // added: backend sends this in BoardResponse
  created_at: string
  updated_at: string    // note: backend Board model has UpdatedAt
}

export interface BoardDetailResponse {
  id: string
  workspace_id: string      // added: backend sends this
  title: string
  visibility: BoardVisibility
  is_public_view: boolean   // added: backend sends this
  columns: ColumnWithCards[]
  members: MemberResponse[]
  created_at: string
}

export interface ShareLinkResponse {
  url: string
}

// ── Columns ───────────────────────────────────────────────────────────────────

export interface ColumnResponse {
  id: string
  board_id: string    // added: backend sends this in ColumnResponse
  title: string
  position: number
  created_at: string
}

// ── Cards ─────────────────────────────────────────────────────────────────────

export interface MoveCardRequest {
  column_id: string
  position: number
}

// ── Documents ─────────────────────────────────────────────────────────────────

export interface DocumentTokenResponse {
  token: string
  document_id: string
  color: string
  expires_in: number // always 3600
}

export interface DocumentSnapshotResponse {
  document_id: string
  snapshot: string // base64-encoded Yjs state — empty string for new documents
  clock: number
}

// ── Board WebSocket Events ────────────────────────────────────────────────────
// Received over /ws/boards/:boardId — JSON, not Yjs binary.
// Discriminated union on `type` so a switch statement is exhaustive.

export type BoardWSEvent =
  | { type: 'CARD_CREATED';    card: CardResponse }
  | { type: 'CARD_UPDATED';    card_id: string; changes: Partial<CardResponse> }
  | { type: 'CARD_MOVED';      card_id: string; column_id: string; position: number }
  | { type: 'CARD_ARCHIVED';   card_id: string }
  | { type: 'CARD_DELETED';    card_id: string }
  | { type: 'COLUMN_CREATED';  column: ColumnResponse }
  | { type: 'COLUMN_RENAMED';  column_id: string; title: string }
  | { type: 'COLUMN_REORDERED'; column_id: string; position: number }
  | { type: 'COLUMN_DELETED';  column_id: string }

// ── API Error ─────────────────────────────────────────────────────────────────
// Every error from every endpoint follows this exact shape.
// Used for typed error handling in hooks.

export type ApiErrorCode =
  | 'MISSING_TOKEN'
  | 'INVALID_TOKEN'
  | 'TOKEN_EXPIRED'
  | 'INVALID_CREDENTIALS'
  | 'REFRESH_TOKEN_INVALID'
  | 'REFRESH_TOKEN_EXPIRED'
  | 'TOKEN_THEFT_DETECTED'
  | 'VALIDATION_ERROR'
  | 'INVALID_UUID'
  | 'NOT_WORKSPACE_MEMBER'
  | 'INSUFFICIENT_PERMISSIONS'
  | 'BOARD_ACCESS_DENIED'
  | 'USER_NOT_FOUND'
  | 'WORKSPACE_NOT_FOUND'
  | 'BOARD_NOT_FOUND'
  | 'CARD_NOT_FOUND'
  | 'DOCUMENT_NOT_FOUND'
  | 'SHARE_TOKEN_NOT_FOUND'
  | 'EMAIL_ALREADY_EXISTS'
  | 'ALREADY_WORKSPACE_MEMBER'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode
    message: string
    details: Record<string, string> | null
  }
}