import { useEffect, useRef, useState } from 'react'

/**
 * Maximum number of concurrent animations allowed.
 * When this limit is reached, new components render statically
 * (no enter/exit animations) to preserve frame rate.
 *
 * This value is adaptive: the monitor loop reduces it when frame
 * rate drops below 30fps and restores it when above 50fps.
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

/** Stop the adaptive frame-rate monitor. */
export function stopMonitor() {
  monitorRunning = false
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
