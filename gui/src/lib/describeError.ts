import { ApiError } from '../api/ApiError'

export type ErrorView = {
  /** "setup" = the backend is fine, the user just has a step to do first. */
  kind: 'setup' | 'busy' | 'offline' | 'error'
  title: string
  body: string
  href?: string
  hrefLabel?: string
}

/** Turn a raw error into plain-language text for the UI. */
export function describeError(err: unknown, what: string): ErrorView {
  if (err instanceof ApiError && err.status === 409) {
    if (err.code === 'NO_DATASET')
      return {
        kind: 'setup',
        title: 'No dataset loaded',
        body: 'Load a dataset first, then run detection to see results here.',
        href: '#dataset',
        hrefLabel: 'Go to Dataset',
      }
    if (err.code === 'NO_RESULTS' || err.code === 'NO_MODEL')
      return {
        kind: 'setup',
        title: 'No detection results yet',
        body: 'Load a dataset and run detection (Train & Evaluate) to see results here.',
        href: '#detection',
        hrefLabel: 'Go to Detection',
      }
    if (err.code === 'JOB_RUNNING' || err.code === 'DATASET_LOADING')
      return {
        kind: 'busy',
        title: 'Backend is busy',
        body: 'A job or dataset load is still running. Wait for it to finish, then retry.',
      }
  }
  if (err instanceof TypeError)
    return {
      kind: 'offline',
      title: "Can't reach the backend",
      body: 'Start the C++ server (inids_server.exe), then retry.',
    }
  return {
    kind: 'error',
    title: `Could not load ${what}`,
    body: err instanceof Error ? err.message : 'Something went wrong.',
  }
}
