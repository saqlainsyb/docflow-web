import { cn } from '@/lib/utils'

interface AuthCardProps {
  children: React.ReactNode
  className?: string
}

export function AuthCard({ children, className }: AuthCardProps) {
  return (
    <div
      className={cn(
        'w-full max-w-110',
        'bg-(--df-surface-low)/60 backdrop-blur-xl',
        'rounded-xl border border-white/5',
        'shadow-[0_0_50px_rgba(0,0,0,0.3)]',
        'p-10',
        className,
      )}
    >
      {children}
    </div>
  )
}