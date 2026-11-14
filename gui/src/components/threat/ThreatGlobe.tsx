import { useEffect, useMemo, useRef } from 'react'
import type { DetectionResult } from '../../types/api'

const MAX_NODES = 120
const MAX_EDGES = 160

type Node = { x: number; y: number; z: number; threat: boolean }

/** Abstract view of detections: one node per sampled flow, spread over a sphere. Not geographic. */
function buildNodes(items: DetectionResult[]): Node[] {
  if (items.length === 0) return []
  const n = Math.min(MAX_NODES, items.length)
  const step = items.length / n
  const golden = Math.PI * (3 - Math.sqrt(5))
  return Array.from({ length: n }, (_, i) => {
    const y = 1 - (2 * (i + 0.5)) / n
    const r = Math.sqrt(1 - y * y)
    const theta = golden * i
    return {
      x: Math.cos(theta) * r,
      y,
      z: Math.sin(theta) * r,
      threat: items[Math.floor(i * step)].isMalicious,
    }
  })
}

function buildEdges(nodes: Node[]): [number, number][] {
  const edges: [number, number][] = []
  for (let i = 0; i < nodes.length && edges.length < MAX_EDGES; i++) {
    for (let j = i + 1; j < nodes.length && edges.length < MAX_EDGES; j++) {
      if (!nodes[i].threat && !nodes[j].threat) continue
      const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y, nodes[i].z - nodes[j].z)
      if (d < 0.5) edges.push([i, j])
    }
  }
  return edges
}

function cssVar(name: string, fallback: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}

export function ThreatGlobe({ detections }: { detections: DetectionResult[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const nodes = useMemo(() => buildNodes(detections), [detections])
  const edges = useMemo(() => buildEdges(nodes), [nodes])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const accent = cssVar('--color-accent', '#34d399')
    const danger = cssVar('--color-sev-high', '#fb7185')
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const tilt = 0.35
    const ct = Math.cos(tilt)
    const st = Math.sin(tilt)

    let width = 0
    let height = 0
    let raf = 0
    let inView = true

    const project = (x: number, y: number, z: number, angle: number, cx: number, cy: number, R: number) => {
      const ca = Math.cos(angle)
      const sa = Math.sin(angle)
      const x1 = x * ca + z * sa
      const z1 = -x * sa + z * ca
      return { sx: cx + x1 * R, sy: cy + (y * ct - z1 * st) * R, z: y * st + z1 * ct }
    }

    const draw = (time: number) => {
      ctx.clearRect(0, 0, width, height)
      const cx = width / 2
      const cy = height / 2
      const R = Math.min(width, height) * 0.42
      const angle = reduced ? 0.6 : time * 0.00012

      // Wireframe: 5 latitude rings and 6 longitude half-circles, dimmer on the far side.
      ctx.lineWidth = 1
      const seg = 48
      const ring = (pt: (t: number) => [number, number, number]) => {
        let prev = project(...pt(0), angle, cx, cy, R)
        for (let s = 1; s <= seg; s++) {
          const cur = project(...pt(s / seg), angle, cx, cy, R)
          const depth = (prev.z + cur.z) / 2
          ctx.strokeStyle = `rgba(52, 211, 153, ${0.04 + 0.16 * ((depth + 1) / 2)})`
          ctx.beginPath()
          ctx.moveTo(prev.sx, prev.sy)
          ctx.lineTo(cur.sx, cur.sy)
          ctx.stroke()
          prev = cur
        }
      }
      for (const lat of [-60, -30, 0, 30, 60]) {
        const phi = (lat * Math.PI) / 180
        ring((t) => [Math.cos(phi) * Math.cos(t * 2 * Math.PI), Math.sin(phi), Math.cos(phi) * Math.sin(t * 2 * Math.PI)])
      }
      for (let k = 0; k < 6; k++) {
        const lon = (k * Math.PI) / 6
        ring((t) => {
          const a = t * 2 * Math.PI
          return [Math.cos(a) * Math.cos(lon), Math.sin(a), Math.cos(a) * Math.sin(lon)]
        })
      }

      const pts = nodes.map((n) => ({ ...project(n.x, n.y, n.z, angle, cx, cy, R), threat: n.threat }))

      ctx.lineWidth = 1
      for (const [i, j] of edges) {
        const a = pts[i]
        const b = pts[j]
        const depth = (a.z + b.z) / 2
        ctx.strokeStyle = `rgba(251, 113, 133, ${0.06 + 0.3 * ((depth + 1) / 2)})`
        ctx.beginPath()
        ctx.moveTo(a.sx, a.sy)
        ctx.lineTo(b.sx, b.sy)
        ctx.stroke()
      }

      for (const p of pts) {
        const d = (p.z + 1) / 2
        ctx.globalAlpha = 0.3 + 0.7 * d
        ctx.fillStyle = p.threat ? danger : accent
        ctx.shadowColor = p.threat ? danger : accent
        ctx.shadowBlur = p.threat ? 12 : 4
        ctx.beginPath()
        ctx.arc(p.sx, p.sy, (p.threat ? 2.6 : 1.8) + 1.4 * d, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
      ctx.shadowBlur = 0
    }

    const frame = (time: number) => {
      draw(time)
      raf = requestAnimationFrame(frame)
    }
    const running = () => !reduced && inView && !document.hidden
    const sync = () => {
      cancelAnimationFrame(raf)
      if (running()) raf = requestAnimationFrame(frame)
      else draw(0)
    }

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      width = rect.width
      height = rect.height
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      sync()
    }

    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    const io = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting
      sync()
    })
    io.observe(canvas)
    document.addEventListener('visibilitychange', sync)
    resize()

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
      document.removeEventListener('visibilitychange', sync)
    }
  }, [nodes, edges])

  const threats = nodes.filter((n) => n.threat).length

  return (
    <div>
      <canvas
        ref={canvasRef}
        className="h-64 w-full"
        role="img"
        aria-label="Decorative globe of sampled detections. Not geographic."
      />
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-accent" /> Normal ({nodes.length - threats})
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-sev-high" /> Threat ({threats})
        </span>
        <span>
          Decorative: {nodes.length} sampled flows of {detections.length.toLocaleString()}, not geographic
        </span>
      </div>
    </div>
  )
}
