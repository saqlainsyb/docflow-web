// src/hooks/useRegister.ts
// ─────────────────────────────────────────────────────────────────────────────
// Mutation hook for POST /auth/register.
//
// Extended from V1 to handle the invitation flow:
//
//   Normal flow:  register → setCredentials → navigate to /
//   Invite flow:  register → setCredentials → POST /invitations/:token/accept
//                 → navigate to /:workspaceId/boards
//
// The invitation token comes from the ?invitation= query parameter set by
// InvitationAcceptPage when it redirects non-authenticated users to /register.
// We read it here (not in the component) so the registration itself stays
// completely unaware of where it came from.
// ─────────────────────────────────────────────────────────────────────────────

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAppDispatch } from '@/store/hooks'
import { setCredentials } from '@/store'
import api from '@/lib/api'
import { ROUTES } from '@/lib/routes'
import { workspacesQueryKey } from '@/hooks/useWorkspaces'
import type { AuthResponse, AcceptInvitationResponse } from '@/lib/types'
import type { RegisterFormValues } from '@/lib/validations'

export function useRegister() {
  const dispatch      = useAppDispatch()
  const navigate      = useNavigate()
  const queryClient   = useQueryClient()
  const [searchParams] = useSearchParams()
  const invitationToken = searchParams.get('invitation')

  const mutation = useMutation({
    mutationFn: ({ confirmPassword: _, ...credentials }: RegisterFormValues) =>
      api
        .post<AuthResponse>(ROUTES.auth.register, credentials)
        .then((res) => res.data),

    onSuccess: async (data) => {
      // 1. Persist auth state — sets Authorization header for all subsequent calls
      dispatch(
        setCredentials({
          user: data.user,
          access_token: data.access_token,
        }),
      )

      // 2. If the user arrived from an invitation link, auto-accept it
      //    using the access token we just received. The accept endpoint reads
      //    user_email from the JWT which now matches the registered email.
      if (invitationToken) {
        try {
          const acceptResp = await api
            .post<AcceptInvitationResponse>(`/invitations/${invitationToken}/accept`)
            .then((res) => res.data)

          // Refresh workspace list — the new workspace is now in there
          await queryClient.invalidateQueries({ queryKey: workspacesQueryKey })

          // Go directly to the workspace the invite was for
          navigate(`/${acceptResp.workspace_id}/boards`, { replace: true })
          return
        } catch {
          // Accept failed (email mismatch, expired, etc.) — still registered
          // successfully, so send the user to the root to pick a workspace.
          // The error is silently swallowed here; in V2 surface a toast.
          navigate('/', { replace: true })
          return
        }
      }

      // 3. Normal flow — navigate to root, RootRedirect sends to first workspace
      navigate('/', { replace: true })
    },

    // onError intentionally absent — RegisterForm reads mutation.error
    // and maps the backend code (EMAIL_ALREADY_EXISTS etc.) to a message.
  })

  return mutation
}