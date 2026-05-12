import type { TuvReportDetail } from '../../types/tuvReport'

function itemStatusDe(s: string): string {
  switch (s) {
    case 'ok':
      return 'In Ordnung'
    case 'not_ok':
      return 'Nicht in Ordnung'
    case 'not_applicable':
      return 'Nicht zutreffend'
    default:
      return '—'
  }
}

export function TuvReportPrintView({ detail, stationName }: { detail: TuvReportDetail; stationName: string }) {
  const { report, items } = detail
  return (
    <div className="tuv-print-root bg-white p-8 text-black print:p-6">
      <header className="mb-6 border-b border-black pb-4">
        <h1 className="text-xl font-bold">Monatlicher TÜV-Bericht / Tankstellenkontrolle</h1>
        <p className="mt-2 text-sm leading-relaxed">
          <strong>Station:</strong> {stationName}
          <br />
          <strong>Zeitraum:</strong> {report.month.toString().padStart(2, '0')} / {report.year}
          <br />
          <strong>Datum der Kontrolle:</strong> {report.reportDate || '—'}
          <br />
          <strong>Durchgeführt von:</strong> {report.createdByName}
          <br />
          <strong>Rolle:</strong> {report.inspectorRole || '—'}
          <br />
          {report.weatherNote ? (
            <>
              <strong>Wetter / Umstände:</strong> {report.weatherNote}
              <br />
            </>
          ) : null}
        </p>
      </header>

      {report.generalNote ? (
        <section className="mb-4 text-sm">
          <strong>Allgemeine Bemerkung:</strong> {report.generalNote}
        </section>
      ) : null}

      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="border border-black px-2 py-1 text-left">Nr.</th>
            <th className="border border-black px-2 py-1 text-left">Prüffrage</th>
            <th className="border border-black px-2 py-1 text-left">Status</th>
            <th className="border border-black px-2 py-1 text-left">Bemerkung</th>
            <th className="border border-black px-2 py-1 text-left">Maßnahme</th>
            <th className="border border-black px-2 py-1 text-left">Verantw.</th>
            <th className="border border-black px-2 py-1 text-left">Frist</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.id}>
              <td className="border border-black px-2 py-1 align-top">{it.sortOrder}</td>
              <td className="border border-black px-2 py-1 align-top">{it.question}</td>
              <td className="border border-black px-2 py-1 align-top">{itemStatusDe(it.status)}</td>
              <td className="border border-black px-2 py-1 align-top whitespace-pre-wrap">{it.note || '—'}</td>
              <td className="border border-black px-2 py-1 align-top whitespace-pre-wrap">
                {it.actionRequired || '—'}
              </td>
              <td className="border border-black px-2 py-1 align-top">{it.responsible || '—'}</td>
              <td className="border border-black px-2 py-1 align-top">{it.dueDate || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <footer className="mt-8 border-t border-black pt-4 text-sm">
        <p className="font-semibold">Bestätigung / Unterschrift</p>
        <p className="mt-2">
          Bestätigt von: <strong>{report.confirmedByName || report.completedByName || '—'}</strong>
          <br />
          Datum/Uhrzeit:{' '}
          <strong>
            {report.confirmedAt
              ? new Date(report.confirmedAt).toLocaleString('de-DE')
              : report.completedAt
                ? new Date(report.completedAt).toLocaleString('de-DE')
                : '—'}
          </strong>
        </p>
        {report.confirmationText ? (
          <p className="mt-2 text-xs leading-relaxed">{report.confirmationText}</p>
        ) : null}
        {report.signatureDataUrl ? (
          <div className="mt-3">
            <img src={report.signatureDataUrl} alt="Unterschrift" className="max-h-24 border border-black" />
          </div>
        ) : null}
        <p className="mt-4 text-xs text-gray-600">
          Status Bericht: {report.status} · Erstellt: {report.createdAt ? new Date(report.createdAt).toLocaleString('de-DE') : '—'}
          {report.printedAt ? ` · Gedruckt: ${new Date(report.printedAt).toLocaleString('de-DE')}` : ''}
        </p>
      </footer>
    </div>
  )
}
