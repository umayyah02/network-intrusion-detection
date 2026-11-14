import {
  Activity,
  ChartColumn,
  Database,
  LayoutDashboard,
  Radar,
  ShieldAlert,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type Page =
  | 'Dashboard'
  | 'Dataset'
  | 'Detection'
  | 'Threats'
  | 'Results & Evaluation'
  | 'Complexity Analysis'

export const pages: { name: Page; slug: string; icon: LucideIcon }[] = [
  { name: 'Dashboard', slug: 'dashboard', icon: LayoutDashboard },
  { name: 'Dataset', slug: 'dataset', icon: Database },
  { name: 'Detection', slug: 'detection', icon: Radar },
  { name: 'Threats', slug: 'threats', icon: ShieldAlert },
  { name: 'Results & Evaluation', slug: 'results', icon: ChartColumn },
  { name: 'Complexity Analysis', slug: 'complexity', icon: Activity },
]

export function pageFromHash(hash: string): Page {
  const slug = hash.replace(/^#\/?/, '')
  return pages.find((page) => page.slug === slug)?.name ?? 'Dashboard'
}

export function hashForPage(page: Page): string {
  return pages.find((item) => item.name === page)?.slug ?? 'dashboard'
}
