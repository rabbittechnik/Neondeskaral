import { Badge } from '../ui/Badge'

export function RunningTimeBadge({ label }: { label: string }) {
  return (
    <Badge tone="cyan" className="border border-cyan-400/35 bg-cyan-500/15 font-mono text-cyan-100">
      {label}
    </Badge>
  )
}
