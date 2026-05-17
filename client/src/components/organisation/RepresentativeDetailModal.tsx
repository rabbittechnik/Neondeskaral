import type { ReactNode } from 'react'
import { Mail, MapPin, Pencil, Phone, Globe, Star, Trash2, X } from 'lucide-react'
import type { RepresentativeApi } from '../../types/representative'
import {
  categoryBadgeClass,
  formatAddress,
  mailHref,
  primaryPhone,
  telHref,
  webHref,
} from '../../utils/representativeUi'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-[var(--text-faint)]">{label}</dt>
      <dd className="mt-0.5 text-sm text-[var(--text-main)]">{children}</dd>
    </div>
  )
}

function LinkOrDash({ href, text }: { href?: string; text: string }) {
  if (!text) return <span className="text-[var(--text-muted)]">—</span>
  if (!href) return <span>{text}</span>
  return (
    <a
      href={href}
      className="text-cyan-600 underline decoration-cyan-500/40 underline-offset-2 hover:text-cyan-500 dark:text-cyan-300/90 dark:hover:text-cyan-200"
    >
      {text}
    </a>
  )
}

type Props = {
  contact: RepresentativeApi
  canEdit: boolean
  canDelete: boolean
  onClose: () => void
  onEdit: () => void
  onDeactivate: () => void
  onRestore: () => void
  onDeletePermanent: () => void
  onToggleFavorite: () => void
}

export function RepresentativeDetailModal({
  contact: r,
  canEdit,
  canDelete,
  onClose,
  onEdit,
  onDeactivate,
  onRestore,
  onDeletePermanent,
  onToggleFavorite,
}: Props) {
  const archived = Boolean(r.archivedAt) || !r.active
  const addr = formatAddress(r)
  const call = primaryPhone(r)

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-[var(--border-subtle)] bg-[var(--surface-1)] shadow-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border-subtle)] px-4 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-[var(--text-main)]">{r.company}</h2>
              {r.isFavorite ? <Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden /> : null}
            </div>
            <p className="text-sm text-[var(--text-main)]">{r.name}</p>
            {r.position ? <p className="text-xs text-[var(--text-muted)]">{r.position}</p> : null}
            {r.category ? (
              <span
                className={`mt-2 inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${categoryBadgeClass(r.category)}`}
              >
                {r.category}
              </span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--surface-2)]"
            aria-label="Schließen"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <dl className="grid gap-3 sm:grid-cols-2">
            {addr ? (
              <Field label="Adresse">
                <span className="inline-flex items-start gap-1">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--text-faint)]" aria-hidden />
                  {addr}
                </span>
              </Field>
            ) : null}
            {r.postalAddress ? <Field label="Postanschrift">{r.postalAddress}</Field> : null}
            <Field label="Telefon">
              <LinkOrDash href={telHref(r.phone)} text={r.phone} />
            </Field>
            <Field label="Mobil">
              <LinkOrDash href={telHref(r.mobile1)} text={r.mobile1} />
            </Field>
            {r.mobile2 ? (
              <Field label="Mobil 2">
                <LinkOrDash href={telHref(r.mobile2)} text={r.mobile2} />
              </Field>
            ) : null}
            <Field label="Fax">
              <span>{r.fax || '—'}</span>
            </Field>
            <Field label="E-Mail">
              <LinkOrDash href={mailHref(r.email)} text={r.email} />
            </Field>
            <Field label="Webseite">
              <LinkOrDash href={webHref(r.website)} text={r.website} />
            </Field>
            {r.notes ? (
              <div className="sm:col-span-2">
                <Field label="Notizen">
                  <p className="whitespace-pre-wrap">{r.notes}</p>
                </Field>
              </div>
            ) : null}
            <Field label="Status">
              {archived ? (
                <span className="text-amber-700 dark:text-amber-200/90">Inaktiv / archiviert</span>
              ) : (
                <span className="text-emerald-700 dark:text-emerald-300/90">Aktiv</span>
              )}
            </Field>
            <Field label="Visitenkarte">
              <span className="text-[var(--text-muted)]">
                {r.businessCardPath
                  ? 'Foto gespeichert'
                  : 'Noch kein Bild – Upload folgt in einer späteren Version'}
              </span>
            </Field>
          </dl>

          {call ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href={telHref(call)}
                className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/35 bg-cyan-500/10 px-3 py-2 text-sm font-medium text-cyan-800 dark:text-cyan-100"
              >
                <Phone className="h-4 w-4" aria-hidden />
                Anrufen
              </a>
              {r.email ? (
                <a
                  href={mailHref(r.email)}
                  className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2 text-sm font-medium text-[var(--text-main)]"
                >
                  <Mail className="h-4 w-4" aria-hidden />
                  E-Mail
                </a>
              ) : null}
              {r.website ? (
                <a
                  href={webHref(r.website)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2 text-sm font-medium text-[var(--text-main)]"
                >
                  <Globe className="h-4 w-4" aria-hidden />
                  Webseite
                </a>
              ) : null}
            </div>
          ) : null}
        </div>

        {canEdit ? (
          <div className="flex flex-wrap gap-2 border-t border-[var(--border-subtle)] px-4 py-3">
            <button
              type="button"
              onClick={onToggleFavorite}
              className="rounded-lg border border-amber-400/35 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-900 dark:text-amber-100"
            >
              {r.isFavorite ? 'Aus Favoriten' : 'Als wichtig markieren'}
            </button>
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-400/35 bg-cyan-500/10 px-3 py-2 text-xs font-medium text-cyan-900 dark:text-cyan-100"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden />
              Bearbeiten
            </button>
            {archived ? (
              <button
                type="button"
                onClick={onRestore}
                className="rounded-lg border border-emerald-400/35 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-900 dark:text-emerald-100"
              >
                Reaktivieren
              </button>
            ) : (
              <button
                type="button"
                onClick={onDeactivate}
                className="rounded-lg border border-amber-400/35 px-3 py-2 text-xs font-medium text-amber-900 dark:text-amber-100"
              >
                Deaktivieren
              </button>
            )}
            {canDelete ? (
              <button
                type="button"
                onClick={onDeletePermanent}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-400/35 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-800 dark:text-red-100"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                Löschen
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

