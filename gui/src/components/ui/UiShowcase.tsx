import { useState } from 'react'
import { Button, GlassPanel, Pill, Skeleton } from './index'

export function UiShowcase() {
  const [loading, setLoading] = useState(false)

  return (
    <div className="min-h-screen bg-void p-8 font-sans text-fg">
      <h1 className="text-2xl font-semibold">INIDS UI showcase</h1>
      <p className="mt-1 text-sm text-muted">
        M1 primitives. Temporary page, not part of the app.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <GlassPanel>
          <h2 className="font-semibold">GlassPanel</h2>
          <p className="mt-2 text-sm text-muted">Default, no glow.</p>
        </GlassPanel>
        <GlassPanel glow="accent">
          <h2 className="font-semibold">Accent glow</h2>
          <p className="mt-2 text-sm text-muted">Primary emphasis.</p>
        </GlassPanel>
        <GlassPanel glow="warn">
          <h2 className="font-semibold">Warn glow</h2>
          <p className="mt-2 text-sm text-muted">Medium severity.</p>
        </GlassPanel>
        <GlassPanel glow="danger">
          <h2 className="font-semibold">Danger glow</h2>
          <p className="mt-2 text-sm text-muted">High severity.</p>
        </GlassPanel>
      </div>

      <GlassPanel className="mt-4">
        <h2 className="font-semibold">Pill</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Pill tone="high">High</Pill>
          <Pill tone="medium">Medium</Pill>
          <Pill tone="low">Low</Pill>
          <Pill tone="neutral">Neutral</Pill>
          <Pill tone="success">Correct</Pill>
          <Pill tone="danger">Incorrect</Pill>
        </div>
      </GlassPanel>

      <GlassPanel className="mt-4">
        <h2 className="font-semibold">Button</h2>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button>Start replay</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button size="sm">Small</Button>
          <Button disabled>Disabled</Button>
          <Button
            loading={loading}
            onClick={() => {
              setLoading(true)
              setTimeout(() => setLoading(false), 2000)
            }}
          >
            Click for loading
          </Button>
        </div>
      </GlassPanel>

      <GlassPanel className="mt-4">
        <h2 className="font-semibold">Skeleton</h2>
        <div className="mt-3 space-y-3">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </GlassPanel>
    </div>
  )
}
