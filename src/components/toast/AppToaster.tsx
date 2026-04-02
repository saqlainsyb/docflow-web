import { Toaster } from 'sonner'

export function AppToaster() {
  return (
    <Toaster
      position="top-center"
      theme="dark"
      duration={4000}
      toastOptions={{
        classNames: {
          toast: [
            '!bg-[oklch(0.21_0.015_265/95%)]',
            '!backdrop-blur-xl',
            '!border !border-[oklch(0.35_0.015_265/40%)]',
            '!shadow-[0_8px_32px_oklch(0.05_0.01_265/60%)]',
            '!rounded-lg',
            '!font-sans',
            '!px-4 !py-3',
            '!gap-3',
          ].join(' '),
          title:       '!text-[oklch(0.91_0.015_265)] !text-sm !font-semibold !font-display !leading-snug',
          description: '!text-[oklch(0.63_0.015_265)] !text-xs !leading-relaxed !mt-0.5',
          icon:        '!mt-0',
          success:     '!border-[oklch(0.72_0.17_145/25%)] [&>[data-icon]]:!text-[oklch(0.72_0.17_145)]',
          error:       '!border-[oklch(0.65_0.22_25/25%)]  [&>[data-icon]]:!text-[oklch(0.65_0.22_25)]',
          warning:     '!border-[oklch(0.80_0.18_75/25%)]  [&>[data-icon]]:!text-[oklch(0.80_0.18_75)]',
          info:        '!border-[oklch(0.82_0.14_198/25%)] [&>[data-icon]]:!text-[oklch(0.82_0.14_198)]',
        },
      }}
    />
  )
}