// src/pages/auth/components/LoginForm.tsx
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from 'react-router-dom'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { isAxiosError } from 'axios'
import { useLogin } from '@/hooks/useLogin'
import { loginSchema, type LoginFormValues } from '@/lib/validations'
import { FormField } from './FormField'
import type { ApiErrorCode } from '@/lib/types'

const SERVER_ERROR_MESSAGES: Partial<Record<ApiErrorCode, string>> = {
  INVALID_CREDENTIALS: 'Incorrect email or password.',
  RATE_LIMITED: 'Too many attempts. Please wait a moment and try again.',
  INTERNAL_ERROR: 'Something went wrong on our end. Please try again.',
}

const FALLBACK_ERROR = 'Something went wrong. Please try again.'

function getServerError(error: unknown): string | null {
  if (!isAxiosError<{ error: { code: ApiErrorCode } }>(error)) return null
  const code = error.response?.data?.error?.code
  if (!code) return FALLBACK_ERROR
  return SERVER_ERROR_MESSAGES[code] ?? FALLBACK_ERROR
}

export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false)
  const { mutate: login, isPending, error } = useLogin()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  })

  const serverError = getServerError(error)

  return (
    <form onSubmit={handleSubmit((data) => login(data))} noValidate className="space-y-6">

      <FormField
        {...register('email')}
        id="email"
        label="Email address"
        type="email"
        placeholder="you@example.com"
        autoComplete="email"
        error={errors.email?.message}
      />

      <FormField
        {...register('password')}
        id="password"
        label="Password"
        type={showPassword ? 'text' : 'password'}
        placeholder="••••••••"
        autoComplete="current-password"
        error={errors.password?.message}
        rightSlot={
          <button
            type="button"
            className="text-[10px] text-primary hover:text-primary/80 uppercase tracking-[0.15em] font-bold transition-colors"
            onClick={() => {
              // TODO V2: forgot password
            }}
          >
            Forgot password?
          </button>
        }
        icon={
          <button
            type="button"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            onClick={() => setShowPassword((v) => !v)}
            className="text-on-surface-variant hover:text-foreground transition-colors"
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        }
      />

      {serverError && (
        <p role="alert" className="text-[11px] text-destructive font-medium text-center">
          {serverError}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full mt-5 df-gradient-cta py-4 rounded-lg text-(--df-on-primary) font-bold text-sm tracking-wide shadow-lg shadow-primary/20 hover:scale-[1.01] active:scale-[0.98] transition-all duration-300 flex justify-center items-center gap-2 disabled:opacity-70 disabled:pointer-events-none"
      >
        {isPending ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Signing in…
          </>
        ) : (
          'Login'
        )}
      </button>

      <p className="text-center text-xs text-on-surface-variant">
        Don't have an account?{' '}
        <Link to="/register" className="text-primary font-bold hover:underline ml-1">
          Create one
        </Link>
      </p>
    </form>
  )
}