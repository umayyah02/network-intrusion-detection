import { useEffect, useState } from 'react'
import { apiFetch } from '../api/client'
import { endpoints } from '../api/endpoints'
import { PageHeading } from '../components/PageHeading'
import type { DetectionResult } from '../types/api'

export function ThreatsPage() {
  const [threats, setThreats] = useState<DetectionResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  
  const [search, setSearch] = useState('')
  const [attackFilter, setAttackFilter] = useState('All')
  const [selectedThreat, setSelectedThreat] = useState<DetectionResult | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 20 


const filteredThreats = threats.filter((threat) => {
  const matchesSearch =
    String(threat.id).toLowerCase().includes(search.toLowerCase()) ||
    threat.label.toLowerCase().includes(search.toLowerCase())

  const matchesAttack =
    attackFilter === 'All' || threat.label === attackFilter

  return matchesSearch && matchesAttack
})
  const totalPages = Math.max(
    1,
    Math.ceil(filteredThreats.length / pageSize)
  )

  const safePage = Math.min(currentPage, totalPages)

  const paginatedThreats = filteredThreats.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  )


  useEffect(() => {
    const controller = new AbortController()

    async function loadThreats() {
      try {
        const response = await apiFetch(
          endpoints.detections,
          { signal: controller.signal }
        )

        if (!response.ok) {
          throw new Error(`Detections API error: ${response.status}`)
        }

        const data = await response.json()
        setThreats(
          (data.items ?? []).filter(
            (item: DetectionResult) => item.isMalicious
          )
        )
      } catch (err) {
        if (controller.signal.aborted) return
        setError(
          err instanceof Error ? err.message : 'Failed to load threats'
        )
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    loadThreats()

    return () => controller.abort()
  }, [])

  return (

    <div className="space-y-6">
      <PageHeading
        title="Threat monitoring"
        description="Review and investigate network threats detected by the C++ backend."
      />

      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <h3 className="text-lg font-semibold text-white">
          Detected Threats
        </h3>
        
        <input
          type="text"
          value={search}
          onChange={(event) => {
          setSearch(event.target.value)
          setCurrentPage(1)
          setSelectedThreat(null)
          }}
          placeholder="Search by record ID or attack type..."
          className="mt-4 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-500"
        />
        
        <select
          value={attackFilter}
          onChange={(event) => {
          setAttackFilter(event.target.value)
          setCurrentPage(1)
          setSelectedThreat(null)
          }}
          className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-500"
        >
          <option value="All">All attack types</option>
          {Array.from(new Set(threats.map((threat) => threat.label)))
            .sort()
            .map((label) => (
              <option key={label} value={label}>
                {label}
              </option>
            ))}
        </select>



        
          {loading && (
            <p className="mt-2 text-sm text-cyan-300">
              Loading real threats from backend...
            </p>
          )}

          {error && (
            <p className="mt-2 text-sm text-red-400">
              {error}
            </p>
          )}

          {!loading && !error && (
            <p className="mt-2 text-sm text-slate-400">
              {threats.length} malicious records returned by the C++ backend.
            </p>
          )}
          
          {!loading && !error && filteredThreats.length === 0 && (
            <p className="mt-6 rounded-xl border border-slate-700 bg-slate-950/50 p-5 text-center text-sm text-slate-400">
              {threats.length === 0
                ? 'No predicted malicious records available. Run detection first.'
                : 'No threats match your search or selected attack type.'}
            </p>
          )}

          {!loading && !error && filteredThreats.length > 0 && (
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[650px] text-left text-sm">
                <thead className="border-b border-slate-700 text-xs uppercase text-slate-400">
                  <tr>
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">Record ID</th>
                    <th className="px-4 py-3">Attack Type</th>
                    <th className="px-4 py-3">Severity</th>
                    <th className="px-4 py-3">Confidence</th>
                    <th className="px-4 py-3">Actual Class</th>
                    <th className="px-4 py-3">Correct</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-800">
                  {paginatedThreats.map((threat, index) => (
                    <tr key={threat.id} className="hover:bg-slate-800/40">
                    <td className="px-4 py-3 text-slate-400">
                      {(safePage - 1) * pageSize + index + 1}
                    </td>

                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setSelectedThreat(threat)}
                        className="text-cyan-300 underline-offset-4 hover:text-cyan-200 hover:underline"
                      >
                        {threat.id}
                      </button>
                    </td>

                      <td className="px-4 py-3 text-white">
                        {threat.label}
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
                            threat.severity === 'High'
                              ? 'border-red-500/30 bg-red-500/10 text-red-400'
                              : threat.severity === 'Medium'
                              ? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400'
                              : threat.severity === 'Low'
                              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                              : 'border-slate-700 bg-slate-800 text-slate-400'
                          }`}
                        >
                          {threat.severity ?? 'N/A'}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-slate-300">
                        {(threat.confidence * 100).toFixed(1)}%
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {threat.actualLabel}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            threat.correct
                              ? 'text-emerald-400'
                              : 'text-red-400'
                          }
                        >
                          {threat.correct ? 'Yes' : 'No'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              
              <p className="mt-4 text-xs text-slate-500">
                Showing {(safePage - 1) * pageSize + 1}–
                {Math.min(safePage * pageSize, filteredThreats.length)}
                {' '}of {filteredThreats.length} matching records
                {' '}({threats.length} total predicted malicious records).
              </p>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setCurrentPage(safePage - 1)
                    setSelectedThreat(null)
                  }}
                  disabled={safePage === 1}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>

                <span className="text-sm text-slate-400">
                  Page {safePage} of {totalPages}
                </span>

                <button
                  type="button"
                  onClick={() => {
                    setCurrentPage(safePage + 1)
                    setSelectedThreat(null)
                  }}
                  disabled={safePage === totalPages}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>

            </div>
          )}


      </div>
      
      {selectedThreat && (
        <div className="rounded-2xl border border-cyan-500/30 bg-slate-900/70 p-6">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-lg font-semibold text-white">
              Threat Details — Record {selectedThreat.id}
            </h3>
            <button
              type="button"
              onClick={() => setSelectedThreat(null)}
              className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
            >
              Close
            </button>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <p className="text-sm text-slate-300">
              Predicted attack: <span className="text-white">{selectedThreat.label}</span>
            </p>

            <p className="text-sm text-slate-300">
              Severity:{' '}
              <span
                className={
                  selectedThreat.severity === 'High'
                    ? 'font-semibold text-red-400'
                    : selectedThreat.severity === 'Medium'
                    ? 'font-semibold text-yellow-400'
                    : selectedThreat.severity === 'Low'
                    ? 'font-semibold text-emerald-400'
                    : 'text-slate-400'
                }
              >
                {selectedThreat.severity ?? 'N/A'}
              </span>
            </p>
            <p className="text-sm text-slate-300">
              Confidence: <span className="text-white">
                {(selectedThreat.confidence * 100).toFixed(1)}%
              </span>
            </p>
            <p className="text-sm text-slate-300">
              Actual class: <span className="text-white">{selectedThreat.actualLabel}</span>
            </p>
            <p className="text-sm text-slate-300">
              Prediction correct: <span className={selectedThreat.correct ? 'text-emerald-400' : 'text-red-400'}>
                {selectedThreat.correct ? 'Yes' : 'No'}
              </span>
            </p>
            <p className="text-sm text-slate-300">
              Class index: <span className="text-white">{selectedThreat.classIndex}</span>
            </p>
            <p className="text-sm text-slate-300">
              Predicted malicious: <span className="text-white">
                {selectedThreat.isMalicious ? 'Yes' : 'No'}
              </span>
            </p>
          </div>

          <p className="mt-5 text-xs text-slate-500">
            These details come from the C++ detection API. Source IP and timestamp are not provided by the current backend.
          </p>
        </div>
      )}

    </div>
  )
}
