import type { DetectionResult } from '../../types/api'

export type Batch = {
  index: number
  total: number
  threats: number
  normal: number
  avgConfidence: number // 0..1
}

/** Split detections (in backend order) into equal batches. Not clock time. */
export function toBatches(items: DetectionResult[], count = 12): Batch[] {
  if (items.length === 0) return []
  const n = Math.min(count, items.length)
  const size = Math.ceil(items.length / n)
  const batches: Batch[] = []
  for (let i = 0; i < items.length; i += size) {
    const slice = items.slice(i, i + size)
    const threats = slice.filter((d) => d.isMalicious).length
    const conf = slice.reduce((sum, d) => sum + d.confidence, 0)
    batches.push({
      index: batches.length + 1,
      total: slice.length,
      threats,
      normal: slice.length - threats,
      avgConfidence: conf / slice.length,
    })
  }
  return batches
}

export function cumulative(values: number[]): number[] {
  let sum = 0
  return values.map((v) => (sum += v))
}
