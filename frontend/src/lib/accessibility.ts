import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * Hook to detect prefers-reduced-motion media query.
 * Returns true if the user prefers reduced motion.
 */
export function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')

    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches)
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  return prefersReducedMotion
}

/**
 * Hook to get animation props based on accessibility preferences.
 * Returns empty object if reduced motion is preferred (disabling animations),
 * or the provided animation props if motion is allowed.
 */
export function useAccessibleAnimation<T extends Record<string, unknown>>(
  animationProps: T,
): T | Record<string, never> {
  const prefersReducedMotion = usePrefersReducedMotion()

  if (prefersReducedMotion) {
    return {} as Record<string, never>
  }

  return animationProps
}

const ARIA_LIVE_CONTAINER_ID = 'aria-live-announcer'
const MESSAGE_TIMEOUT_MS = 3000

/**
 * Generates aria-live announcement for screen readers.
 * Use for dynamic content updates (new events, state changes).
 */
export function useAriaLiveAnnounce(): (
  message: string,
  priority?: 'polite' | 'assertive',
) => void {
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    return () => {
      for (const timeout of timeoutsRef.current) {
        clearTimeout(timeout)
      }
    }
  }, [])

  const announce = useCallback(
    (message: string, priority: 'polite' | 'assertive' = 'polite') => {
      let container = document.getElementById(ARIA_LIVE_CONTAINER_ID)
      if (!container) {
        container = document.createElement('div')
        container.id = ARIA_LIVE_CONTAINER_ID
        container.setAttribute('aria-live', priority)
        container.setAttribute('aria-atomic', 'true')
        container.setAttribute('role', 'status')
        Object.assign(container.style, {
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: '0',
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          borderWidth: '0',
        })
        document.body.appendChild(container)
      }

      container.setAttribute('aria-live', priority)
      container.textContent = message

      const timeout = setTimeout(() => {
        if (container && container.textContent === message) {
          container.textContent = ''
        }
      }, MESSAGE_TIMEOUT_MS)

      timeoutsRef.current.push(timeout)
    },
    [],
  )

  return announce
}
