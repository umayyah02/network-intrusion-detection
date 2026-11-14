import { AnimatePresence, LazyMotion, domAnimation, useReducedMotion } from 'motion/react'
import * as m from 'motion/react-m'
import type { ReactNode } from 'react'

/** Fades and nudges the page in and out when the page key changes. */
export function PageTransition({
  pageKey,
  children,
}: {
  pageKey: string
  children: ReactNode
}) {
  const reduce = useReducedMotion()

  return (
    <LazyMotion features={domAnimation} strict>
      <AnimatePresence mode="wait" initial={false}>
        <m.div
          key={pageKey}
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
          transition={{ duration: reduce ? 0 : 0.18, ease: 'easeOut' }}
        >
          {children}
        </m.div>
      </AnimatePresence>
    </LazyMotion>
  )
}
