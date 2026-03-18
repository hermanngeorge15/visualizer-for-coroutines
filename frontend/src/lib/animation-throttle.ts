import { useEffect, useRef, useState } from 'react'

/**
 * Maximum number of concurrent animations allowed.
 * When this limit is reached, new components render statically
 * (no enter/exit animations) to preserve frame rate.
 */
const MAX_CONCURRENT = 50

let activeCount = 0

/**
 * Returns true if there is room for another animation.
 */
export function canAnimate(): boolean {
  return activeCount < MAX_CONCURRENT
}

/**
 * Registers a new active animation and returns a cleanup function
 * that decrements the counter when the animation completes or the
 * component unmounts.
 */
export function registerAnimation(): () => void {
  activeCount++
  let released = false
  return () => {
    if (!released) {
      released = true
      activeCount--
    }
  }
}

/**
 * Returns the current count of active animations (useful for debugging).
 */
export function getActiveAnimationCount(): number {
  return activeCount
}

/**
 * React hook that claims an animation slot on mount and releases it on unmount.
 *
 * Returns `true` if the component should animate (slot was available and the
 * user has not enabled `prefers-reduced-motion`). Returns `false` if the
 * animation limit has been reached or reduced motion is preferred -- in that
 * case the component should render its final state immediately.
 */
export function useAnimationSlot(): boolean {
  const [shouldAnimate, setShouldAnimate] = useState(false)
  const cleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    // Respect prefers-reduced-motion
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (prefersReduced) {
      setShouldAnimate(false)
      return
    }

    if (canAnimate()) {
      const release = registerAnimation()
      cleanupRef.current = release
      setShouldAnimate(true)

      return () => {
        release()
        cleanupRef.current = null
      }
    }

    // Limit exceeded -- render static
    setShouldAnimate(false)
    return undefined
  }, [])

  return shouldAnimate
}
