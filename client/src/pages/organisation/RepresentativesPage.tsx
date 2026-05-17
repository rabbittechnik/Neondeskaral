import { useCallback, useEffect, useMemo, useState } from 'react'
import { Mail, Pencil, Phone, Globe, Star, Trash2 } from 'lucide-react'
import { useStation } from '../../context/station-context'
import { apiGet, apiSend } from '../../services/api'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card } from '../../components/ui/Card'
import type { RepresentativeApi } from '../../types/representative'
import { REPRESENTATIVE_CATEGORIES } from '../../types/representative'

const CATEGORY_FILTERS = [
  { value: '', label: 'Alle Kategorien' },
  ...REPRESENTATIVE_CATEGORIES.map((c) => ({ value: c, label: c })),
] as const

function telHref(raw: string): string | undefined {
  const t = raw.trim()
  if (!t) return undefined
  const cleaned = t.replace(/[^\d+]/g, '')
  return cleaned ? `tel:${cleaned}` : undefined
}

function mailHref(email: string): string | undefined {
  const e = email.trim()
  return e ? `mailto:${e}` : undefined
}

function webHref(url: string): string | undefined {
  const u = url.trim()
  if (!u) return undefined
  if (/^https?:\/\//i.test(u)) return u
  return `https://${u.replace(/^\/\//, '')}`
}

function formatAddress(r: RepresentativeApi): string {
  const parts: string[] = []
  const line1 = [r.street, r.houseNumber].filter(Boolean).join(' ').trim()
  if (line1) parts.push(line1)
  const line2 = [r.postCode, r.city].filter(Boolean).join(' ').trim()
  if (line2) parts.push(line2)
  return parts.join(', ')
}

function primaryPhone(r: RepresentativeApi): string {
  return r.mobile1.trim() || r.mobile2.trim() || r.phone.trim()
}

type SortMode = 'company' | 'name'

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

function LinkCell({ href, children }: { href?: string; children: string }) {
  if (!children) return <span className="text-[var(--text-muted)]">—</span>
  if (!href) return <span>{children}</span>
  return (
    <a
      href={href}
      className="text-cyan-300/90 underline decoration-cyan-400/40 underline-offset-2 hover:text-cyan-200"
    >
      {children}
    </a>
  )
}

function QuickAction({
  label,
  href,
  icon: Icon,
  disabled,
  onClick,
}: {
  label: string
  href?: string
  icon: typeof Phone
  disabled?: boolean
  onClick?: () => void
}) {
  const cls =
    'inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-main)] transition hover:border-cyan-400/35 hover:bg-cyan-500/10 disabled:pointer-events-none disabled:opacity-40'
  if (href && !disabled) {
    return (
      <a href={href} className={cls}>
        <Icon className="h-3.5 w-3.5 shrink-0 text-cyan-300/90" aria-hidden />
        {label}
      </a>
    )
  }
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={cls}>
      <Icon className="h-3.5 w-3.5 shrink-0 text-cyan-300/90" aria-hidden />
      {label}
    </button>
  )
}

function ContactCard({
  r,
  canEdit,
  onEdit,
  onArchive,
  onRestore,
  onToggleFavorite,
}: {
  r: RepresentativeApi
  canEdit: boolean
  onEdit: () => void
  onArchive: () => void
  onRestore: () => void
  onToggleFavorite: () => void
}) {
  const archived = Boolean(r.archivedAt) || !r.active
  const addr = formatAddress(r)
  const callNumber = primaryPhone(r)
  const callHref = telHref(callNumber)
  const emailHref = mailHref(r.email)
  const siteHref = webHref(r.website)

  return (
    <Card
      padding="md"
      className={`flex flex-col gap-3 ${archived ? 'opacity-70' : ''} ${r.isFavorite ? 'ring-1 ring-amber-400/25' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-[var(--text-main)]">{r.company}</h3>
            {r.isFavorite ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/35 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-100">
                <Star className="h-3 w-3 fill-amber-300 text-amber-300" aria-hidden />
                Wichtig
              </span>
            ) : null}
            {archived ? (
              <span className="rounded-full border border-[var(--border-subtle)] px-2 py-0.5 text-[10px] uppercase text-[var(--text-muted)]">
                Inaktiv
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-sm text-[var(--text-main)]">{r.name}</p>
          {r.position ? <p className="text-xs text-[var(--text-muted)]">{r.position}</p> : null}
          {r.category ? (
            <p className="mt-1.5 inline-block rounded-md border border-fuchsia-400/25 bg-fuchsia-500/10 px-2 py-0.5 text-xs text-fuchsia-100/90">
              {r.category}
            </p>
          ) : null}
        </div>
        {canEdit ? (
          <button
            type="button"
            onClick={onToggleFavorite}
            title={r.isFavorite ? 'Aus Favoriten entfernen' : 'Als wichtig markieren'}
            className="shrink-0 rounded-lg p-1.5 text-amber-200/80 hover:bg-amber-500/10"
          >
            <Star
              className={`h-5 w-5 ${r.isFavorite ? 'fill-amber-300 text-amber-300' : 'text-[var(--text-muted)]'}`}
              aria-hidden
            />
          </button>
        ) : null}
      </div>

      <div className="space-y-1.5 text-sm">
        {addr ? (
          <p>
            <span className="text-[var(--text-muted)]">Adresse: </span>
            {addr}
          </p>
        ) : null}
        {r.postalAddress ? (
          <p>
            <span className="text-[var(--text-muted)]">Postanschrift: </span>
            {r.postalAddress}
          </p>
        ) : null}
        {r.phone ? (
          <p>
            <span className="text-[var(--text-muted)]">Telefon: </span>
            <LinkCell href={telHref(r.phone)}>{r.phone}</LinkCell>
          </p>
        ) : null}
        {r.mobile1 ? (
          <p>
            <span className="text-[var(--text-muted)]">Mobil: </span>
            <LinkCell href={telHref(r.mobile1)}>{r.mobile1}</LinkCell>
          </p>
        ) : null}
        {r.mobile2 ? (
          <p>
            <span className="text-[var(--text-muted)]">Mobil 2: </span>
            <LinkCell href={telHref(r.mobile2)}>{r.mobile2}</LinkCell>
          </p>
        ) : null}
        {r.email ? (
          <p>
            <span className="text-[var(--text-muted)]">E-Mail: </span>
            <LinkCell href={emailHref}>{r.email}</LinkCell>
          </p>
        ) : null}
        {r.website ? (
          <p>
            <span className="text-[var(--text-muted)]">Website: </span>
            <LinkCell href={siteHref}>{r.website}</LinkCell>
          </p>
        ) : null}
        {r.notes ? (
          <p className="text-[var(--text-muted)]">
            <span className="text-[var(--text-faint)]">Notiz: </span>
            {r.notes}
          </p>
        ) : null}
      </div>

      <div className="mt-auto flex flex-wrap gap-2 border-t border-[var(--border-subtle)]/60 pt-3">
        <QuickAction label="Anrufen" href={callHref} icon={Phone} disabled={!callHref} />
        <QuickAction label="E-Mail" href={emailHref} icon={Mail} disabled={!emailHref} />
        <QuickAction label="Website" href={siteHref} icon={Globe} disabled={!siteHref} />
        {canEdit ? (
          <>
            <QuickAction label="Bearbeiten" icon={Pencil} onClick={onEdit} />
            {archived ? (
              <button
                type="button"
                onClick={onRestore}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/35 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-medium text-emerald-100"
              >
                Wiederherstellen
              </button>
            ) : (
              <button
                type="button"
                onClick={onArchive}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/35 bg-amber-500/10 px-2.5 py-1.5 text-xs font-medium text-amber-100"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                Archivieren
              </button>
            )}
          </>
        ) : null}
      </div>
    </Card>
  )
}

export function RepresentativesPage() {
  const { stationId, hasPermission } = useStation()
  const canView = hasPermission('representatives.view') || hasPermission('representatives.edit')
  const canEdit = hasPermission('representatives.edit')

  const [rows, setRows] = useState<RepresentativeApi[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [sortMode, setSortMode] = useState<SortMode>('company')
  const [includeArchived, setIncludeArchived] = useState(false)
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!stationId || !canView) return
    setErr(null)
    const res = await apiGet<RepresentativeApi[]>('/representatives', {
      stationId,
      sort: sortMode,
      includeArchived: includeArchived ? '1' : undefined,
      category: categoryFilter || undefined,
      favoritesOnly: favoritesOnly ? '1' : undefined,
    })
    if (!res.ok) {
      setErr(res.error)
      return
    }
    setRows(res.data)
  }, [stationId, canView, sortMode, includeArchived, categoryFilter, favoritesOnly])

  useEffect(() => {
    void load()
  }, [load])

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
        r.houseNumber,
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
  }

  function openEdit(r: RepresentativeApi) {
    setEditingId(r.id)
    setForm(fromRow(r))
    setModalOpen(true)
  }

  async function saveModal() {
    if (!stationId || !canEdit) return
    setBusy(true)
    setErr(null)
    const body = { ...form }
    const res = editingId
      ? await apiSend<RepresentativeApi>('PUT', `/representatives/${editingId}`, body)
      : await apiSend<RepresentativeApi>('POST', '/representatives', body, { stationId })
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
    const res = await apiSend<RepresentativeApi>('PUT', `/representatives/${r.id}`, {
      isFavorite: !r.isFavorite,
    })
    if (!res.ok) setErr(res.error)
    else void load()
  }

  async function archive(id: string) {
    if (!canEdit) return
    if (!window.confirm('Diesen Kontakt wirklich archivieren? Er wird dann als inaktiv geführt.')) return
    setErr(null)
    const res = await apiSend<RepresentativeApi>('DELETE', `/representatives/${id}`)
    if (!res.ok) setErr(res.error)
    else void load()
  }

  async function restore(id: string) {
    if (!canEdit) return
    setErr(null)
    const res = await apiSend<RepresentativeApi>('POST', `/representatives/${id}/restore`)
    if (!res.ok) setErr(res.error)
    else void load()
  }

  if (!canView) {
    return (
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-6 text-sm text-[var(--text-muted)]">
        Keine Berechtigung für Vertreter und Telefonnummern.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Telefonnummern / Vertreter"
        description="Zentrale Kontakt- und Vertreterverwaltung: Ansprechpartner, Lieferanten, Notfallkontakte und Dienstleister der Station."
        actions={
          canEdit ? (
            <button
              type="button"
              onClick={openCreate}
              className="rounded-lg bg-gradient-to-r from-cyan-500/80 to-fuchsia-600/70 px-4 py-2 text-sm font-semibold text-white shadow-[var(--glow-cyan)]"
            >
              + Kontakt anlegen
            </button>
          ) : null
        }
      />

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Suche nach Firma, Name, Kategorie, Telefon, E-Mail oder Notiz…"
        className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)]"
      />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {CATEGORY_FILTERS.map((f) => (
            <button
              key={f.label}
              type="button"
              onClick={() => setCategoryFilter(f.value)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                categoryFilter === f.value
                  ? 'border-cyan-400/50 bg-cyan-500/15 text-cyan-100'
                  : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-cyan-400/30 hover:text-[var(--text-main)]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--text-muted)]">
            <input
              type="checkbox"
              checked={favoritesOnly}
              onChange={(e) => setFavoritesOnly(e.target.checked)}
              className="rounded border-[var(--border-subtle)] bg-[var(--surface-2)]"
            />
            Nur Favoriten
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--text-muted)]">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(e) => setIncludeArchived(e.target.checked)}
              className="rounded border-[var(--border-subtle)] bg-[var(--surface-2)]"
            />
            Inaktive anzeigen
          </label>
          <div className="flex rounded-lg border border-[var(--border-subtle)] p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                viewMode === 'cards' ? 'bg-cyan-500/20 text-cyan-100' : 'text-[var(--text-muted)]'
              }`}
            >
              Karten
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                viewMode === 'table' ? 'bg-cyan-500/20 text-cyan-100' : 'text-[var(--text-muted)]'
              }`}
            >
              Tabelle
            </button>
          </div>
          <div className="flex rounded-lg border border-[var(--border-subtle)] p-0.5">
            <button
              type="button"
              onClick={() => setSortMode('company')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                sortMode === 'company' ? 'bg-cyan-500/20 text-cyan-100' : 'text-[var(--text-muted)]'
              }`}
            >
              Firma
            </button>
            <button
              type="button"
              onClick={() => setSortMode('name')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                sortMode === 'name' ? 'bg-cyan-500/20 text-cyan-100' : 'text-[var(--text-muted)]'
              }`}
            >
              Name
            </button>
          </div>
        </div>
      </div>

      {err ? (
        <div className="rounded-lg border border-red-400/35 bg-red-500/10 px-3 py-2 text-sm text-red-100">{err}</div>
      ) : null}

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] px-4 py-10 text-center text-sm text-[var(--text-muted)]">
          Kein Kontakt gefunden.
        </div>
      ) : viewMode === 'cards' ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((r) => (
            <ContactCard
              key={r.id}
              r={r}
              canEdit={canEdit}
              onEdit={() => openEdit(r)}
              onArchive={() => void archive(r.id)}
              onRestore={() => void restore(r.id)}
              onToggleFavorite={() => void toggleFavorite(r)}
            />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)]">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-2)]/80 text-xs uppercase tracking-wide text-[var(--text-muted)]">
                <th className="px-3 py-3 font-medium">Firma</th>
                <th className="px-3 py-3 font-medium">Ansprechpartner</th>
                <th className="px-3 py-3 font-medium">Position</th>
                <th className="px-3 py-3 font-medium">Kategorie</th>
                <th className="px-3 py-3 font-medium">Telefon</th>
                <th className="px-3 py-3 font-medium">E-Mail</th>
                <th className="px-3 py-3 font-medium text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const archived = Boolean(r.archivedAt) || !r.active
                const call = primaryPhone(r)
                return (
                  <tr
                    key={r.id}
                    className={`border-b border-[var(--border-subtle)]/60 last:border-0 ${archived ? 'opacity-60' : ''}`}
                  >
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5 font-medium text-[var(--text-main)]">
                        {r.isFavorite ? <Star className="h-3.5 w-3.5 fill-amber-300 text-amber-300" aria-hidden /> : null}
                        {r.company}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">{r.name}</td>
                    <td className="px-3 py-2.5 text-[var(--text-muted)]">{r.position || '—'}</td>
                    <td className="px-3 py-2.5 text-[var(--text-muted)]">{r.category || '—'}</td>
                    <td className="px-3 py-2.5">
                      <LinkCell href={telHref(call)}>{call || '—'}</LinkCell>
                    </td>
                    <td className="px-3 py-2.5">
                      <LinkCell href={mailHref(r.email)}>{r.email || '—'}</LinkCell>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex justify-end gap-1">
                        <QuickAction label="Anrufen" href={telHref(call)} icon={Phone} disabled={!call} />
                        {canEdit ? (
                          <QuickAction label="Bearbeiten" icon={Pencil} onClick={() => openEdit(r)} />
                        ) : null}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-[min(95vw,720px)] overflow-y-auto rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-[var(--text-main)]">
              {editingId ? 'Kontakt bearbeiten' : 'Neuer Kontakt'}
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                <span className="text-[var(--text-muted)]">Firma *</span>
                <input
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2"
                  value={form.company}
                  onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-[var(--text-muted)]">Ansprechpartner / Name *</span>
                <input
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-[var(--text-muted)]">Position</span>
                <input
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2"
                  value={form.position}
                  onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                <span className="text-[var(--text-muted)]">Kategorie</span>
                <select
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                >
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
                <input
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2"
                  value={form.street}
                  onChange={(e) => setForm((f) => ({ ...f, street: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-[var(--text-muted)]">Hausnummer</span>
                <input
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2"
                  value={form.houseNumber}
                  onChange={(e) => setForm((f) => ({ ...f, houseNumber: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-[var(--text-muted)]">PLZ</span>
                <input
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2"
                  value={form.postCode}
                  onChange={(e) => setForm((f) => ({ ...f, postCode: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-[var(--text-muted)]">Ort</span>
                <input
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2"
                  value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                <span className="text-[var(--text-muted)]">Postanschrift (optional)</span>
                <input
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2"
                  value={form.postalAddress}
                  onChange={(e) => setForm((f) => ({ ...f, postalAddress: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-[var(--text-muted)]">Telefon</span>
                <input
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-[var(--text-muted)]">Mobil</span>
                <input
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2"
                  value={form.mobile1}
                  onChange={(e) => setForm((f) => ({ ...f, mobile1: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-[var(--text-muted)]">Mobil 2</span>
                <input
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2"
                  value={form.mobile2}
                  onChange={(e) => setForm((f) => ({ ...f, mobile2: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-[var(--text-muted)]">Fax</span>
                <input
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2"
                  value={form.fax}
                  onChange={(e) => setForm((f) => ({ ...f, fax: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-[var(--text-muted)]">E-Mail</span>
                <input
                  type="email"
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                <span className="text-[var(--text-muted)]">Website</span>
                <input
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2"
                  value={form.website}
                  onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
                  placeholder="www.beispiel.de"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                <span className="text-[var(--text-muted)]">Notizen</span>
                <textarea
                  rows={3}
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isFavorite}
                  onChange={(e) => setForm((f) => ({ ...f, isFavorite: e.target.checked }))}
                  className="rounded border-[var(--border-subtle)]"
                />
                Als wichtigen Kontakt markieren
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                  className="rounded border-[var(--border-subtle)]"
                />
                Aktiv
              </label>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg border border-[var(--border-subtle)] px-4 py-2 text-sm text-[var(--text-muted)] hover:bg-white/5"
              >
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
