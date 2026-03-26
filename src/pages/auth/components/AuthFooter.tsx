const LINKS = ['Privacy', 'Terms', 'Security', 'Support'] as const

export function AuthFooter() {
  return (
    <footer className="w-full py-5 border-t border-white/5 bg-background z-10">
      <div className="flex flex-col md:flex-row justify-between items-center px-8 gap-4 max-w-7xl mx-auto w-full">
        <span className="text-lg font-black text-foreground">Docflow</span>

        <nav className="flex items-center gap-6">
          {LINKS.map((link) => (
            <a
              key={link}
              href="#"
              className="text-on-surface-variant hover:text-primary transition-colors text-[10px] tracking-[0.2em] uppercase"
            >
              {link}
            </a>
          ))}
        </nav>

        <p className="text-on-surface-variant text-[10px] tracking-[0.2em] uppercase">
          © 2025 Docflow. The Kinetic Ether.
        </p>
      </div>
    </footer>
  )
}