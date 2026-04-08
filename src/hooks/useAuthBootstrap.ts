import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { useAppDispatch } from '@/store/hooks'
import { setCredentials, clearCredentials } from '@/store'
import type { User } from '@/lib/types'

interface UseAuthBootstrapResult {
  isBootstrapping: boolean
}

// Module-level promise — shared across StrictMode double-invocations.
// Ensures only one /users/me call is ever in flight at a time.
let bootstrapPromise: Promise<User | null> | null = null

export function useAuthBootstrap(): UseAuthBootstrapResult {
  const dispatch = useAppDispatch()
  const [isBootstrapping, setIsBootstrapping] = useState(true)

  useEffect(() => {
    if (!bootstrapPromise) {
      // Race the /me call against a 10s timeout so the app never hangs
      // on a slow or unresponsive network — it fails fast and goes to login.
      const fetchMe = api.get<User>('/users/me').then((res) => res.data)

      const timeout = new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), 10_000),
      )

      bootstrapPromise = Promise.race([fetchMe, timeout])
        .catch(() => null)
        .finally(() => {
          bootstrapPromise = null
        })
    }

    bootstrapPromise.then((user) => {
      if (user) {
        dispatch(
          setCredentials({
            user,
            access_token:
              (api.defaults.headers.common['Authorization'] as string)?.replace(
                'Bearer ',
                '',
              ) ?? '',
          }),
        )
      } else {
        dispatch(clearCredentials())
      }
      setIsBootstrapping(false)
    })
  }, [dispatch])

  return { isBootstrapping }
}