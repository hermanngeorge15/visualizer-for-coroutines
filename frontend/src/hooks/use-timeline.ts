/**
 * React Query hooks for Timeline API
 * 
 * Provides access to detailed timeline data for individual coroutines
 * including suspension points, dispatcher switches, and computed durations.
 */

import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { useMemo } from 'react'
import type { CoroutineTimeline } from '@/types/api'

/**
 * Fetch timeline for a specific coroutine
 */
export function useCoroutineTimeline(sessionId: string | undefined, coroutineId: string | undefined) {
  return useQuery({
    queryKey: ['sessions', sessionId, 'coroutines', coroutineId, 'timeline'],
    queryFn: () => apiClient.getCoroutineTimeline(sessionId!, coroutineId!),
    enabled: !!sessionId && !!coroutineId,
    staleTime: 5000,
  })
}

/**
 * Calculate timeline statistics
 */
export function useTimelineStats(timeline: CoroutineTimeline | undefined) {
  return useMemo(() => {
    if (!timeline) {
      return {
        totalDuration: 0,
        activeTime: 0,
        suspendedTime: 0,
        activePercent: 0,
        suspendedPercent: 0,
        suspensionCount: 0,
        dispatcherSwitches: 0,
        threadSwitches: 0,
        avgSuspensionDuration: 0
      }
    }

    const suspensionEvents = timeline.events.filter(e => e.kind === 'coroutine.suspended')
    const dispatcherEvents = timeline.events.filter(e => e.kind === 'DispatcherSelected')
    const threadEvents = timeline.events.filter(e => e.kind === 'thread.assigned')

    // Calculate average suspension duration
    const suspensionDurations = suspensionEvents
      .map(e => e.duration)
      .filter((d): d is number => d !== undefined && d !== null)
    
    const avgSuspensionDuration = suspensionDurations.length > 0
      ? suspensionDurations.reduce((sum, d) => sum + d, 0) / suspensionDurations.length
      : 0

    const activePercent = timeline.totalDuration > 0
      ? (timeline.activeTime / timeline.totalDuration) * 100
      : 0

    const suspendedPercent = timeline.totalDuration > 0
      ? (timeline.suspendedTime / timeline.totalDuration) * 100
      : 0

    return {
      totalDuration: timeline.totalDuration,
      activeTime: timeline.activeTime,
      suspendedTime: timeline.suspendedTime,
      activePercent,
      suspendedPercent,
      suspensionCount: suspensionEvents.length,
      dispatcherSwitches: dispatcherEvents.length,
      threadSwitches: threadEvents.length,
      avgSuspensionDuration
    }
  }, [timeline])
}

/**
 * Get suspension points with details
 */
export function useSuspensionPoints(sessionId: string | undefined, coroutineId: string | undefined) {
  const { data: timeline } = useCoroutineTimeline(sessionId, coroutineId)

  const suspensionPoints = useMemo(() => {
    if (!timeline?.events) return []

    return timeline.events
      .filter(e => e.kind === 'coroutine.suspended' && e.suspensionPoint)
      .map(e => ({
        ...e.suspensionPoint!,
        eventSeq: e.seq,
        timestamp: e.timestamp,
        duration: e.duration
      }))
  }, [timeline])

  return suspensionPoints
}

/**
 * Get dispatcher switches over time
 */
export function useDispatcherSwitches(sessionId: string | undefined, coroutineId: string | undefined) {
  const { data: timeline } = useCoroutineTimeline(sessionId, coroutineId)

  const switches = useMemo(() => {
    if (!timeline?.events) return []

    return timeline.events
      .filter(e => e.kind === 'DispatcherSelected')
      .map(e => ({
        seq: e.seq,
        timestamp: e.timestamp,
        dispatcherId: e.dispatcherId,
        dispatcherName: e.dispatcherName,
        threadId: e.threadId,
        threadName: e.threadName
      }))
  }, [timeline])

  return switches
}

/**
 * Format timeline data for visualization
 * Converts events to a format suitable for timeline charts
 */
export function useTimelineVisualizationData(timeline: CoroutineTimeline | undefined) {
  return useMemo(() => {
    if (!timeline?.events || timeline.events.length === 0) return []

    const baseTime = timeline.events[0]!.timestamp
    const data: Array<{
      seq: number
      relativeTime: number
      kind: string
      state: 'active' | 'suspended' | 'transition'
      duration?: number
      metadata?: any
    }> = []

    timeline.events.forEach((event, _index) => {
      const relativeTime = event.timestamp - baseTime

      let state: 'active' | 'suspended' | 'transition' = 'transition'
      if (event.kind === 'coroutine.started' || event.kind === 'coroutine.resumed') {
        state = 'active'
      } else if (event.kind === 'coroutine.suspended') {
        state = 'suspended'
      }

      data.push({
        seq: event.seq,
        relativeTime,
        kind: event.kind,
        state,
        duration: event.duration ?? undefined,
        metadata: {
          threadId: event.threadId,
          threadName: event.threadName,
          dispatcherName: event.dispatcherName,
          suspensionPoint: event.suspensionPoint
        }
      })
    })

    return data
  }, [timeline])
}

