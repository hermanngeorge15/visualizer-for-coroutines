import { useEffect, useRef, useState } from 'react'

/**
 * Maximum number of concurrent animations allowed.
 * When this limit is reached, new components render statically
 * (no enter/exit animations) to preserve frame rate.
 *
 * This value is adaptive: the monitor loop reduces it when frame
 * rate drops below 30fps and restores it when above 50fps.
 * The monitor auto-stops when no animations are active.
 */
let maxConcurrent = 50
const MAX_CONCURRENT_CEILING = 50
const MAX_CONCURRENT_FLOOR = 10

let activeCount = 0

// ---------------------------------------------------------------------------
// Adaptive frame-rate monitor
// ---------------------------------------------------------------------------

let monitorRunning = false
let lastFrameTime = 0
let frameCount = 0
let fpsAccumulator = 0

function startMonitor() {
  if (monitorRunning || typeof window === 'undefined') return
  monitorRunning = true
  lastFrameTime = performance.now()

  const tick = (now: number) => {
    if (!monitorRunning) return

    // Auto-stop when no animations are active
    if (activeCount === 0) {
      monitorRunning = false
      return
    }

    const delta = now - lastFrameTime
    lastFrameTime = now
    if (delta > 0) {
      fpsAccumulator += 1000 / delta
      frameCount++
    }

    // Every ~60 frames, compute average fps and adjust limit
    if (frameCount >= 60) {
      const avgFps = fpsAccumulator / frameCount
      frameCount = 0
      fpsAccumulator = 0

      if (avgFps < 30 && maxConcurrent > MAX_CONCURRENT_FLOOR) {
        maxConcurrent = Math.max(MAX_CONCURRENT_FLOOR, maxConcurrent - 5)
      } else if (avgFps > 50 && maxConcurrent < MAX_CONCURRENT_CEILING) {
        maxConcurrent = Math.min(MAX_CONCURRENT_CEILING, maxConcurrent + 5)
      }
    }

    requestAnimationFrame(tick)
  }

  requestAnimationFrame(tick)
}

/**
 * Returns true if there is room for another animation.
 */
export function canAnimate(): boolean {
  startMonitor()
  return activeCount < maxConcurrent
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
 * Resets all throttle state to defaults. Intended for test cleanup.
 */
export function resetThrottle(): void {
  activeCount = 0
  maxConcurrent = MAX_CONCURRENT_CEILING
  monitorRunning = false
  frameCount = 0
  fpsAccumulator = 0
  lastFrameTime = 0
}

/**
 * React hook that claims an animation slot on mount and releases it on unmount.
 *
 * @param enabled - When false, the slot is never claimed (returns false).
 *   This allows callers like `useAnimatedInView` to defer the slot claim
 *   until the element is actually in the viewport.
 *
 * Returns `true` if the component should animate (slot was available and the
 * user has not enabled `prefers-reduced-motion`). Returns `false` if the
 * animation limit has been reached or reduced motion is preferred -- in that
 * case the component should render its final state immediately.
 */
export function useAnimationSlot(enabled: boolean = true): boolean {
  const [shouldAnimate, setShouldAnimate] = useState(false)
  const cleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!enabled) {
      // Release any previously claimed slot
      if (cleanupRef.current) {
        cleanupRef.current()
        cleanupRef.current = null
      }
      setShouldAnimate(false)
      return
    }

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
  }, [enabled])

  return shouldAnimate
}
