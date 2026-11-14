import { useCallback, useEffect, useState } from 'react'
import { hashForPage, pageFromHash } from '../lib/navigation'
import type { Page } from '../lib/navigation'

/** Active page kept in the URL hash, so a refresh or a shared link keeps the page. */
export function useHashPage(): [Page, (page: Page) => void] {
  const [page, setPage] = useState<Page>(() => pageFromHash(window.location.hash))

  useEffect(() => {
    function onHashChange() {
      setPage(pageFromHash(window.location.hash))
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const navigate = useCallback((next: Page) => {
    window.location.hash = hashForPage(next)
  }, [])

  return [page, navigate]
}
