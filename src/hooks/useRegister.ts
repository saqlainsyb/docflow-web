// src/hooks/useRegister.ts
// ─────────────────────────────────────────────────────────────────────────────
// Mutation hook for POST /auth/register.
//
// Responsibilities:
// 1. POST registration data to the backend
// 2. On success: dispatch setCredentials to Redux (access token + user)
//    — backend auto-creates a personal workspace and returns the user + token
//    in the same response as login, so the shape is identical (AuthResponse)
// 3. Navigate to /workspaces — no "redirect back" logic needed here because
//    a user cannot be redirected to /register from a protected route
//
// What this hook does NOT do:
// - Validate the form — React Hook Form + Zod handle that (registerSchema)
// - Strip confirmPassword before sending — done here before the API call
//   because the backend has no confirmPassword field
// - Store the refresh token — arrives as an HttpOnly cookie automatically
// ─────────────────────────────────────────────────────────────────────────────

import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAppDispatch } from '@/store/hooks'
import { setCredentials } from '@/store'
import api from '@/lib/api'
import { ROUTES } from '@/lib/routes'
import type { AuthResponse } from '@/lib/types'
import type { RegisterFormValues } from '@/lib/validations'

export function useRegister() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()

  const mutation = useMutation({
    mutationFn: ({ confirmPassword: _,  ...credentials }: RegisterFormValues) =>
      api
        .post<AuthResponse>(ROUTES.auth.register, credentials)
        .then((res) => res.data),

    onSuccess: (data) => {
      dispatch(
        setCredentials({
          user: data.user,
          access_token: data.access_token,
        }),
      )
      navigate('/workspaces', { replace: true })
    },

    // onError intentionally absent — same reasoning as useLogin.
    // RegisterPage reads mutation.error and maps the code to a message.
    // EMAIL_ALREADY_EXISTS is the only domain error to handle beyond
    // network failures.
  })

  return mutation
}