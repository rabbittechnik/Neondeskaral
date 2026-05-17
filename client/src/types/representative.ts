export const REPRESENTATIVE_CATEGORIES = [
  'Tabak / Zigaretten',
  'Gas / Propangas',
  'Technik',
  'TÜV / Sicherheit',
  'Lebensmittel / Lieferanten',
  'Wartung / Reparatur',
  'Notfallkontakte',
  'Sonstige Vertreter',
] as const

export type RepresentativeCategory = (typeof REPRESENTATIVE_CATEGORIES)[number]

export type RepresentativeApi = {
  id: string
  stationId: string
  company: string
  name: string
  position: string
  email: string
  street: string
  houseNumber: string
  postCode: string
  city: string
  postalAddress: string
  phone: string
  mobile1: string
  mobile2: string
  fax: string
  website: string
  category: string
  notes: string
  isFavorite: boolean
  active: boolean
  createdBy: string | null
  createdAt: string | null
  updatedAt: string | null
  archivedAt: string | null
}
