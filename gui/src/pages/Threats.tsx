import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { apiFetch } from '../api/client'
import { throwApiError } from '../api/ApiError'
import { endpoints } from '../api/endpoints'
import { PageHeading } from '../components/PageHeading'
import { EmptyState, ErrorState } from '../components/charts'
import { ThreatDrawer } from '../components/threat/ThreatDrawer'
import { ThreatTable } from '../components/threat/ThreatTable'
import { Button, GlassPanel, Skeleton } from '../components/ui'
import type { DetectionResult } from '../types/api'

const PAGE_SIZE = 20

const fieldClass =
  'w-full rounded-xl border border-line bg-void/60 px-4 py-3 text-sm text-fg outline-none placeholder:text-muted focus:border-accent focus-visible:outline-2 focus-visible:outline-accent'

export function ThreatsPage() {
  const [threats, setThreats] = useState<DetectionResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [reload, setReload] = useState(0)

  const [search, setSearch] = useState('')
  const [attackFilter, setAttackFilter] = useState('All')
  const [selectedThreat, setSelectedThreat] = useState<DetectionResult | null>(null)
  const [currentPage, setCurrentPage] = useState(1)

  const q = search.toLowerCase()
  const filteredThreats = threats.filter((t) => {
    const matchesSearch = String(t.id).toLowerCase().includes(q) || t.label.toLowerCase().includes(q)
    const matchesAttack = attackFilter === 'All' || t.label === attackFilter
    return matchesSearch && matchesAttack
  })
  const totalPages = Math.max(1, Math.ceil(filteredThreats.length / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)
  const startIndex = (safePage - 1) * PAGE_SIZE
  const paginatedThreats = filteredThreats.slice(startIndex, startIndex + PAGE_SIZE)
  const labels = Array.from(new Set(threats.map((t) => t.label))).sort()

  useEffect(() => {
    const controller = new AbortController()

    async function loadThreats() {
      try {
        setLoading(true)
        setError(null)
        const response = await apiFetch(endpoints.detections, { signal: controller.signal })
        if (!response.ok) await throwApiError(response, 'Detections')
        const data = await response.json()
        setThreats((data.items ?? []).filter((item: DetectionResult) => item.isMalicious))
      } catch (err) {
        if (controller.signal.aborted) return
        setError(err)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    loadThreats()
    return () => controller.abort()
  }, [reload])

  return (
    <div className="space-y-6">
      <PageHeading
        title="Threat monitoring"
        description="Review and investigate network threats detected by the C++ backend."
      />

      {!!error && (
        <ErrorState error={error} what="threats" onRetry={() => setReload((n) => n + 1)} />
      )}

      {loading && (
        <GlassPanel className="space-y-3" aria-busy="true" aria-label="Loading threats">
          <Skeleton className="h-11 w-full" />
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </GlassPanel>
      )}

      {!loading && !error && threats.length === 0 && (
        <EmptyState
          title="No threats to show"
          body="No predicted malicious records are available. Run detection first."
        />
      )}

      {!loading && !error && threats.length > 0 && (
        <GlassPanel>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                aria-label="Search threats"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setCurrentPage(1)
                  setSelectedThreat(null)
                }}
                placeholder="Search by flow ID or attack type..."
                className={`${fieldClass} pl-10`}
              />
            </div>
            <select
              aria-label="Filter by attack type"
              value={attackFilter}
              onChange={(e) => {
                setAttackFilter(e.target.value)
                setCurrentPage(1)
                setSelectedThreat(null)
              }}
              className={`${fieldClass} sm:w-56`}
            >
              <option value="All">All attack types</option>
              {labels.map((label) => (
                <option key={label} value={label}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <p className="mt-3 text-sm text-muted">{threats.length} malicious records returned by the C++ backend.</p>

          {filteredThreats.length === 0 ? (
            <p className="mt-6 rounded-xl border border-line p-5 text-center text-sm text-muted">
              No threats match your search or selected attack type.
            </p>
          ) : (
            <>
              <div className="mt-4">
                <ThreatTable threats={paginatedThreats} startIndex={startIndex} onSelect={setSelectedThreat} />
              </div>

              <p className="mt-4 text-xs text-muted">
                Showing {startIndex + 1}–{Math.min(startIndex + PAGE_SIZE, filteredThreats.length)} of{' '}
                {filteredThreats.length} matching records ({threats.length} total predicted malicious records).
              </p>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={safePage === 1}
                  onClick={() => {
                    setCurrentPage(safePage - 1)
                    setSelectedThreat(null)
                  }}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted">
                  Page {safePage} of {totalPages}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={safePage === totalPages}
                  onClick={() => {
                    setCurrentPage(safePage + 1)
                    setSelectedThreat(null)
                  }}
                >
                  Next
                </Button>
              </div>
            </>
          )}
        </GlassPanel>
      )}

      {selectedThreat && <ThreatDrawer threat={selectedThreat} onClose={() => setSelectedThreat(null)} />}
    </div>
  )
}
