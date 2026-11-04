import React, { useRef, useState } from 'react'

export function SignaturePad({
  onSaveSvg,
  savedSvg
}: {
  onSaveSvg: (svgString: string) => void
  savedSvg?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [drawing, setDrawing] = useState(false)
  const [paths, setPaths] = useState<string[]>([])
  const [currentPath, setCurrentPath] = useState<string>('')

  const getCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    if ('touches' in e) {
      const t = e.touches[0]
      return {
        x: Math.round(t.clientX - rect.left),
        y: Math.round(t.clientY - rect.top)
      }
    }
    return {
      x: Math.round(e.clientX - rect.left),
      y: Math.round(e.clientY - rect.top)
    }
  }

  const startDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const { x, y } = getCoords(e)
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) {
      ctx.strokeStyle = '#0f172a'
      ctx.lineWidth = 2.5
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(x, y)
    }
    setDrawing(true)
    setCurrentPath(`M ${x} ${y}`)
  }

  const moveDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!drawing) return
    const { x, y } = getCoords(e)
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) {
      ctx.lineTo(x, y)
      ctx.stroke()
    }
    setCurrentPath((prev) => `${prev} L ${x} ${y}`)
  }

  const endDraw = () => {
    if (!drawing) return
    setDrawing(false)
    if (currentPath) {
      const nextPaths = [...paths, currentPath]
      setPaths(nextPaths)
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 110" width="360" height="110">${nextPaths
        .map(
          (d) =>
            `<path d="${d}" stroke="#0f172a" stroke-width="2.5" fill="none" stroke-linecap="round"/>`
        )
        .join('')}</svg>`
      onSaveSvg(svg)
    }
    setCurrentPath('')
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
    setPaths([])
    setCurrentPath('')
    onSaveSvg('')
  }

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
          ✍️ Customer Room-of-Choice e-Signature (`signature_svg`)
        </span>
        <div className="flex items-center gap-2">
          {savedSvg && (
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
              ✓ Signature Captured
            </span>
          )}
          <button
            type="button"
            onClick={clearCanvas}
            className="text-[11px] font-bold text-slate-500 hover:text-slate-800 underline"
          >
            Clear
          </button>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={360}
        height={110}
        onMouseDown={startDraw}
        onMouseMove={moveDraw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={moveDraw}
        onTouchEnd={endDraw}
        className="w-full h-[110px] bg-white border border-slate-300 rounded-lg cursor-crosshair touch-none"
      />
      <p className="text-[10px] text-slate-400">
        Customer signs above to confirm undamaged room-of-choice placement.
      </p>
    </div>
  )
}
