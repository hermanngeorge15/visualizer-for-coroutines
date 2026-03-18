import { useMemo } from 'react'
import type { VizEvent } from '@/types/api'

/**
 * Wraps an event array with a retention limit.
 *
 * When the number of events exceeds `maxRetention`, older events (those at
 * the beginning of the array) are dropped. This keeps memory consumption
 * bounded for long-running sessions that produce thousands of events.
 *
 * The returned array is memoized so downstream consumers only re-render when
 * the input reference or the retention boundary changes.
 *
 * @param events       The full event array (assumed chronological order).
 * @param maxRetention Maximum number of events to retain (default 5000).
 * @returns            The most recent `maxRetention` events.
 */
export function useEventRetention(events: VizEvent[], maxRetention = 5000): VizEvent[] {
  return useMemo(() => {
    if (events.length <= maxRetention) {
      return events
    }
    return events.slice(-maxRetention)
  }, [events, maxRetention])
}
