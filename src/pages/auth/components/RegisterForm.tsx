// src/pages/auth/components/RegisterForm.tsx
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from 'react-router-dom'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { isAxiosError } from 'axios'
import { useRegister } from '@/hooks/useRegister'
import { registerSchema, type RegisterFormValues } from '@/lib/validations'
import { FormField } from './FormField'
import type { ApiErrorCode } from '@/lib/types'

const SERVER_ERROR_MESSAGES: Partial<Record<ApiErrorCode, string>> = {
  EMAIL_ALREADY_EXISTS: 'An account with this email already exists.',
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

export function RegisterForm() {
  const [showPassword, setShowPassword] = useState(false)
  const { mutate: register, isPending, error } = useRegister()

  const {
    register: registerField,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
  })

  const serverError = getServerError(error)

  return (
    <form
      onSubmit={handleSubmit((data) => register(data))}
      noValidate
      className="space-y-6"
    >
      <FormField
        {...registerField('name')}
        id="name"
        label="Full name"
        type="text"
        placeholder="Ada Lovelace"
        autoComplete="name"
        error={errors.name?.message}
      />

      <FormField
        {...registerField('email')}
        id="email"
        label="Email address"
        type="email"
        placeholder="you@example.com"
        autoComplete="email"
        error={errors.email?.message}
      />

      <FormField
        {...registerField('password')}
        id="password"
        label="Password"
        type={showPassword ? 'text' : 'password'}
        placeholder="••••••••"
        autoComplete="new-password"
        error={errors.password?.message}
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

      <FormField
        {...registerField('confirmPassword')}
        id="confirmPassword"
        label="Confirm password"
        type="password"
        placeholder="••••••••"
        autoComplete="new-password"
        error={errors.confirmPassword?.message}
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
            Creating account…
          </>
        ) : (
          'Create account'
        )}
      </button>

      <p className="text-center text-xs text-on-surface-variant">
        Already have an account?{' '}
        <Link to="/login" className="text-primary font-bold hover:underline ml-1">
          Sign in
        </Link>
      </p>
    </form>
  )
}