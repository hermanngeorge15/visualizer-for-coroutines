import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

vi.mock('@/hooks/use-sessions', () => ({
  useSessionEvents: vi.fn(),
}))

import { useAntiPatterns } from './use-anti-patterns'
import { useSessionEvents } from '@/hooks/use-sessions'

const mockedUseSessionEvents = vi.mocked(useSessionEvents)

describe('useAntiPatterns', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns empty result when no events', () => {
    mockedUseSessionEvents.mockReturnValue({ data: [] } as unknown as ReturnType<typeof useSessionEvents>)

    const { result } = renderHook(() => useAntiPatterns('session-1'))

    expect(result.current.patterns).toEqual([])
    expect(result.current.byCoroutine.size).toBe(0)
    expect(result.current.bySeverity.errors).toEqual([])
    expect(result.current.bySeverity.warnings).toEqual([])
    expect(result.current.bySeverity.info).toEqual([])
    expect(result.current.hasErrors).toBe(false)
    expect(result.current.hasWarnings).toBe(false)
    expect(result.current.count).toBe(0)
  })

  it('returns empty result when events is undefined', () => {
    mockedUseSessionEvents.mockReturnValue({ data: undefined } as unknown as ReturnType<typeof useSessionEvents>)

    const { result } = renderHook(() => useAntiPatterns('session-1'))

    expect(result.current.patterns).toEqual([])
    expect(result.current.byCoroutine.size).toBe(0)
    expect(result.current.hasErrors).toBe(false)
    expect(result.current.hasWarnings).toBe(false)
    expect(result.current.count).toBe(0)
  })

  it('detects a single anti-pattern', () => {
    mockedUseSessionEvents.mockReturnValue({
      data: [
        {
          kind: 'AntiPatternDetected',
          sessionId: 's1',
          seq: 1,
          tsNanos: 1000,
          patternType: 'GLOBAL_SCOPE_USAGE',
          severity: 'ERROR',
          description: 'GlobalScope.launch detected',
          suggestion: 'Use structured concurrency with coroutineScope or supervisorScope',
          coroutineId: 'c1',
          scopeId: null,
          affectedEntities: ['c1'],
        },
      ],
    } as unknown as ReturnType<typeof useSessionEvents>)

    const { result } = renderHook(() => useAntiPatterns('session-1'))

    expect(result.current.patterns).toHaveLength(1)
    expect(result.current.count).toBe(1)
    expect(result.current.patterns[0]!.patternType).toBe('GLOBAL_SCOPE_USAGE')
    expect(result.current.patterns[0]!.severity).toBe('ERROR')
    expect(result.current.patterns[0]!.description).toBe('GlobalScope.launch detected')
    expect(result.current.patterns[0]!.suggestion).toBe('Use structured concurrency with coroutineScope or supervisorScope')
  })

  it('groups patterns by severity', () => {
    mockedUseSessionEvents.mockReturnValue({
      data: [
        {
          kind: 'AntiPatternDetected',
          sessionId: 's1',
          seq: 1,
          tsNanos: 1000,
          patternType: 'GLOBAL_SCOPE_USAGE',
          severity: 'ERROR',
          description: 'GlobalScope.launch detected',
          suggestion: 'Use structured concurrency',
          coroutineId: 'c1',
          scopeId: null,
          affectedEntities: ['c1'],
        },
        {
          kind: 'AntiPatternDetected',
          sessionId: 's1',
          seq: 2,
          tsNanos: 2000,
          patternType: 'BLOCKING_ON_MAIN',
          severity: 'ERROR',
          description: 'Blocking call on Main dispatcher',
          suggestion: 'Use withContext(Dispatchers.IO)',
          coroutineId: 'c2',
          scopeId: null,
          affectedEntities: ['c2'],
        },
        {
          kind: 'AntiPatternDetected',
          sessionId: 's1',
          seq: 3,
          tsNanos: 3000,
          patternType: 'UNNECESSARY_ASYNC_AWAIT',
          severity: 'WARNING',
          description: 'Unnecessary async-await pattern',
          suggestion: 'Replace async { }.await() with direct call',
          coroutineId: 'c3',
          scopeId: null,
          affectedEntities: ['c3'],
        },
        {
          kind: 'AntiPatternDetected',
          sessionId: 's1',
          seq: 4,
          tsNanos: 4000,
          patternType: 'MISSING_CANCELLATION_CHECK',
          severity: 'INFO',
          description: 'Long-running loop without cancellation check',
          suggestion: 'Add ensureActive() or yield() in the loop',
          coroutineId: 'c4',
          scopeId: null,
          affectedEntities: ['c4'],
        },
      ],
    } as unknown as ReturnType<typeof useSessionEvents>)

    const { result } = renderHook(() => useAntiPatterns('session-1'))

    expect(result.current.count).toBe(4)
    expect(result.current.bySeverity.errors).toHaveLength(2)
    expect(result.current.bySeverity.warnings).toHaveLength(1)
    expect(result.current.bySeverity.info).toHaveLength(1)
    expect(result.current.hasErrors).toBe(true)
    expect(result.current.hasWarnings).toBe(true)
  })

  it('groups patterns by coroutine', () => {
    mockedUseSessionEvents.mockReturnValue({
      data: [
        {
          kind: 'AntiPatternDetected',
          sessionId: 's1',
          seq: 1,
          tsNanos: 1000,
          patternType: 'GLOBAL_SCOPE_USAGE',
          severity: 'ERROR',
          description: 'GlobalScope.launch detected',
          suggestion: 'Use structured concurrency',
          coroutineId: 'c1',
          scopeId: null,
          affectedEntities: ['c1'],
        },
        {
          kind: 'AntiPatternDetected',
          sessionId: 's1',
          seq: 2,
          tsNanos: 2000,
          patternType: 'BLOCKING_ON_MAIN',
          severity: 'ERROR',
          description: 'Blocking call on Main dispatcher',
          suggestion: 'Use withContext(Dispatchers.IO)',
          coroutineId: 'c1',
          scopeId: null,
          affectedEntities: ['c1'],
        },
        {
          kind: 'AntiPatternDetected',
          sessionId: 's1',
          seq: 3,
          tsNanos: 3000,
          patternType: 'LEAKED_COROUTINE',
          severity: 'WARNING',
          description: 'Coroutine outlived its scope',
          suggestion: 'Ensure proper cancellation',
          coroutineId: 'c2',
          scopeId: null,
          affectedEntities: ['c2'],
        },
      ],
    } as unknown as ReturnType<typeof useSessionEvents>)

    const { result } = renderHook(() => useAntiPatterns('session-1'))

    expect(result.current.byCoroutine.size).toBe(2)
    expect(result.current.byCoroutine.get('c1')).toHaveLength(2)
    expect(result.current.byCoroutine.get('c2')).toHaveLength(1)
  })

  it('handles patterns without coroutineId', () => {
    mockedUseSessionEvents.mockReturnValue({
      data: [
        {
          kind: 'AntiPatternDetected',
          sessionId: 's1',
          seq: 1,
          tsNanos: 1000,
          patternType: 'COROUTINE_EXPLOSION',
          severity: 'WARNING',
          description: 'Too many coroutines created',
          suggestion: 'Consider using a bounded dispatcher or limiting concurrency',
          coroutineId: null,
          scopeId: 'scope-1',
          affectedEntities: ['scope-1'],
        },
      ],
    } as unknown as ReturnType<typeof useSessionEvents>)

    const { result } = renderHook(() => useAntiPatterns('session-1'))

    expect(result.current.patterns).toHaveLength(1)
    expect(result.current.count).toBe(1)
    // Should not be grouped by coroutine since coroutineId is null
    expect(result.current.byCoroutine.size).toBe(0)
    expect(result.current.hasWarnings).toBe(true)
    expect(result.current.hasErrors).toBe(false)
  })

  it('reports hasErrors false and hasWarnings false when only INFO patterns', () => {
    mockedUseSessionEvents.mockReturnValue({
      data: [
        {
          kind: 'AntiPatternDetected',
          sessionId: 's1',
          seq: 1,
          tsNanos: 1000,
          patternType: 'MISSING_CANCELLATION_CHECK',
          severity: 'INFO',
          description: 'Loop without cancellation check',
          suggestion: 'Add ensureActive()',
          coroutineId: 'c1',
          scopeId: null,
          affectedEntities: ['c1'],
        },
      ],
    } as unknown as ReturnType<typeof useSessionEvents>)

    const { result } = renderHook(() => useAntiPatterns('session-1'))

    expect(result.current.hasErrors).toBe(false)
    expect(result.current.hasWarnings).toBe(false)
    expect(result.current.bySeverity.info).toHaveLength(1)
    expect(result.current.count).toBe(1)
  })

  it('ignores non-anti-pattern events', () => {
    mockedUseSessionEvents.mockReturnValue({
      data: [
        {
          kind: 'coroutine.created',
          sessionId: 's1',
          seq: 1,
          tsNanos: 1000,
          coroutineId: 'c1',
          jobId: 'j1',
          parentCoroutineId: null,
          scopeId: 'scope-1',
          label: null,
        },
        {
          kind: 'FlowCreated',
          sessionId: 's1',
          seq: 2,
          tsNanos: 2000,
          flowId: 'f1',
          coroutineId: 'c1',
          flowType: 'Cold',
          label: null,
          scopeId: null,
        },
        {
          kind: 'ActorCreated',
          sessionId: 's1',
          seq: 3,
          tsNanos: 3000,
          actorId: 'actor-1',
          coroutineId: 'c1',
          name: 'test',
          mailboxCapacity: 10,
        },
      ],
    } as unknown as ReturnType<typeof useSessionEvents>)

    const { result } = renderHook(() => useAntiPatterns('session-1'))

    expect(result.current.patterns).toEqual([])
    expect(result.current.count).toBe(0)
  })

  it('filters anti-pattern events from mixed event types', () => {
    mockedUseSessionEvents.mockReturnValue({
      data: [
        {
          kind: 'coroutine.created',
          sessionId: 's1',
          seq: 1,
          tsNanos: 1000,
          coroutineId: 'c1',
          jobId: 'j1',
          parentCoroutineId: null,
          scopeId: 'scope-1',
          label: null,
        },
        {
          kind: 'AntiPatternDetected',
          sessionId: 's1',
          seq: 2,
          tsNanos: 2000,
          patternType: 'WRONG_DISPATCHER',
          severity: 'WARNING',
          description: 'CPU-bound work on IO dispatcher',
          suggestion: 'Use Dispatchers.Default for CPU work',
          coroutineId: 'c1',
          scopeId: null,
          affectedEntities: ['c1'],
        },
        {
          kind: 'FlowCreated',
          sessionId: 's1',
          seq: 3,
          tsNanos: 3000,
          flowId: 'f1',
          coroutineId: 'c1',
          flowType: 'Cold',
          label: null,
          scopeId: null,
        },
        {
          kind: 'AntiPatternDetected',
          sessionId: 's1',
          seq: 4,
          tsNanos: 4000,
          patternType: 'SHARED_MUTABLE_STATE',
          severity: 'ERROR',
          description: 'Shared mutable state accessed without synchronization',
          suggestion: 'Use Mutex, atomic operations, or confine state to a single coroutine',
          coroutineId: 'c2',
          scopeId: null,
          affectedEntities: ['c1', 'c2'],
        },
        {
          kind: 'SelectStarted',
          sessionId: 's1',
          seq: 5,
          tsNanos: 5000,
          selectId: 'sel-1',
          coroutineId: 'c1',
        },
      ],
    } as unknown as ReturnType<typeof useSessionEvents>)

    const { result } = renderHook(() => useAntiPatterns('session-1'))

    // Only anti-pattern events should be captured
    expect(result.current.patterns).toHaveLength(2)
    expect(result.current.count).toBe(2)
    expect(result.current.hasErrors).toBe(true)
    expect(result.current.hasWarnings).toBe(true)
    expect(result.current.byCoroutine.get('c1')).toHaveLength(1)
    expect(result.current.byCoroutine.get('c2')).toHaveLength(1)
  })
})
