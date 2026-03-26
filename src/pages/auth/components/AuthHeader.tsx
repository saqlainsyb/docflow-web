interface AuthHeaderProps {
  eyebrow?: string
  heading: string
}

export function AuthHeader({
  eyebrow = 'Aetheric Workspace',
  heading,
}: AuthHeaderProps) {
  return (
    <div className="mb-5 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary mb-2">
        {eyebrow}
      </p>
      <h1 className="text-4xl font-display font-extrabold tracking-tighter text-foreground">
        {heading}
      </h1>
    </div>
  )
}