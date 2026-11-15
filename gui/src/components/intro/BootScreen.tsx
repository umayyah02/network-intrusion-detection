import { lazy, Suspense, useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { apiFetch } from '../../api/client'
import { endpoints } from '../../api/endpoints'
import boltData from '../../assets/bolt.json'

// Lottie is code-split so it never delays first paint of the app itself.
// LottieLight is the smaller engine build; bolt.json uses no expressions.
const Lottie = lazy(() => import('lottie-react').then((m) => ({ default: m.LottieLight })))

const SEEN_KEY = 'inids-boot-seen'
const HEALTH_TIMEOUT_MS = 2500
const HARD_LIMIT_MS = 5000 // safety cap; the fade adds FADE_MS on top
const HOLD_MS = 900 // pause on the final line before fading
const FADE_MS = 500
const TYPE_MS = 35 // per character
const BOLT_SPEED = 1.25 // 1 = the animation's own speed

type Health = 'pending' | 'online' | 'offline'

function shouldShow() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false
  try {
    return sessionStorage.getItem(SEEN_KEY) !== '1'
  } catch {
    return true
  }
}

function useTypewriter(text: string, active: boolean, msPerChar = TYPE_MS) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setCount((c) => Math.min(c + 1, text.length)), msPerChar)
    return () => clearInterval(id)
  }, [text, active, msPerChar])
  return { shown: text.slice(0, count), done: active && count >= text.length }
}

/** Shown once per session, skipped for reduced motion. */
export function BootScreen() {
  const [show, setShow] = useState(shouldShow)
  if (!show) return null
  return <BootOverlay onDone={() => setShow(false)} />
}

function BootOverlay({ onDone }: { onDone: () => void }) {
  const [health, setHealth] = useState<Health>('pending')
  const [leaving, setLeaving] = useState(false)

  // One real request decides ONLINE or OFFLINE. It is capped and never blocks the app.
  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(() => {
      setHealth((h) => (h === 'pending' ? 'offline' : h))
      controller.abort()
    }, HEALTH_TIMEOUT_MS)
    apiFetch(endpoints.datasets, { signal: controller.signal })
      .then((res) => setHealth(res.ok ? 'online' : 'offline'))
      .catch(() => {
        if (!controller.signal.aborted) setHealth('offline')
      })
      .finally(() => clearTimeout(timer))
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [])

  // Hard limit, and skip on any key. Click is handled on the overlay itself.
  useEffect(() => {
    const limit = setTimeout(() => setLeaving(true), HARD_LIMIT_MS)
    const skip = () => setLeaving(true)
    window.addEventListener('keydown', skip)
    return () => {
      clearTimeout(limit)
      window.removeEventListener('keydown', skip)
    }
  }, [])

  // Fade out, then unmount and remember for this session.
  useEffect(() => {
    if (!leaving) return
    const t = setTimeout(() => {
      try {
        sessionStorage.setItem(SEEN_KEY, '1')
      } catch {
        /* storage unavailable: the boot may show again, which is harmless */
      }
      onDone()
    }, FADE_MS)
    return () => clearTimeout(t)
  }, [leaving, onDone])

  const l1 = useTypewriter('loading detection model...', true)
  const l2 = useTypewriter('connecting to API...', l1.done)
  const finalText =
    health === 'online' ? 'backend ONLINE. ready.' : 'backend OFFLINE. continuing without live data.'
  const l3 = useTypewriter(health === 'pending' ? '' : finalText, l2.done && health !== 'pending')

  useEffect(() => {
    if (!l3.done) return
    const t = setTimeout(() => setLeaving(true), HOLD_MS)
    return () => clearTimeout(t)
  }, [l3.done])

  const cursorOn = !l1.done ? 0 : !l2.done ? 1 : 2
  const lines = [
    { text: l1.shown, tone: 'text-fg' },
    { text: l2.shown, tone: 'text-fg' },
    { text: l3.shown, tone: health === 'online' ? 'text-accent' : 'text-sev-medium-fg' },
  ]

  return (
    <div
      role="dialog"
      aria-label="Starting INIDS"
      onClick={() => setLeaving(true)}
      style={{ transitionDuration: `${FADE_MS}ms` }}
      className={`fixed inset-0 z-50 flex cursor-pointer flex-col items-center justify-center gap-6 bg-black px-4 transition-opacity ${
        leaving ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(520px 360px at 50% 42%, rgb(16 185 129 / 0.22), transparent 70%)' }}
      />

      {/* Bolt: faint static outline under the animation, so the shape reads from the first frame.
          The Lottie draws the bolt off-center in its 110x110 box, so the box is shifted to center it. */}
      <div
        className="relative h-44 w-44 -translate-x-[14.2%]"
        style={{ filter: 'drop-shadow(0 0 22px rgb(52 211 153 / 0.55))' }}
      >
        <svg viewBox="0 0 110 110" className="absolute inset-0 h-full w-full" aria-hidden="true">
          <path
            d="M60.078 1.29 L103.843 1.29 L75.137 40.349 L100.549 40.349 L39.843 113.29 L60.078 61.929 L37.49 61.929 Z"
            fill="none"
            stroke="rgb(52 211 153 / 0.4)"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
        </svg>
        <div className="absolute inset-0">
          <Suspense fallback={null}>
            <Lottie
              src={boltData}
              autoplay
              loop={false}
              speed={BOLT_SPEED}
              className="h-full w-full"
            />
          </Suspense>
        </div>
      </div>

      <div className="relative text-center">
        <p className="flex items-center justify-center gap-2 text-xl font-semibold tracking-[0.2em] text-fg">
          <ShieldCheck size={22} className="text-accent" aria-hidden="true" />
          INIDS
        </p>
        <p className="mt-1 text-xs text-muted">Intelligent Network Intrusion Detection System</p>
      </div>

      <div className="glass relative w-[min(92vw,26rem)] min-h-28 p-4 font-mono text-sm" aria-live="polite">
        {lines.map((line, i) =>
          line.text || cursorOn === i ? (
            <p key={i} className={line.tone}>
              <span className="text-muted">&gt; </span>
              {line.text}
              {cursorOn === i && <span className="animate-pulse text-accent">▍</span>}
            </p>
          ) : null,
        )}
      </div>

      <p className="relative text-xs text-muted">Click or press any key to skip</p>
    </div>
  )
}
