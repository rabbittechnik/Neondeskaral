/** Idempotente Startkontakte (pro Station über seed_key). */
export type RepresentativeSeedEntry = {
  seedKey: string
  company: string
  name: string
  position: string
  category: string
  street: string
  houseNumber: string
  postCode: string
  city: string
  postalAddress: string
  phone: string
  mobile1: string
  email: string
  website: string
  notes: string
  isFavorite: boolean
}

export const ARAL_BODELSHAUSEN_REPRESENTATIVE_SEEDS: RepresentativeSeedEntry[] = [
  {
    seedKey: 'pmi-sven-klich',
    company: 'PHILIP MORRIS GmbH',
    name: 'Sven Klich',
    position: 'Account Development Executive',
    category: 'Tabak / Zigaretten',
    street: 'Am Haag',
    houseNumber: '14',
    postCode: '82166',
    city: 'Gräfelfing',
    postalAddress: 'PHILIP MORRIS GmbH, 81367 München',
    phone: '+49 89 72470',
    mobile1: '+49 173 3710432',
    email: 'Sven.Klich@pmi.com',
    website: 'www.pmi.com',
    notes: 'Vertreter / Ansprechpartner Philip Morris',
    isFavorite: true,
  },
  {
    seedKey: 'drachengas-andreas-feketa',
    company: 'Drachen-Propangas GmbH',
    name: 'Andreas Feketa',
    position: 'Regionalvertrieb',
    category: 'Gas / Propangas',
    street: 'Henri-Duffaut-Straße',
    houseNumber: '2',
    postCode: '35578',
    city: 'Wetzlar',
    postalAddress: '',
    phone: '',
    mobile1: '+49 172 6787245',
    email: 'andreas.feketa@drachengas.de',
    website: 'www.drachengas.de',
    notes: 'Ansprechpartner DrachenGas / Propangas',
    isFavorite: true,
  },
]
