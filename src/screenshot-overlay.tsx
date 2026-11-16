import { useEffect, useRef, useState, type PointerEvent } from 'react'
import ReactDOM from 'react-dom/client'
import './styles/screenshot-overlay.css'

interface Point {
  x: number
  y: number
}

interface Selection extends Point {
  width: number
  height: number
}

function ScreenshotOverlay() {
  const [image, setImage] = useState('')
  const [selection, setSelection] = useState<Selection | null>(null)
  const start = useRef<Point | null>(null)
  const current = useRef<Point | null>(null)
  const selecting = useRef(false)

  useEffect(() => window.vccScreenshotOverlay.onInitialize(({ image: screenshot }) => setImage(screenshot)), [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        window.vccScreenshotOverlay.cancel()
      } else if (event.key === 'Enter' && selection && selection.width >= 3 && selection.height >= 3) {
        event.preventDefault()
        window.vccScreenshotOverlay.complete(selection)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selection])

  const pointFromEvent = (event: PointerEvent<HTMLElement>): Point => {
    const bounds = event.currentTarget.getBoundingClientRect()
    return {
      x: Math.max(0, Math.min(bounds.width, event.clientX - bounds.left)),
      y: Math.max(0, Math.min(bounds.height, event.clientY - bounds.top)),
    }
  }

  const updateSelection = (point: Point) => {
    const origin = start.current
    if (!origin) return
    current.current = point
    setSelection({
      x: Math.min(origin.x, point.x),
      y: Math.min(origin.y, point.y),
      width: Math.abs(point.x - origin.x),
      height: Math.abs(point.y - origin.y),
    })
  }

  const handlePointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    start.current = pointFromEvent(event)
    current.current = start.current
    selecting.current = true
    setSelection({ ...start.current, width: 0, height: 0 })
  }

  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    if (selecting.current) updateSelection(pointFromEvent(event))
  }

  const handlePointerUp = (event: PointerEvent<HTMLElement>) => {
    if (!selecting.current) return
    selecting.current = false
    updateSelection(pointFromEvent(event))
  }

  return <main
    className="screenshot-overlay"
    style={image ? { backgroundImage: `url("${image}")` } : undefined}
    onPointerDown={handlePointerDown}
    onPointerMove={handlePointerMove}
    onPointerUp={handlePointerUp}
  >
    <div className="screenshot-overlay-shade" />
    {selection && selection.width >= 1 && selection.height >= 1 && <div
      className="screenshot-overlay-selection"
      style={{ left: selection.x, top: selection.y, width: selection.width, height: selection.height }}
    />}
    <div className="screenshot-overlay-toolbar">
      <span className="screenshot-overlay-mark">V</span>
      <span><strong>Bereich auswählen</strong><small>Mit der Maus ziehen, dann Enter drücken</small></span>
      <kbd>ESC</kbd><small>Abbrechen</small>
    </div>
    {selection && selection.width >= 3 && selection.height >= 3 && <div
      className="screenshot-overlay-size"
      style={{ left: selection.x, top: selection.y + selection.height + 8 }}
    >{Math.round(selection.width)} × {Math.round(selection.height)} px</div>}
  </main>
}

ReactDOM.createRoot(document.getElementById('overlay-root')!).render(<ScreenshotOverlay />)
