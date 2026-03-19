/**
 * Provides framer-motion motion values for smooth replay progress interpolation.
 *
 * Wraps the discrete `currentIndex` from the replay hook into a smoothly
 * animating `MotionValue` so the scrub bar and event dimming transitions
 * are visually fluid rather than jumping between discrete steps.
 */
import { useEffect } from 'react'
import { useMotionValue, useTransform, animate } from 'framer-motion'

interface UseReplayMotionOptions {
  currentIndex: number
  totalEvents: number
}

export function useReplayMotion({ currentIndex, totalEvents }: UseReplayMotionOptions) {
  const motionIndex = useMotionValue(currentIndex)

  // Smoothly animate toward the new currentIndex
  useEffect(() => {
    const controls = animate(motionIndex, currentIndex, {
      type: 'spring',
      stiffness: 300,
      damping: 30,
      mass: 0.5,
    })
    return controls.stop
  }, [currentIndex, motionIndex])

  // Derived: 0→1 normalized progress
  const progress = useTransform(motionIndex, [0, Math.max(totalEvents - 1, 1)], [0, 1])

  // Derived: opacity for "future" events (events past the scrub position)
  // Returns a function: (eventIndex) => opacity (0.3 for future, 1 for current/past)
  const futureOpacity = useTransform(motionIndex, (latest: number) => {
    return (eventIndex: number) => (eventIndex > latest ? 0.3 : 1)
  })

  return {
    /** Smooth-animated index value. */
    motionIndex,
    /** 0→1 progress across all events. */
    progress,
    /** Function that returns opacity for an event at a given index. */
    futureOpacity,
  }
}
