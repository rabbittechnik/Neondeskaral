export const REPRESENTATIVE_CATEGORIES = [
  'Vertreter',
  'Lieferant',
  'Außendienst',
  'Wartung / Service',
  'Sonstige',
] as const

export type RepresentativeCategory = (typeof REPRESENTATIVE_CATEGORIES)[number]

export type RepresentativeApi = {
  id: string
  stationId: string
  company: string
  name: string
  email: string
  street: string
  houseNumber: string
  postCode: string
  city: string
  phone: string
  mobile1: string
  mobile2: string
  fax: string
  category: string
  notes: string
  active: boolean
  createdBy: string | null
  createdAt: string | null
  updatedAt: string | null
  archivedAt: string | null
}
