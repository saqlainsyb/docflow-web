// src/lib/types.ts
// ─────────────────────────────────────────────────────────────────────────────
// All API-shaped types for Docflow.
// These mirror the backend DTOs exactly — if the backend changes a field,
// change it here first and TypeScript will surface every broken callsite.
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

// Board-level roles — completely independent from workspace roles.
// A workspace `member` can be a board `owner`.
export type BoardRole = 'owner' | 'admin' | 'editor'

// Board member — uses board_role (not workspace role).
// Returned by GET /boards/:id and GET /boards/:id/members.
export interface BoardMember {
  user_id: string
  name: string
  email: string
  avatar_url: string | null
  board_role: BoardRole
  added_at: string
}

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

// Response from POST /workspaces/:id/boards
export interface BoardCreateResponse {
  ID: string
  WorkspaceID: string
  Title: string
  Visibility: string
  CreatedAt: string
  UpdatedAt: string
}

export interface BoardListItem {
  id: string
  workspace_id: string
  title: string
  visibility: BoardVisibility
  member_count: number
  card_count: number
  created_at: string
  updated_at: string
}

export interface BoardDetailResponse {
  id: string
  workspace_id: string
  title: string
  visibility: BoardVisibility
  is_public_view: boolean
  // The calling user's resolved board role.
  // Use this to gate UI controls — do NOT re-derive from members array.
  my_board_role: BoardRole
  columns: ColumnWithCards[]
  // Board members with their board-level roles (not workspace roles).
  members: BoardMember[]
  created_at: string
}

export interface ShareLinkResponse {
  url: string
}

// ── Board member request DTOs ─────────────────────────────────────────────────

export interface AddBoardMemberRequest {
  user_id: string
  role?: 'admin' | 'editor' // defaults to 'editor' on the backend
}

export interface UpdateBoardMemberRoleRequest {
  role: 'admin' | 'editor'
  // 'owner' is excluded — use the transfer-ownership endpoint instead
}

export interface TransferOwnershipRequest {
  user_id: string
}

// ── Columns ───────────────────────────────────────────────────────────────────

export interface ColumnResponse {
  id: string
  board_id: string
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

export type BoardWSEvent =
  | { type: 'CARD_CREATED';     card: CardResponse }
  | { type: 'CARD_UPDATED';     card_id: string; changes: Partial<CardResponse> }
  | { type: 'CARD_MOVED';       card_id: string; column_id: string; position: number }
  | { type: 'CARD_ARCHIVED';    card_id: string }
  | { type: 'CARD_DELETED';     card_id: string }
  | { type: 'COLUMN_CREATED';   column: ColumnResponse }
  | { type: 'COLUMN_RENAMED';   column_id: string; title: string }
  | { type: 'COLUMN_REORDERED'; column_id: string; position: number }
  | { type: 'COLUMN_DELETED';   column_id: string }

// ── API Error ─────────────────────────────────────────────────────────────────

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
  | 'ALREADY_BOARD_MEMBER'
  | 'CANNOT_REMOVE_BOARD_OWNER'
  | 'TARGET_NOT_BOARD_MEMBER'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode
    message: string
    details: Record<string, string> | null
  }
}