// src/hooks/useLogin.ts
// ─────────────────────────────────────────────────────────────────────────────
// Mutation hook for POST /auth/login.
//
// Responsibilities:
// 1. POST credentials to the backend
// 2. On success: dispatch setCredentials to Redux (access token + user)
// 3. Navigate to the page the user was trying to reach before being redirected
//    to /login, or fall back to /workspaces
//
// What this hook does NOT do:
// - Validate the form — that is React Hook Form + Zod's job
// - Render anything — that is LoginPage's job
// - Store the refresh token — it arrives as an HttpOnly cookie automatically
// ─────────────────────────────────────────────────────────────────────────────

import { useMutation } from '@tanstack/react-query'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAppDispatch } from '@/store/hooks'
import { setCredentials } from '@/store'
import api from '@/lib/api'
import { ROUTES } from '@/lib/routes'
import type { AuthResponse } from '@/lib/types'
import type { LoginFormValues } from '@/lib/validations'

export function useLogin() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const location = useLocation()

  // If the user was redirected here from a protected route, ProtectedRoute
  // stores the attempted path in location.state.from so we can send them
  // back after a successful login instead of always dumping them at /workspaces.
  const from =
    (location.state as { from?: { pathname: string } } | null)?.from?.pathname ??
    '/workspaces'

  const mutation = useMutation({
    mutationFn: (credentials: LoginFormValues) =>
      api
        .post<AuthResponse>(ROUTES.auth.login, credentials)
        .then((res) => res.data),

    onSuccess: (data) => {
      dispatch(
        setCredentials({
          user: data.user,
          access_token: data.access_token,
        }),
      )
      // replace: true so /login is not in the back-stack after login
      navigate(from, { replace: true })
    },

    // onError is intentionally absent here.
    // The raw AxiosError is available via mutation.error at the call site.
    // LoginPage reads it and maps the error code to a user-facing message.
    // Centralising that mapping in the page keeps this hook reusable if we
    // ever need to trigger login from somewhere other than LoginPage.
  })

  return mutation
}