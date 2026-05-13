import { CheckCircle2 } from 'lucide-react'
import { useAuth } from '../../context/auth-context'
import { Card } from '../../components/ui/Card'
import { dashboardGreetingName } from '../../utils/authGreeting'

export function WelcomeBanner() {
  const { user } = useAuth()
  const name = dashboardGreetingName(user)

  return (
    <Card
      padding="none"
      className="relative min-h-[120px] overflow-hidden border-cyan-500/20 md:min-h-[140px]"
    >
      <div
        className="absolute inset-0 bg-cover bg-center opacity-35"
        style={{
          backgroundImage:
            'linear-gradient(105deg, rgba(5,9,20,0.92) 0%, rgba(5,9,20,0.55) 45%, rgba(5,9,20,0.85) 100%), url("https://images.unsplash.com/photo-1549923746-c502d488b3db?w=1200&q=60")',
        }}
      />
      <div className="relative z-10 flex h-full flex-col justify-center p-4 md:p-5 lg:p-6">
        <h2 className="text-xl font-semibold tracking-tight md:text-2xl">
          {name ? (
            <>
              Willkommen zurück, {name}{' '}
              <span className="inline-block" aria-hidden>
                👋
              </span>
            </>
          ) : (
            <>
              Willkommen zurück{' '}
              <span className="inline-block" aria-hidden>
                👋
              </span>
            </>
          )}
        </h2>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-[var(--text-muted)]">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-hidden />
          <span>Station alles im grünen Bereich</span>
        </div>
      </div>
    </Card>
  )
}
