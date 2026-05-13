import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { Button } from '../ui/Button'
import { X } from 'lucide-react'

const REGION_ID = 'tablet-qr-scanner-region'

type Props = {
  open: boolean
  onClose: () => void
  /** Nach erfolgreichem Decode (Rohstring aus QR); Kamera ist bereits gestoppt. */
  onDecoded: (rawText: string) => void
}

export function TabletQrScannerModal({ open, onClose, onDecoded }: Props) {
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const decodingRef = useRef(false)

  useEffect(() => {
    if (!open) {
      decodingRef.current = false
      const s = scannerRef.current
      scannerRef.current = null
      if (s) {
        s.stop()
          .catch(() => {})
          .finally(() => {
            try {
              s.clear()
            } catch {
              /* ignore */
            }
          })
      }
      setCameraError(null)
      return
    }

    setCameraError(null)
    decodingRef.current = false
    let cancelled = false

    const start = async () => {
      await new Promise((r) => requestAnimationFrame(() => r(null)))
      if (cancelled) return

      const html5 = new Html5Qrcode(REGION_ID, { verbose: false })
      scannerRef.current = html5

      const config = {
        fps: 8,
        qrbox: { width: 260, height: 260 },
        aspectRatio: 1,
      }

      const onScanSuccess = async (text: string) => {
        if (cancelled || decodingRef.current) return
        decodingRef.current = true
        try {
          await html5.stop()
        } catch {
          /* ignore */
        }
        try {
          html5.clear()
        } catch {
          /* ignore */
        }
        scannerRef.current = null
        if (!cancelled) onDecoded(text)
      }

      const tryStart = async (constraints: { facingMode: string } | { deviceId: { exact: string } }) => {
        await html5.start(constraints, config, onScanSuccess, () => {})
      }

      const failCleanup = () => {
        try {
          html5.stop().catch(() => {})
        } catch {
          /* ignore */
        }
        try {
          html5.clear()
        } catch {
          /* ignore */
        }
        if (scannerRef.current === html5) scannerRef.current = null
      }

      try {
        await tryStart({ facingMode: 'environment' })
      } catch {
        try {
          await tryStart({ facingMode: 'user' })
        } catch {
          try {
            const devices = await Html5Qrcode.getCameras()
            if (devices.length > 0 && !cancelled) {
              await tryStart({ deviceId: { exact: devices[0]!.id } })
            } else {
              throw new Error('no camera')
            }
          } catch {
            failCleanup()
            if (!cancelled) {
              setCameraError(
                'Kamera konnte nicht geöffnet werden. Bitte erlaube den Kamerazugriff oder gib den Tablet-Link manuell ein.',
              )
            }
          }
        }
      }
    }

    void start()

    return () => {
      cancelled = true
      decodingRef.current = false
      const s = scannerRef.current
      scannerRef.current = null
      if (s) {
        s.stop()
          .catch(() => {})
          .finally(() => {
            try {
              s.clear()
            } catch {
              /* ignore */
            }
          })
      }
    }
  }, [open, onDecoded])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
      <div
        className="relative w-full max-w-md rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow-card)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tablet-qr-title"
      >
        <button
          type="button"
          className="absolute right-3 top-3 rounded-[var(--radius-sm)] p-1.5 text-[var(--text-muted)] hover:bg-white/5 hover:text-[var(--text-main)]"
          aria-label="Schließen"
          onClick={onClose}
        >
          <X className="h-5 w-5" />
        </button>
        <h2 id="tablet-qr-title" className="pr-10 text-lg font-semibold text-[var(--text-main)]">
          Stations-QR-Code scannen
        </h2>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Scanne den QR-Code aus „Mein Konto → Geräte & Apps → Stations-Tablets“.
        </p>

        {cameraError ? (
          <p className="mt-4 rounded-lg border border-amber-400/35 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            {cameraError}
          </p>
        ) : null}
        <div
          id={REGION_ID}
          className="mt-4 w-full min-h-[200px] overflow-hidden rounded-lg bg-black/40 [&_video]:mx-auto [&_video]:max-h-[min(50vh,320px)]"
        />

        <div className="mt-5 flex justify-end">
          <Button type="button" variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
        </div>
      </div>
    </div>
  )
}
