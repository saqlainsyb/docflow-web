// src/lib/validations.ts
import { z } from 'zod'

// ── Reusable field definitions ─────────────────────────────────────────────────
// Defined once so register and updateMe share the exact same email/name/password
// rules without duplication. If the backend changes a rule, you change it here.

const emailField = z.string().min(1, 'Email is required').email('Invalid email address')

const nameField = z
  .string()
  .min(2, 'Name must be at least 2 characters')
  .max(50, 'Name must be 50 characters or fewer')

// Mirrors backend service exactly:
//   min 8 chars, at least 1 digit, at least 1 special character
// Validated client-side so the user gets instant feedback before the network
// round-trip — but the backend enforces the same rules as the final gate.
const passwordField = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/\d/, 'Password must contain at least one number')
  .regex(/[^a-zA-Z0-9]/, 'Password must contain at least one special character')

// ── Register ───────────────────────────────────────────────────────────────────

export const registerSchema = z
  .object({
    name: nameField,
    email: emailField,
    password: passwordField,
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  })

export type RegisterFormValues = z.infer<typeof registerSchema>

// ── Login ──────────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: emailField,
  // login password has no complexity rules — those only apply on creation
  password: z.string().min(1, 'Password is required'),
})

export type LoginFormValues = z.infer<typeof loginSchema>

// ── Update profile (PATCH /users/me) ──────────────────────────────────────────
// Both fields are optional — only the ones the user changes are sent.
// .optional() here means the field may be absent from the object entirely,
// which matches PATCH semantics: only include changed fields in the request body.

export const updateMeSchema = z.object({
  name: nameField.optional(),
  avatar_url: z
    .string()
    .url('Must be a valid URL')
    .optional()
    .or(z.literal('')), // allow clearing the avatar with an empty string
})

export type UpdateMeFormValues = z.infer<typeof updateMeSchema>

// ── Workspaces ─────────────────────────────────────────────────────────────────

// Create workspace
// Name rules mirror the backend: 1–100 chars (trimmed).
// No min-2 like user names — "HQ", "AI" are valid workspace names.
export const createWorkspaceSchema = z.object({
  name: z
    .string()
    .min(1, 'Workspace name is required')
    .max(100, 'Workspace name must be 100 characters or fewer')
    .transform((val) => val.trim()),
})

export type CreateWorkspaceFormValues = z.infer<typeof createWorkspaceSchema>

// Rename workspace (PATCH /workspaces/:id)
// Identical rules to create — same backend validation target.
export const renameWorkspaceSchema = z.object({
  name: z
    .string()
    .min(1, 'Workspace name is required')
    .max(100, 'Workspace name must be 100 characters or fewer')
    .transform((val) => val.trim()),
})

export type RenameWorkspaceFormValues = z.infer<typeof renameWorkspaceSchema>

// Invite member (POST /workspaces/:id/members)
// Backend constraint: user must already have an account (V1).
// We send only the email — the backend resolves the user_id.
export const inviteMemberSchema = z.object({
  email: emailField,
})

export type InviteMemberFormValues = z.infer<typeof inviteMemberSchema>

// Change member role (PATCH /workspaces/:id/members/:uid)
// 'owner' is intentionally excluded — ownership cannot be assigned via this
// endpoint per the backend service rules.
// The UI will only ever show 'admin' and 'member' as options.
export const changeMemberRoleSchema = z.object({
  role: z.enum(['admin', 'member'], {
    error: 'Role must be admin or member',
  }),
})

export type ChangeMemberRoleFormValues = z.infer<typeof changeMemberRoleSchema>

// Assignable role type — subset of WorkspaceRole, excludes 'owner'
// Use this wherever a role picker renders. Import WorkspaceRole from
// types.ts when you need the full set (e.g. displaying the owner's badge).
export type AssignableRole = ChangeMemberRoleFormValues['role']

// ── Boards ─────────────────────────────────────────────────────────────────────

// Create board (POST /workspaces/:id/boards)
// Title: 1–100 chars, trimmed. Mirrors CreateBoardRequest.
// Visibility: defaults to 'workspace' — the safe default (visible to all
// workspace members). The user can opt into 'private' explicitly.
export const createBoardSchema = z.object({
  title: z
    .string()
    .min(1, 'Board title is required')
    .max(100, 'Board title must be 100 characters or fewer')
    .transform((val) => val.trim()),
  visibility: z.enum(['workspace', 'private']).default('workspace'),
})

export type CreateBoardFormValues = z.infer<typeof createBoardSchema>

// ── Columns ────────────────────────────────────────────────────────────────────

// Create column (POST /boards/:id/columns)
// Title only — position is computed by fractional.ts and injected before submit.
// The backend UpdateColumnRequest also accepts an optional position for
// reordering, but that's handled programmatically (not via a form).
export const createColumnSchema = z.object({
  title: z
    .string()
    .min(1, 'Column title is required')
    .max(100, 'Column title must be 100 characters or fewer')
    .transform((val) => val.trim()),
})

export type CreateColumnFormValues = z.infer<typeof createColumnSchema>

// ── Cards ──────────────────────────────────────────────────────────────────────

// The 6-color palette enforced at DB level — mirrors CardColor in types.ts.
// Validated here so the form can't submit an arbitrary hex string.
const CARD_COLORS = [
  '#EF4444', // red
  '#F97316', // orange
  '#EAB308', // yellow
  '#22C55E', // green
  '#3B82F6', // blue
  '#A855F7', // purple
] as const

export const cardColorSchema = z.enum(CARD_COLORS)
export type CardColorValue = z.infer<typeof cardColorSchema>

// Create card (POST /columns/:id/cards)
// Title: 1–200 chars, trimmed. Color is optional — omitting it means no color.
// Position is computed by fractional.ts and injected before submit, not a
// user-facing field.
export const createCardSchema = z.object({
  title: z
    .string()
    .min(1, 'Card title is required')
    .max(200, 'Card title must be 200 characters or fewer')
    .transform((val) => val.trim()),
  color: cardColorSchema.optional(),
})

export type CreateCardFormValues = z.infer<typeof createCardSchema>

// Update card (PATCH /cards/:id)
// All fields optional — only changed ones are sent (PATCH semantics).
// assignee_id: string (UUID) to assign, null to explicitly unassign,
// undefined/absent to leave unchanged.
export const updateCardSchema = z.object({
  title: z
    .string()
    .min(1, 'Card title is required')
    .max(200, 'Card title must be 200 characters or fewer')
    .transform((val) => val.trim())
    .optional(),
  color: cardColorSchema.nullable().optional(),
  assignee_id: z.string().uuid('Invalid user ID').nullable().optional(),
})

export type UpdateCardFormValues = z.infer<typeof updateCardSchema>