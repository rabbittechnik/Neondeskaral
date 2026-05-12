export function AssistantRulesStep() {
  return (
    <div className="space-y-3 text-xs text-[var(--text-muted)]">
      <p className="font-medium text-[var(--text-main)]">Berücksichtigte Kriterien</p>
      <ul className="list-inside list-disc space-y-1.5">
        <li>Nur aktive Mitarbeiter</li>
        <li>Genehmigte Abwesenheiten (Urlaub / krank) schließen automatische Zuweisung aus</li>
        <li>Keine Überschneidung mit bestehenden Schichten</li>
        <li>Bevorzugte Schichtarten und Arbeitstage (weiche Regeln)</li>
        <li>Wochenende / Feiertage (BW) laut Stammdaten</li>
        <li>Wochenstunden und optionales Stundenlimit</li>
        <li>Arbeitsbereich: leichter Bonus bei passender Zuordnung</li>
        <li>Bereits veröffentlichte Schichten werden nicht angetastet</li>
      </ul>
      <p className="rounded-md border border-cyan-500/20 bg-cyan-500/5 p-2 text-[11px] text-cyan-100/85">
        Hinweis: Es gibt keine mathematische Optimierung, nur eine einfache Bewertung und schrittweise Zuweisung.
      </p>
    </div>
  )
}
