/**
 * StationGuide-Import: reine Beispieldaten (KW 20–27 / Mai–Juli 2026).
 * Urlaub nur in `stationGuideImportedAbsences`, nicht als Schichten.
 */

export type StationGuideShiftSeed = {
  date: string
  employeeName: string
  startTime: string
  endTime: string
  workAreaCode: string
  shiftType: 'regular'
  source: 'stationguide_import'
}

export type StationGuideAbsenceSeed = {
  employeeName: string
  type: 'vacation'
  startDate: string
  endDate: string
  status: 'approved'
  source: 'stationguide_import'
  note: string
}

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function pushDay(
  out: StationGuideShiftSeed[],
  date: string,
  slots: [string, string, string][],
): void {
  for (const [employeeName, startTime, endTime] of slots) {
    out.push({
      date,
      employeeName,
      startTime,
      endTime,
      workAreaCode: 'B',
      shiftType: 'regular',
      source: 'stationguide_import',
    })
  }
}

/** Alle importierten Schichten (ohne Urlaub). */
export const stationGuideImportedShifts: StationGuideShiftSeed[] = (() => {
  const s: StationGuideShiftSeed[] = []

  // KW 20 · 11.05.–17.05.2026
  pushDay(s, iso(2026, 5, 11), [
    ['Max Vins', '05:30', '14:00'],
    ['Metin Özgür', '14:00', '21:15'],
  ])
  pushDay(s, iso(2026, 5, 12), [
    ['Max Vins', '05:30', '14:00'],
    ['Mathias Raselowski', '08:00', '14:15'],
    ['Metin Özgür', '14:00', '21:15'],
  ])
  pushDay(s, iso(2026, 5, 13), [
    ['Mathias Raselowski', '05:30', '14:15'],
    ['Metin Özgür', '14:00', '21:15'],
  ])
  pushDay(s, iso(2026, 5, 14), [
    ['Max Vins', '07:30', '14:00'],
    ['Mathias Raselowski', '14:00', '20:15'],
  ])
  pushDay(s, iso(2026, 5, 15), [
    ['Max Vins', '05:30', '14:00'],
    ['Mathias Raselowski', '14:00', '21:15'],
  ])
  pushDay(s, iso(2026, 5, 16), [
    ['Chiara H.', '06:30', '14:00'],
    ['Enise A.', '14:00', '20:15'],
  ])
  pushDay(s, iso(2026, 5, 17), [
    ['Mathias Raselowski', '07:30', '14:00'],
    ['Valerina Mustafa', '14:00', '20:15'],
  ])

  // KW 21 · 18.05.–24.05.2026
  pushDay(s, iso(2026, 5, 18), [
    ['Max Vins', '05:30', '14:00'],
    ['Mathias Raselowski', '08:00', '14:15'],
    ['Metin Özgür', '14:00', '21:15'],
  ])
  pushDay(s, iso(2026, 5, 19), [
    ['Max Vins', '05:30', '14:00'],
    ['Mathias Raselowski', '08:00', '14:15'],
    ['Metin Özgür', '14:00', '21:15'],
  ])
  pushDay(s, iso(2026, 5, 20), [
    ['Mathias Raselowski', '05:30', '14:15'],
    ['Metin Özgür', '14:00', '21:15'],
  ])
  pushDay(s, iso(2026, 5, 21), [
    ['Max Vins', '05:30', '14:00'],
    ['Mathias Raselowski', '08:00', '14:15'],
    ['Metin Özgür', '14:00', '21:15'],
  ])
  pushDay(s, iso(2026, 5, 22), [
    ['Max Vins', '05:30', '14:00'],
    ['Mathias Raselowski', '08:00', '14:15'],
    ['Metin Özgür', '14:00', '21:15'],
  ])
  pushDay(s, iso(2026, 5, 23), [
    ['Chiara H.', '06:30', '14:00'],
    ['Mathias Raselowski', '14:00', '20:15'],
  ])
  pushDay(s, iso(2026, 5, 24), [
    ['Luca Stöck', '07:30', '14:00'],
    ['Valerina Mustafa', '14:00', '20:15'],
  ])

  // KW 22 · 25.05.–31.05.2026 (Urlaub Max Vins Mo–Fr separat)
  for (const d of [25, 26, 27, 28, 29] as const) {
    pushDay(s, iso(2026, 5, d), [
      ['Mathias Raselowski', d === 25 ? '07:30' : '05:30', d === 25 ? '14:00' : '14:15'],
      ['Metin Özgür', '14:00', d === 25 ? '20:15' : '21:15'],
    ])
  }
  pushDay(s, iso(2026, 5, 30), [
    ['Mathias Raselowski', '06:30', '14:00'],
    ['Luca Stöck', '14:00', '20:15'],
  ])
  pushDay(s, iso(2026, 5, 31), [
    ['Metin Özgür', '07:30', '14:00'],
    ['Luca Stöck', '14:00', '20:15'],
  ])

  // KW 23 · 01.06.–07.06.2026
  for (const [day, matStart, matEnd, metEnd] of [
    [1, '05:30', '14:00', '21:15'],
    [2, '05:30', '14:00', '21:15'],
    [3, '05:30', '14:00', '21:15'],
    [4, '07:30', '14:00', '20:15'],
    [5, '05:30', '14:00', '21:15'],
  ] as const) {
    pushDay(s, iso(2026, 6, day), [
      ['Mathias Raselowski', matStart, matEnd],
      ['Metin Özgür', '14:00', metEnd],
    ])
  }
  pushDay(s, iso(2026, 6, 6), [
    ['Chiara H.', '06:30', '14:00'],
    ['Enise A.', '14:00', '20:15'],
  ])
  pushDay(s, iso(2026, 6, 7), [
    ['Chiara H.', '07:30', '14:00'],
    ['Valerina Mustafa', '14:00', '20:15'],
  ])

  // KW 24 · 08.06.–14.06.2026
  pushDay(s, iso(2026, 6, 8), [
    ['Max Vins', '05:30', '14:00'],
    ['Mathias Raselowski', '08:00', '14:15'],
    ['Metin Özgür', '14:00', '21:15'],
  ])
  pushDay(s, iso(2026, 6, 9), [
    ['Max Vins', '05:30', '14:00'],
    ['Mathias Raselowski', '08:00', '14:15'],
    ['Metin Özgür', '14:00', '21:15'],
  ])
  pushDay(s, iso(2026, 6, 10), [
    ['Mathias Raselowski', '05:30', '14:15'],
    ['Metin Özgür', '14:00', '21:15'],
  ])
  pushDay(s, iso(2026, 6, 11), [
    ['Max Vins', '05:30', '14:00'],
    ['Mathias Raselowski', '08:00', '14:15'],
    ['Metin Özgür', '14:00', '21:15'],
  ])
  pushDay(s, iso(2026, 6, 12), [
    ['Max Vins', '05:30', '14:00'],
    ['Mathias Raselowski', '08:00', '14:15'],
    ['Metin Özgür', '14:00', '21:15'],
  ])
  pushDay(s, iso(2026, 6, 13), [
    ['Enise A.', '06:30', '14:00'],
    ['Luca Stöck', '14:00', '20:15'],
  ])
  pushDay(s, iso(2026, 6, 14), [
    ['Chiara H.', '07:30', '14:00'],
    ['Valerina Mustafa', '14:00', '20:15'],
  ])

  // KW 25 · 15.06.–21.06.2026
  pushDay(s, iso(2026, 6, 15), [
    ['Max Vins', '05:30', '14:00'],
    ['Mathias Raselowski', '08:00', '14:15'],
    ['Metin Özgür', '14:00', '21:15'],
  ])
  pushDay(s, iso(2026, 6, 16), [
    ['Max Vins', '05:30', '14:00'],
    ['Mathias Raselowski', '08:00', '14:15'],
    ['Metin Özgür', '14:00', '21:15'],
  ])
  pushDay(s, iso(2026, 6, 17), [
    ['Mathias Raselowski', '05:30', '14:00'],
    ['Metin Özgür', '14:00', '21:15'],
  ])
  pushDay(s, iso(2026, 6, 18), [
    ['Max Vins', '05:30', '14:00'],
    ['Mathias Raselowski', '08:00', '14:15'],
    ['Metin Özgür', '14:00', '21:15'],
  ])
  pushDay(s, iso(2026, 6, 19), [
    ['Max Vins', '05:30', '14:00'],
    ['Mathias Raselowski', '08:00', '14:15'],
    ['Metin Özgür', '14:00', '21:15'],
  ])
  pushDay(s, iso(2026, 6, 20), [
    ['Luca Stöck', '06:30', '14:00'],
    ['Enise A.', '14:00', '20:15'],
  ])
  pushDay(s, iso(2026, 6, 21), [
    ['Chiara H.', '07:30', '14:00'],
    ['Valerina Mustafa', '14:00', '20:15'],
  ])

  // KW 26 · 22.06.–28.06.2026 (Mathias Urlaub Mo–Fr)
  for (const d of [22, 23, 24, 25, 26] as const) {
    pushDay(s, iso(2026, 6, d), [
      ['Max Vins', '05:30', '14:00'],
      ['Metin Özgür', '14:00', '21:15'],
    ])
  }
  pushDay(s, iso(2026, 6, 27), [
    ['Luca Stöck', '06:30', '14:00'],
    ['Enise A.', '14:00', '20:15'],
  ])
  pushDay(s, iso(2026, 6, 28), [
    ['Chiara H.', '07:30', '14:00'],
    ['Valerina Mustafa', '14:00', '20:15'],
  ])

  // KW 27 · 29.06.–05.07.2026 (Sa/So laut Screenshot ohne Schicht)
  for (const d of [29, 30] as const) {
    pushDay(s, iso(2026, 6, d), [
      ['Max Vins', '05:30', '14:00'],
      ['Metin Özgür', '14:00', '21:15'],
    ])
  }
  for (const d of [1, 2, 3] as const) {
    pushDay(s, iso(2026, 7, d), [
      ['Max Vins', '05:30', '14:00'],
      ['Metin Özgür', '14:00', '21:15'],
    ])
  }

  return s
})()

export const stationGuideImportedAbsences: StationGuideAbsenceSeed[] = [
  {
    employeeName: 'Max Vins',
    type: 'vacation',
    startDate: iso(2026, 5, 25),
    endDate: iso(2026, 5, 29),
    status: 'approved',
    source: 'stationguide_import',
    note: 'Aus grauem Balken im StationGuide übernommen',
  },
  {
    employeeName: 'Max Vins',
    type: 'vacation',
    startDate: iso(2026, 6, 1),
    endDate: iso(2026, 6, 5),
    status: 'approved',
    source: 'stationguide_import',
    note: 'Aus grauem Balken im StationGuide übernommen',
  },
  {
    employeeName: 'Mathias Raselowski',
    type: 'vacation',
    startDate: iso(2026, 6, 22),
    endDate: iso(2026, 6, 26),
    status: 'approved',
    source: 'stationguide_import',
    note: 'Aus grauem Balken im StationGuide übernommen',
  },
  {
    employeeName: 'Mathias Raselowski',
    type: 'vacation',
    startDate: iso(2026, 6, 29),
    endDate: iso(2026, 7, 3),
    status: 'approved',
    source: 'stationguide_import',
    note: 'Aus grauem Balken im StationGuide übernommen',
  },
]
