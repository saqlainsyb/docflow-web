// src/pages/auth/LoginPage.tsx
import { BackgroundOrbs } from './components/BackgroundOrbs'
import { AuthCard } from './components/AuthCard'
import { AuthHeader } from './components/AuthHeader'
import { AuthFooter } from './components/AuthFooter'
import { LoginForm } from './components/LoginForm'

export function LoginPage() {
  return (
    <div className="relative min-h-screen flex flex-col bg-background text-foreground overflow-hidden">
      <BackgroundOrbs />
      <main className="grow flex items-center justify-center p-6 z-10">
        <AuthCard>
          <AuthHeader heading="Welcome back" />
          <LoginForm />
        </AuthCard>
      </main>

      <AuthFooter />
    </div>
  )
}