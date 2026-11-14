export type Page =
  | 'Dashboard'
  | 'Dataset'
  | 'Detection'
  | 'Threats'
  | 'Results & Evaluation'
  | 'Complexity Analysis'


export const pages: { name: Page; icon: string }[] = [
  { name: 'Dashboard', icon: '▦' },
  { name: 'Dataset', icon: '▤' },
  { name: 'Detection', icon: '⌁' },
  { name: 'Threats', icon: '⚠' },
  { name: 'Results & Evaluation', icon: '◫' },
  { name: 'Complexity Analysis', icon: '⌘' },
]
