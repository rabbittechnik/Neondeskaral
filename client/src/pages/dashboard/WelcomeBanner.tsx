import { CheckCircle2 } from 'lucide-react'
import { Card } from '../../components/ui/Card'

export function WelcomeBanner() {
  return (
    <Card
      padding="none"
      className="relative min-h-[160px] overflow-hidden border-cyan-500/20 md:min-h-[180px]"
    >
      <div
        className="absolute inset-0 bg-cover bg-center opacity-35"
        style={{
          backgroundImage:
            'linear-gradient(105deg, rgba(5,9,20,0.92) 0%, rgba(5,9,20,0.55) 45%, rgba(5,9,20,0.85) 100%), url("https://images.unsplash.com/photo-1549923746-c502d488b3db?w=1200&q=60")',
        }}
      />
      <div className="relative z-10 flex h-full flex-col justify-center p-5 md:p-6 lg:p-8">
        <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
          Willkommen zurück, Mathias{' '}
          <span className="inline-block" aria-hidden>
            👋
          </span>
        </h2>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-[var(--text-muted)]">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-hidden />
          <span>Station alles im grünen Bereich</span>
        </div>
      </div>
    </Card>
  )
}
