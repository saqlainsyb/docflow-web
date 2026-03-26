// src/pages/auth/RegisterPage.tsx
import { BackgroundOrbs } from './components/BackgroundOrbs'
import { AuthCard } from './components/AuthCard'
import { AuthHeader } from './components/AuthHeader'
import { AuthFooter } from './components/AuthFooter'
import { RegisterForm } from './components/RegisterForm'

export function RegisterPage() {
  return (
    <div className="relative min-h-screen flex flex-col bg-background text-foreground overflow-hidden">
      <BackgroundOrbs />

      <main className="grow flex items-center justify-center p-6 z-10">
        <AuthCard>
          <AuthHeader heading="Create account" />
          <RegisterForm />
        </AuthCard>
      </main>

      <AuthFooter />
    </div>
  )
}