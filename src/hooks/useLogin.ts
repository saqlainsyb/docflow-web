// src/hooks/useLogin.ts
// ─────────────────────────────────────────────────────────────────────────────
// Mutation hook for POST /auth/login.
//
// Extended to handle the invitation auto-accept flow:
//
//   Normal flow:  login → setCredentials → navigate to / (→ RootRedirect)
//   Invite flow:  login → setCredentials → POST /invitations/:token/accept
//                 → navigate to /:workspaceId/boards
//
// The ?invitation= param is set by InvitationAcceptPage when it redirects
// non-authenticated users to /login?invitation=:token.
// ─────────────────────────────────────────────────────────────────────────────

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAppDispatch } from '@/store/hooks'
import { setCredentials } from '@/store'
import api from '@/lib/api'
import { ROUTES } from '@/lib/routes'
import { workspacesQueryKey } from '@/hooks/useWorkspaces'
import type { AuthResponse, AcceptInvitationResponse } from '@/lib/types'
import type { LoginFormValues } from '@/lib/validations'

export function useLogin() {
  const dispatch       = useAppDispatch()
  const navigate       = useNavigate()
  const queryClient    = useQueryClient()
  const [searchParams] = useSearchParams()
  const invitationToken = searchParams.get('invitation')

  const mutation = useMutation({
    mutationFn: (credentials: LoginFormValues) =>
      api
        .post<AuthResponse>(ROUTES.auth.login, credentials)
        .then((res) => res.data),

    onSuccess: async (data) => {
      dispatch(
        setCredentials({
          user: data.user,
          access_token: data.access_token,
        }),
      )

      if (invitationToken) {
        try {
          const acceptResp = await api
            .post<AcceptInvitationResponse>(`/invitations/${invitationToken}/accept`)
            .then((res) => res.data)

          await queryClient.invalidateQueries({ queryKey: workspacesQueryKey })
          navigate(`/${acceptResp.workspace_id}/boards`, { replace: true })
          return
        } catch {
          // Accept failed — send to root so user can still access their workspace
          navigate('/', { replace: true })
          return
        }
      }

      // Normal flow
      navigate('/', { replace: true })
    },

    // onError intentionally absent — LoginPage reads mutation.error
  })

  return mutation
}