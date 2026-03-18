import { useMemo } from 'react'
import { useSessionEvents } from '@/hooks/use-sessions'

export type AntiPatternSeverity = 'ERROR' | 'WARNING' | 'INFO'

export type AntiPatternType =
  | 'GLOBAL_SCOPE_USAGE'
  | 'BLOCKING_ON_MAIN'
  | 'LEAKED_COROUTINE'
  | 'UNNECESSARY_ASYNC_AWAIT'
  | 'RUN_BLOCKING_MISUSE'
  | 'COROUTINE_EXPLOSION'
  | 'UNHANDLED_EXCEPTION'
  | 'MISSING_CANCELLATION_CHECK'
  | 'SHARED_MUTABLE_STATE'
  | 'WRONG_DISPATCHER'

export interface AntiPatternDetected {
  sessionId: string
  seq: number
  tsNanos: number
  kind: 'AntiPatternDetected'
  patternType: AntiPatternType
  severity: AntiPatternSeverity
  description: string
  suggestion: string
  coroutineId?: string | null
  scopeId?: string | null
  affectedEntities: string[]
}

export interface UseAntiPatternsResult {
  patterns: AntiPatternDetected[]
  byCoroutine: Map<string, AntiPatternDetected[]>
  bySeverity: { errors: AntiPatternDetected[]; warnings: AntiPatternDetected[]; info: AntiPatternDetected[] }
  hasErrors: boolean
  hasWarnings: boolean
  count: number
}

/**
 * Filters session events to anti-pattern detections, groups by coroutine and severity.
 */
export function useAntiPatterns(sessionId: string): UseAntiPatternsResult {
  const { data: events } = useSessionEvents(sessionId)

  return useMemo(() => {
    const patterns: AntiPatternDetected[] = []
    const byCoroutine = new Map<string, AntiPatternDetected[]>()

    if (!events || events.length === 0) {
      return {
        patterns: [],
        byCoroutine: new Map(),
        bySeverity: { errors: [], warnings: [], info: [] },
        hasErrors: false,
        hasWarnings: false,
        count: 0,
      }
    }

    for (const event of events) {
      if ((event as { kind: string }).kind !== 'AntiPatternDetected') continue

      const pattern = event as unknown as AntiPatternDetected
      patterns.push(pattern)

      if (pattern.coroutineId) {
        if (!byCoroutine.has(pattern.coroutineId)) {
          byCoroutine.set(pattern.coroutineId, [])
        }
        byCoroutine.get(pattern.coroutineId)!.push(pattern)
      }
    }

    const errors = patterns.filter(p => p.severity === 'ERROR')
    const warnings = patterns.filter(p => p.severity === 'WARNING')
    const info = patterns.filter(p => p.severity === 'INFO')

    return {
      patterns,
      byCoroutine,
      bySeverity: { errors, warnings, info },
      hasErrors: errors.length > 0,
      hasWarnings: warnings.length > 0,
      count: patterns.length,
    }
  }, [events])
}
