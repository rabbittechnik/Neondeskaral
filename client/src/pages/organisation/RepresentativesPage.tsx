import { useCallback, useEffect, useMemo, useState } from 'react'
import { useStation } from '../../context/station-context'
import { apiGet, apiSend } from '../../services/api'
import { PageHeader } from '../../components/ui/PageHeader'
import type { RepresentativeApi } from '../../types/representative'
import { REPRESENTATIVE_CATEGORIES } from '../../types/representative'

const CATEGORY_FILTERS = [
  { value: '', label: 'Alle' },
  { value: 'Vertreter', label: 'Vertreter' },
  { value: 'Lieferant', label: 'Lieferant' },
  { value: 'Wartung / Service', label: 'Wartung / Service' },
  { value: 'Sonstige', label: 'Sonstige' },
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

function formatAddress(r: RepresentativeApi): string {
  const parts: string[] = []
  const line1 = [r.street, r.houseNumber].filter(Boolean).join(' ').trim()
  if (line1) parts.push(line1)
  const line2 = [r.postCode, r.city].filter(Boolean).join(' ').trim()
  if (line2) parts.push(line2)
  return parts.join(', ')
}

type SortMode = 'company' | 'name'

type FormState = {
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
}

function emptyForm(): FormState {
  return {
    company: '',
    name: '',
    email: '',
    street: '',
    houseNumber: '',
    postCode: '',
    city: '',
    phone: '',
    mobile1: '',
    mobile2: '',
    fax: '',
    category: '',
    notes: '',
  }
}

function fromRow(r: RepresentativeApi): FormState {
  return {
    company: r.company,
    name: r.name,
    email: r.email,
    street: r.street,
    houseNumber: r.houseNumber,
    postCode: r.postCode,
    city: r.city,
    phone: r.phone,
    mobile1: r.mobile1,
    mobile2: r.mobile2,
    fax: r.fax,
    category: r.category,
    notes: r.notes,
  }
}

function LinkCell({ href, children }: { href?: string; children: string }) {
  if (!children) return <span className="text-[var(--text-muted)]">—</span>
  if (!href) return <span>{children}</span>
  return (
    <a href={href} className="text-cyan-300/90 underline decoration-cyan-400/40 underline-offset-2 hover:text-cyan-200">
      {children}
    </a>
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
  const [sortMode, setSortMode] = useState<SortMode>('company')
  const [includeArchived, setIncludeArchived] = useState(false)
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
    })
    if (!res.ok) {
      setErr(res.error)
      return
    }
    setRows(res.data)
  }, [stationId, canView, sortMode, includeArchived, categoryFilter])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    const words = q.split(/\s+/).filter(Boolean)
    return rows.filter((r) => {
      const hay = [
        r.name,
        r.company,
        r.email,
        r.phone,
        r.mobile1,
        r.mobile2,
        r.fax,
        r.city,
        r.postCode,
        r.street,
        r.houseNumber,
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
    const body = {
      company: form.company,
      name: form.name,
      email: form.email,
      street: form.street,
      houseNumber: form.houseNumber,
      postCode: form.postCode,
      city: form.city,
      phone: form.phone,
      mobile1: form.mobile1,
      mobile2: form.mobile2,
      fax: form.fax,
      category: form.category,
      notes: form.notes,
    }
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

  async function archive(id: string) {
    if (!canEdit) return
    if (
      !window.confirm(
        'Diesen Vertreter wirklich archivieren? Er wird dann nicht mehr in der normalen Liste angezeigt.',
      )
    ) {
      return
    }
    setErr(null)
    const res = await apiSend<RepresentativeApi>('POST', `/representatives/${id}/archive`)
    if (!res.ok) {
      setErr(res.error)
      return
    }
    void load()
  }

  async function restore(id: string) {
    if (!canEdit) return
    setErr(null)
    const res = await apiSend<RepresentativeApi>('POST', `/representatives/${id}/restore`)
    if (!res.ok) {
      setErr(res.error)
      return
    }
    void load()
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
        title="Wichtige Telefonnummern / Vertreter"
        description="Vertreter, Lieferantenkontakte und wichtige Ansprechpartner der Station."
        actions={
          canEdit ? (
            <button
              type="button"
              onClick={openCreate}
              className="rounded-lg bg-gradient-to-r from-cyan-500/80 to-fuchsia-600/70 px-4 py-2 text-sm font-semibold text-white shadow-[var(--glow-cyan)]"
            >
              + Vertreter hinzufügen
            </button>
          ) : null
        }
      />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Nach Name, Firma, E-Mail oder Telefonnummer suchen…"
          className="w-full max-w-xl rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)]"
        />
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Sortierung</span>
          <div className="flex rounded-lg border border-[var(--border-subtle)] p-0.5">
            <button
              type="button"
              onClick={() => setSortMode('company')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                sortMode === 'company'
                  ? 'bg-cyan-500/20 text-cyan-100'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              Nach Firma
            </button>
            <button
              type="button"
              onClick={() => setSortMode('name')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                sortMode === 'name'
                  ? 'bg-cyan-500/20 text-cyan-100'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              Nach Name
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
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
        <label className="ml-auto flex cursor-pointer items-center gap-2 text-xs text-[var(--text-muted)]">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(e) => setIncludeArchived(e.target.checked)}
            className="rounded border-[var(--border-subtle)] bg-[var(--surface-2)]"
          />
          Archivierte anzeigen
        </label>
      </div>

      {err ? (
        <div className="rounded-lg border border-red-400/35 bg-red-500/10 px-3 py-2 text-sm text-red-100">{err}</div>
      ) : null}

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] px-4 py-10 text-center text-sm text-[var(--text-muted)]">
          Kein Vertreter gefunden.
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] md:block">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-2)]/80 text-xs uppercase tracking-wide text-[var(--text-muted)]">
                  <th className="px-3 py-3 font-medium">Firma</th>
                  <th className="px-3 py-3 font-medium">Vertreter</th>
                  <th className="px-3 py-3 font-medium">E-Mail</th>
                  <th className="px-3 py-3 font-medium">Festnetz</th>
                  <th className="px-3 py-3 font-medium">Handy 1</th>
                  <th className="px-3 py-3 font-medium">Handy 2</th>
                  <th className="px-3 py-3 font-medium">Fax</th>
                  <th className="px-3 py-3 font-medium">Ort</th>
                  <th className="px-3 py-3 font-medium text-right">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const archived = Boolean(r.archivedAt) || !r.active
                  return (
                    <tr
                      key={r.id}
                      className={`border-b border-[var(--border-subtle)]/60 last:border-0 ${
                        archived ? 'opacity-60' : ''
                      }`}
                    >
                      <td className="px-3 py-2.5 font-medium text-[var(--text-main)]">{r.company}</td>
                      <td className="px-3 py-2.5 text-[var(--text-main)]">{r.name}</td>
                      <td className="px-3 py-2.5">
                        <LinkCell href={mailHref(r.email)}>{r.email}</LinkCell>
                      </td>
                      <td className="px-3 py-2.5">
                        <LinkCell href={telHref(r.phone)}>{r.phone}</LinkCell>
                      </td>
                      <td className="px-3 py-2.5">
                        <LinkCell href={telHref(r.mobile1)}>{r.mobile1}</LinkCell>
                      </td>
                      <td className="px-3 py-2.5">
                        <LinkCell href={telHref(r.mobile2)}>{r.mobile2}</LinkCell>
                      </td>
                      <td className="px-3 py-2.5 text-[var(--text-muted)]">{r.fax || '—'}</td>
                      <td className="px-3 py-2.5 text-[var(--text-muted)]">{r.city || '—'}</td>
                      <td className="px-3 py-2.5 text-right">
                        <div className="flex justify-end gap-2">
                          {canEdit ? (
                            <>
                              <button
                                type="button"
                                onClick={() => openEdit(r)}
                                className="text-xs font-medium text-cyan-300 hover:text-cyan-200"
                              >
                                Bearbeiten
                              </button>
                              {archived ? (
                                <button
                                  type="button"
                                  onClick={() => void restore(r.id)}
                                  className="text-xs font-medium text-emerald-300 hover:text-emerald-200"
                                >
                                  Wiederherstellen
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => void archive(r.id)}
                                  className="text-xs font-medium text-amber-200/90 hover:text-amber-100"
                                >
                                  Archivieren
                                </button>
                              )}
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 md:hidden">
            {filtered.map((r) => {
              const archived = Boolean(r.archivedAt) || !r.active
              const addr = formatAddress(r)
              return (
                <div
                  key={r.id}
                  className={`rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-4 text-sm ${
                    archived ? 'opacity-70' : ''
                  }`}
                >
                  <div className="text-base font-semibold text-[var(--text-main)]">{r.company}</div>
                  <div className="mt-0.5 text-[var(--text-muted)]">Vertreter: {r.name}</div>
                  {r.category ? (
                    <div className="mt-1 text-xs text-fuchsia-200/80">Kategorie: {r.category}</div>
                  ) : null}
                  <div className="mt-3 space-y-1.5 text-[var(--text-main)]">
                    {r.email ? (
                      <div>
                        <span className="text-[var(--text-muted)]">E-Mail: </span>
                        <LinkCell href={mailHref(r.email)}>{r.email}</LinkCell>
                      </div>
                    ) : null}
                    {r.phone ? (
                      <div>
                        <span className="text-[var(--text-muted)]">Festnetz: </span>
                        <LinkCell href={telHref(r.phone)}>{r.phone}</LinkCell>
                      </div>
                    ) : null}
                    {r.mobile1 ? (
                      <div>
                        <span className="text-[var(--text-muted)]">Handy 1: </span>
                        <LinkCell href={telHref(r.mobile1)}>{r.mobile1}</LinkCell>
                      </div>
                    ) : null}
                    {r.mobile2 ? (
                      <div>
                        <span className="text-[var(--text-muted)]">Handy 2: </span>
                        <LinkCell href={telHref(r.mobile2)}>{r.mobile2}</LinkCell>
                      </div>
                    ) : null}
                    {r.fax ? (
                      <div>
                        <span className="text-[var(--text-muted)]">Fax: </span>
                        <span>{r.fax}</span>
                      </div>
                    ) : null}
                    {addr ? (
                      <div>
                        <span className="text-[var(--text-muted)]">Adresse: </span>
                        {addr}
                      </div>
                    ) : null}
                  </div>
                  {canEdit ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(r)}
                        className="rounded-lg border border-cyan-400/35 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-100"
                      >
                        Bearbeiten
                      </button>
                      {archived ? (
                        <button
                          type="button"
                          onClick={() => void restore(r.id)}
                          className="rounded-lg border border-emerald-400/35 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-100"
                        >
                          Wiederherstellen
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void archive(r.id)}
                          className="rounded-lg border border-amber-400/35 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-100"
                        >
                          Archivieren
                        </button>
                      )}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </>
      )}

      {modalOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-[min(95vw,1100px)] max-w-[1100px] overflow-y-auto rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-[var(--text-main)]">
              {editingId ? 'Vertreter bearbeiten' : 'Vertreter hinzufügen'}
            </h2>
            <div className="mt-4 grid gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-[var(--text-muted)]">Firma *</span>
                <input
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2"
                  value={form.company}
                  onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-[var(--text-muted)]">Name des Vertreters *</span>
                <input
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
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
              <div className="grid grid-cols-2 gap-3">
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
              </div>
              <div className="grid grid-cols-2 gap-3">
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
              </div>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-[var(--text-muted)]">Festnetz</span>
                <input
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-[var(--text-muted)]">Handynummer 1</span>
                <input
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2"
                  value={form.mobile1}
                  onChange={(e) => setForm((f) => ({ ...f, mobile1: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-[var(--text-muted)]">Handynummer 2</span>
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
                <span className="text-[var(--text-muted)]">Notizen</span>
                <textarea
                  rows={3}
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                />
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
