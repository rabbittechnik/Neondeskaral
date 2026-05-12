import { AlertCircle, CheckCircle2, Info, XCircle } from 'lucide-react'

type Variant = 'success' | 'warning' | 'error' | 'info'

type Props = {
  variant: Variant
  title: string
  message: string
  children?: React.ReactNode
}

const styles: Record<Variant, string> = {
  success: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100',
  warning: 'border-amber-400/45 bg-amber-500/10 text-amber-100',
  error: 'border-red-400/45 bg-red-500/10 text-red-100',
  info: 'border-cyan-400/40 bg-cyan-500/10 text-cyan-100',
}

const Icon = ({ variant }: { variant: Variant }) => {
  const c = 'h-8 w-8 shrink-0'
  if (variant === 'success') return <CheckCircle2 className={c} aria-hidden />
  if (variant === 'warning') return <AlertCircle className={c} aria-hidden />
  if (variant === 'error') return <XCircle className={c} aria-hidden />
  return <Info className={c} aria-hidden />
}

export function TerminalResultMessage({ variant, title, message, children }: Props) {
  return (
    <div className={`rounded-2xl border px-5 py-4 ${styles[variant]}`}>
      <div className="flex gap-3">
        <Icon variant={variant} />
        <div className="min-w-0">
          <p className="text-lg font-bold">{title}</p>
          <p className="mt-1 text-sm opacity-95">{message}</p>
          {children ? <div className="mt-4 flex flex-wrap gap-2">{children}</div> : null}
        </div>
      </div>
    </div>
  )
}
