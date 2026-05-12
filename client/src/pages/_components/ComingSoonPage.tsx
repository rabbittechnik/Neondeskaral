import { Construction } from 'lucide-react'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'

type Props = {
  title: string
  description?: string
}

export function ComingSoonPage({
  title,
  description = 'Dieser Bereich wird in einer späteren Ausbauphase mit Daten und Funktionen verbunden.',
}: Props) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} />
      <EmptyState
        title="In Kürze verfügbar"
        description={description}
        icon={<Construction className="h-10 w-10" aria-hidden />}
      />
    </div>
  )
}
