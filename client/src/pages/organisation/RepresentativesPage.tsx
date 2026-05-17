import { useCallback, useEffect, useMemo, useState } from 'react'
import { Mail, Phone, Star, Search } from 'lucide-react'
import { useStation } from '../../context/station-context'
import { apiGet, apiSend } from '../../services/api'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card } from '../../components/ui/Card'
import { RepresentativeDetailModal } from '../../components/organisation/RepresentativeDetailModal'
import type { RepresentativeApi } from '../../types/representative'
import { REPRESENTATIVE_CATEGORIES } from '../../types/representative'
import { categoryBadgeClass, primaryPhone } from '../../utils/representativeUi'

type FormState = {
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
  active: boolean
  isFavorite: boolean
}

function emptyForm(): FormState {
  return {
    company: '',
    name: '',
    position: '',
    email: '',
    street: '',
    houseNumber: '',
    postCode: '',
    city: '',
    postalAddress: '',
    phone: '',
    mobile1: '',
    mobile2: '',
    fax: '',
    website: '',
    category: '',
    notes: '',
    active: true,
    isFavorite: false,
  }
}

function fromRow(r: RepresentativeApi): FormState {
  return {
    company: r.company,
    name: r.name,
    position: r.position,
    email: r.email,
    street: r.street,
    houseNumber: r.houseNumber,
    postCode: r.postCode,
    city: r.city,
    postalAddress: r.postalAddress,
    phone: r.phone,
    mobile1: r.mobile1,
    mobile2: r.mobile2,
    fax: r.fax,
    website: r.website,
    category: r.category,
    notes: r.notes,
    active: r.active,
    isFavorite: r.isFavorite,
  }
}

const inputClass =
  'w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-main)]'

export function RepresentativesPage() {
  const { stationId, hasPermission } = useStation()
  const canView = hasPermission('representatives.view') || hasPermission('representatives.edit')
  const canEdit = hasPermission('representatives.edit')
  const canDelete = hasPermission('representatives.delete')

  const [rows, setRows] = useState<RepresentativeApi[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [includeArchived, setIncludeArchived] = useState(false)
  const [detail, setDetail] = useState<RepresentativeApi | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!stationId || !canView) return
    setErr(null)
    const res = await apiGet<RepresentativeApi[]>('/representatives', {
      stationId,
      sort: 'company',
      includeArchived: includeArchived ? '1' : undefined,
      category: categoryFilter || undefined,
      favoritesOnly: favoritesOnly ? '1' : undefined,
    })
    if (!res.ok) {
      setErr(res.error)
      setRows([])
      return
    }
    setRows(res.data)
  }, [stationId, canView, includeArchived, categoryFilter, favoritesOnly])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!detail) return
    const fresh = rows.find((r) => r.id === detail.id)
    if (fresh) setDetail(fresh)
  }, [rows, detail?.id])

  const categoryOptions = useMemo(() => {
    const fromData = new Set(rows.map((r) => r.category).filter(Boolean))
    for (const c of REPRESENTATIVE_CATEGORIES) fromData.add(c)
    return [...fromData].sort((a, b) => a.localeCompare(b, 'de'))
  }, [rows])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    const words = q.split(/\s+/).filter(Boolean)
    return rows.filter((r) => {
      const hay = [
        r.company,
        r.name,
        r.position,
        r.category,
        r.email,
        r.phone,
        r.mobile1,
        r.mobile2,
        r.fax,
        r.website,
        r.city,
        r.postCode,
        r.street,
        r.postalAddress,
        r.notes,
      ]
        .join(' ')
        .toLowerCase()
      return words.every((w) => hay.includes(w))
    })
  }, [rows, search])

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm())
    setModalOpen(true)
    setDetail(null)
  }

  function openEdit(r: RepresentativeApi) {
    setEditingId(r.id)
    setForm(fromRow(r))
    setModalOpen(true)
    setDetail(null)
  }

  async function saveModal() {
    if (!stationId || !canEdit) return
    setBusy(true)
    setErr(null)
    const res = editingId
      ? await apiSend<RepresentativeApi>('PUT', `/representatives/${editingId}`, form)
      : await apiSend<RepresentativeApi>('POST', '/representatives', form, { stationId })
    setBusy(false)
    if (!res.ok) {
      setErr(res.error)
      return
    }
    setModalOpen(false)
    void load()
  }

  async function toggleFavorite(r: RepresentativeApi) {
    if (!canEdit) return
    const res = await apiSend<RepresentativeApi>('PUT', `/representatives/${r.id}`, { isFavorite: !r.isFavorite })
    if (!res.ok) setErr(res.error)
    else void load()
  }

  async function deactivate(id: string) {
    if (!canEdit) return
    if (!window.confirm('Kontakt deaktivieren? Er erscheint nicht mehr in der aktiven Liste.')) return
    const res = await apiSend<RepresentativeApi>('DELETE', `/representatives/${id}`)
    if (!res.ok) setErr(res.error)
    else {
      setDetail(null)
      void load()
    }
  }

  async function restore(id: string) {
    if (!canEdit) return
    const res = await apiSend<RepresentativeApi>('POST', `/representatives/${id}/restore`)
    if (!res.ok) setErr(res.error)
    else void load()
  }

  async function deletePermanent(id: string) {
    if (!canDelete) return
    if (!window.confirm('Kontakt endgültig löschen? Dies kann nicht rückgängig gemacht werden.')) return
    const res = await apiSend<{ deleted: boolean }>('DELETE', `/representatives/${id}`, undefined, {
      permanent: '1',
    })
    if (!res.ok) setErr(res.error)
    else {
      setDetail(null)
      void load()
    }
  }

  if (!canView) {
    return (
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-6 text-sm text-[var(--text-muted)]">
        Keine Berechtigung für Vertreter und Telefonnummern.
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Telefonnummern / Vertreter"
        description="Zentrale Vertreter- und Lieferantenliste der Station – durchsuchbar, nach Kategorie filterbar."
        actions={
          canEdit ? (
            <button
              type="button"
              onClick={openCreate}
              className="rounded-lg bg-gradient-to-r from-cyan-500/80 to-fuchsia-600/70 px-4 py-2 text-sm font-semibold text-white shadow-[var(--glow-cyan)]"
            >
              + Neuer Kontakt
            </button>
          ) : null
        }
      />

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-faint)]" aria-hidden />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Suche nach Firma, Name, Kategorie, Telefon, E-Mail oder Notiz…"
          className={`${inputClass} pl-10`}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setCategoryFilter('')}
          className={`rounded-full border px-3 py-1 text-xs font-medium ${
            !categoryFilter
              ? 'border-cyan-400/50 bg-cyan-500/15 text-cyan-900 dark:text-cyan-100'
              : 'border-[var(--border-subtle)] text-[var(--text-muted)]'
          }`}
        >
          Alle
        </button>
        {categoryOptions.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategoryFilter(c)}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              categoryFilter === c
                ? 'border-cyan-400/50 bg-cyan-500/15 text-cyan-900 dark:text-cyan-100'
                : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-[var(--text-muted)]">
        <label className="flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={favoritesOnly} onChange={(e) => setFavoritesOnly(e.target.checked)} />
          Nur wichtige Kontakte
        </label>
        <label className="flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} />
          Inaktive anzeigen
        </label>
        <span>{filtered.length} Kontakt{filtered.length === 1 ? '' : 'e'}</span>
      </div>

      {err ? (
        <div className="rounded-lg border border-red-400/35 bg-red-500/10 px-3 py-2 text-sm text-red-800 dark:text-red-100">
          {err}
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <Card padding="lg" className="text-center text-sm text-[var(--text-muted)]">
          Kein Kontakt gefunden.
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((r) => {
            const archived = Boolean(r.archivedAt) || !r.active
            const call = primaryPhone(r)
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setDetail(r)}
                className={`flex flex-col rounded-xl border bg-[var(--surface-1)] p-4 text-left transition hover:border-cyan-400/40 hover:shadow-[0_0_24px_rgba(34,211,238,0.1)] ${
                  r.isFavorite ? 'border-amber-400/35 ring-1 ring-amber-400/20' : 'border-[var(--border-subtle)]'
                } ${archived ? 'opacity-65' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {r.isFavorite ? <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden /> : null}
                      <span className="truncate font-semibold text-[var(--text-main)]">{r.company}</span>
                    </div>
                    <p className="truncate text-sm text-[var(--text-main)]">{r.name}</p>
                    {r.position ? <p className="truncate text-xs text-[var(--text-muted)]">{r.position}</p> : null}
                  </div>
                </div>
                {r.category ? (
                  <span
                    className={`mt-2 inline-block max-w-full truncate rounded-full border px-2 py-0.5 text-[10px] font-medium ${categoryBadgeClass(r.category)}`}
                  >
                    {r.category}
                  </span>
                ) : null}
                <div className="mt-3 space-y-1 text-xs text-[var(--text-muted)]">
                  {call ? (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" aria-hidden />
                      {call}
                    </span>
                  ) : null}
                  {r.email ? (
                    <span className="flex items-center gap-1 truncate">
                      <Mail className="h-3 w-3 shrink-0" aria-hidden />
                      {r.email}
                    </span>
                  ) : null}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {detail ? (
        <RepresentativeDetailModal
          contact={detail}
          canEdit={canEdit}
          canDelete={canDelete}
          onClose={() => setDetail(null)}
          onEdit={() => openEdit(detail)}
          onDeactivate={() => void deactivate(detail.id)}
          onRestore={() => void restore(detail.id)}
          onDeletePermanent={() => void deletePermanent(detail.id)}
          onToggleFavorite={() => void toggleFavorite(detail)}
        />
      ) : null}

      {modalOpen ? (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-[var(--text-main)]">
              {editingId ? 'Kontakt bearbeiten' : 'Neuer Kontakt'}
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                <span className="text-[var(--text-muted)]">Firma *</span>
                <input className={inputClass} value={form.company} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-[var(--text-muted)]">Ansprechpartner *</span>
                <input className={inputClass} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-[var(--text-muted)]">Position / Funktion</span>
                <input className={inputClass} value={form.position} onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))} />
              </label>
              <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                <span className="text-[var(--text-muted)]">Kategorie</span>
                <select className={inputClass} value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
                  <option value="">—</option>
                  {REPRESENTATIVE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-[var(--text-muted)]">Straße</span>
                <input className={inputClass} value={form.street} onChange={(e) => setForm((f) => ({ ...f, street: e.target.value }))} />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-[var(--text-muted)]">Hausnr.</span>
                <input className={inputClass} value={form.houseNumber} onChange={(e) => setForm((f) => ({ ...f, houseNumber: e.target.value }))} />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-[var(--text-muted)]">PLZ</span>
                <input className={inputClass} value={form.postCode} onChange={(e) => setForm((f) => ({ ...f, postCode: e.target.value }))} />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-[var(--text-muted)]">Ort</span>
                <input className={inputClass} value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
              </label>
              <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                <span className="text-[var(--text-muted)]">Postanschrift (optional)</span>
                <input className={inputClass} value={form.postalAddress} onChange={(e) => setForm((f) => ({ ...f, postalAddress: e.target.value }))} />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-[var(--text-muted)]">Telefon</span>
                <input className={inputClass} value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-[var(--text-muted)]">Mobil</span>
                <input className={inputClass} value={form.mobile1} onChange={(e) => setForm((f) => ({ ...f, mobile1: e.target.value }))} />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-[var(--text-muted)]">Mobil 2 / Zusatz</span>
                <input className={inputClass} value={form.mobile2} onChange={(e) => setForm((f) => ({ ...f, mobile2: e.target.value }))} />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-[var(--text-muted)]">Fax</span>
                <input className={inputClass} value={form.fax} onChange={(e) => setForm((f) => ({ ...f, fax: e.target.value }))} />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-[var(--text-muted)]">E-Mail</span>
                <input type="email" className={inputClass} value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              </label>
              <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                <span className="text-[var(--text-muted)]">Webseite</span>
                <input className={inputClass} value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} placeholder="www.beispiel.de" />
              </label>
              <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                <span className="text-[var(--text-muted)]">Notizen</span>
                <textarea rows={3} className={inputClass} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
              </label>
              <p className="sm:col-span-2 text-xs text-[var(--text-faint)]">
                Visitenkarten-Foto: Upload wird in einer späteren Version ergänzt (Feld in der Datenbank ist vorbereitet).
              </p>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.isFavorite} onChange={(e) => setForm((f) => ({ ...f, isFavorite: e.target.checked }))} />
                Wichtiger Kontakt
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} />
                Aktiv
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg border border-[var(--border-subtle)] px-4 py-2 text-sm text-[var(--text-muted)]">
                Abbrechen
              </button>
              <button
                type="button"
                disabled={busy || !form.company.trim() || !form.name.trim()}
                onClick={() => void saveModal()}
                className="rounded-lg bg-gradient-to-r from-cyan-500/80 to-fuchsia-600/70 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
              >
                Speichern
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

