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