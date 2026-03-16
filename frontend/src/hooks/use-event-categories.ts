import { useMemo } from 'react'
import { useSessionEvents } from '@/hooks/use-sessions'
import {
  CHANNEL_EVENT_KINDS,
  FLOW_EVENT_KINDS,
  SYNC_EVENT_KINDS,
  JOB_EVENT_KINDS,
} from '@/types/api'

export interface EventCategories {
  hasChannels: boolean
  hasFlowOps: boolean
  hasSyncPrimitives: boolean
  hasJobs: boolean
  hasValidation: boolean
}

/**
 * Returns which event categories are present in a session's events.
 * Scans the session event list and checks each event's `kind` against
 * the known category sets exported from api.ts.
 */
export function useEventCategories(sessionId: string): EventCategories {
  const { data: events } = useSessionEvents(sessionId)

  return useMemo(() => {
    const result: EventCategories = {
      hasChannels: false,
      hasFlowOps: false,
      hasSyncPrimitives: false,
      hasJobs: false,
      hasValidation: true, // Validation tab is always available
    }

    if (!events || events.length === 0) {
      return result
    }

    for (const event of events) {
      const kind = event.kind
      if (!result.hasChannels && CHANNEL_EVENT_KINDS.has(kind)) {
        result.hasChannels = true
      }
      if (!result.hasFlowOps && FLOW_EVENT_KINDS.has(kind)) {
        result.hasFlowOps = true
      }
      if (!result.hasSyncPrimitives && SYNC_EVENT_KINDS.has(kind)) {
        result.hasSyncPrimitives = true
      }
      if (!result.hasJobs && JOB_EVENT_KINDS.has(kind)) {
        result.hasJobs = true
      }
      // Early exit if all categories found
      if (result.hasChannels && result.hasFlowOps && result.hasSyncPrimitives && result.hasJobs) {
        break
      }
    }

    return result
  }, [events])
}
