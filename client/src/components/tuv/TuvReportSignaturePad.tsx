import { useRef, useEffect } from 'react'

type Props = {
  value: string
  onChange: (dataUrl: string) => void
  disabled?: boolean
}

export function TuvReportSignaturePad({ value, onChange, disabled }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawing = useRef(false)
  const last = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, c.width, c.height)
    if (value) {
      const img = new Image()
      img.onload = () => {
        ctx.clearRect(0, 0, c.width, c.height)
        ctx.drawImage(img, 0, 0, c.width, c.height)
      }
      img.src = value
    }
  }, [value])

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current
    if (!c) return { x: 0, y: 0 }
    const r = c.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled) return
    const c = canvasRef.current
    if (!c) return
    c.setPointerCapture(e.pointerId)
    drawing.current = true
    last.current = pos(e)
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || disabled) return
    const c = canvasRef.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx || !last.current) return
    const p = pos(e)
    ctx.strokeStyle = '#111'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(last.current.x, last.current.y)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    last.current = p
  }

  function end() {
    if (!drawing.current) return
    drawing.current = false
    last.current = null
    const c = canvasRef.current
    if (c) onChange(c.toDataURL('image/png'))
  }

  function clear() {
    if (disabled) return
    const c = canvasRef.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    ctx.clearRect(0, 0, c.width, c.height)
    onChange('')
  }

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        width={560}
        height={180}
        className={`w-full max-w-xl touch-none rounded-lg border border-[var(--border-subtle)] bg-white ${disabled ? 'opacity-50' : 'cursor-crosshair'}`}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={clear}
        className="rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-sm text-[var(--text-muted)] hover:bg-[var(--surface-2)] disabled:opacity-40"
      >
        Unterschrift löschen
      </button>
    </div>
  )
}
