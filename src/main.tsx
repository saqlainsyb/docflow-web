import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { BrowserRouter } from 'react-router-dom'
import { store } from '@/store'
import App from '@/App'
import '@/index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // don't retry on 401/403 — these are auth errors, not transient failures
      retry: (failureCount, error: unknown) => {
        const status = (error as { response?: { status?: number } })?.response?.status
        if (status === 401 || status === 403) return false
        return failureCount < 2
      },
      staleTime: 1000 * 60 * 5, // 5 minutes — board data doesn't change that fast
      refetchOnWindowFocus: false, // we handle real-time updates via WebSocket
    },
  },
})

const root = document.getElementById('root')
if (!root) throw new Error('root element not found')

createRoot(root).render(
  <>
    {/* Redux outermost — auth state must be available to everything */}
    <Provider store={store}>
      {/* QueryClient inside Redux — queries can read auth tokens from the store */}
      <QueryClientProvider client={queryClient}>
        {/* Router inside QueryClient — route components can use both */}
        <BrowserRouter>
          <App />
        </BrowserRouter>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </Provider>
  </>,
)