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
    // path targets the specific field that should show the error
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
// endpoint per the backend service rules (section 8.2 of the architecture doc).
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