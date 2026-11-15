import { useEffect, useState } from 'react'
import { apiFetch } from '../api/client'
import { endpoints } from '../api/endpoints'
import type { RetainedModelInfo } from '../types/api'

export type HealthStatus = 'connecting' | 'online' | 'offline'

type Health = {
  status: HealthStatus
  /** Name of the dataset currently loaded in the backend, if any. */
  loadedDataset: string | null
  /** Most recently trained model name, if any. */
  latestModel: string | null
}

const POLL_MS = 15000
const TIMEOUT_MS = 4000

function latestTrained(models: RetainedModelInfo[]): string | null {
  if (models.length === 0) return null
  const times = models.map((model) => Date.parse(model.trainedAt))
  if (times.some((time) => Number.isNaN(time))) return models[models.length - 1].name
  return models[times.indexOf(Math.max(...times))].name
}

/**
 * Backend status for the shell. The backend has no health route, so the
 * existing read-only GET /api/datasets doubles as the probe. Re-checks every
 * 15 s and whenever `refreshKey` changes (for example on page change).
 */
export function useHealth(refreshKey: unknown): Health {
  const [health, setHealth] = useState<Health>({
    status: 'connecting',
    loadedDataset: null,
    latestModel: null,
  })

  useEffect(() => {
    let active = true
    let controller = new AbortController()

    async function check() {
      controller = new AbortController()
      const current = controller
      const timeout = setTimeout(() => current.abort(), TIMEOUT_MS)
      try {
        const response = await apiFetch(endpoints.datasets, { signal: current.signal })
        if (!response.ok) throw new Error(`Health check failed: ${response.status}`)
        const data = await response.json()
        const loaded = (data.datasets ?? []).find(
          (item: { status: string }) => item.status === 'Loaded',
        )

        let latestModel: string | null = null
        try {
          const modelsResponse = await apiFetch(endpoints.models, { signal: current.signal })
          if (modelsResponse.ok) {
            const modelsData = await modelsResponse.json()
            latestModel = latestTrained(modelsData.models ?? [])
          }
        } catch {
          // models are optional for the status chip
        }

        if (active) {
          setHealth({ status: 'online', loadedDataset: loaded?.name ?? null, latestModel })
        }
      } catch {
        if (active) setHealth({ status: 'offline', loadedDataset: null, latestModel: null })
      } finally {
        clearTimeout(timeout)
      }
    }

    check()
    const interval = setInterval(check, POLL_MS)
    return () => {
      active = false
      controller.abort()
      clearInterval(interval)
    }
  }, [refreshKey])

  return health
}
