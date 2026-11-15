import { WifiOff } from 'lucide-react'

/** Shown across the top of every page while the backend is unreachable. */
export function OfflineBanner() {
  return (
    <div
      role="alert"
      className="flex items-center gap-3 border-b border-sev-medium/40 bg-sev-medium-soft px-4 py-2 text-sm text-sev-medium-fg sm:px-8"
    >
      <WifiOff size={16} className="shrink-0" aria-hidden="true" />
      <p>
        <strong className="font-semibold">Backend offline.</strong> Start the C++ server, then reload the page. This
        banner clears on its own within about 15 seconds.
      </p>
    </div>
  )
}
