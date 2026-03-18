import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

vi.mock('@/hooks/use-sessions', () => ({
  useSessionEvents: vi.fn(),
}))

import { useSelectEvents } from './use-select-events'
import { useSessionEvents } from '@/hooks/use-sessions'

const mockedUseSessionEvents = vi.mocked(useSessionEvents)

describe('useSelectEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns empty result when no events', () => {
    mockedUseSessionEvents.mockReturnValue({ data: [] } as unknown as ReturnType<typeof useSessionEvents>)

    const { result } = renderHook(() => useSelectEvents('session-1'))

    expect(result.current.selectEvents).toEqual([])
    expect(result.current.selects).toEqual([])
    expect(result.current.eventsBySelect.size).toBe(0)
  })

  it('returns empty result when events is undefined', () => {
    mockedUseSessionEvents.mockReturnValue({ data: undefined } as unknown as ReturnType<typeof useSessionEvents>)

    const { result } = renderHook(() => useSelectEvents('session-1'))

    expect(result.current.selectEvents).toEqual([])
    expect(result.current.selects).toEqual([])
    expect(result.current.eventsBySelect.size).toBe(0)
  })

  it('tracks select started with coroutineId', () => {
    mockedUseSessionEvents.mockReturnValue({
      data: [
        {
          kind: 'SelectStarted',
          sessionId: 's1',
          seq: 1,
          tsNanos: 1000,
          selectId: 'sel-1',
          coroutineId: 'c1',
        },
      ],
    } as unknown as ReturnType<typeof useSessionEvents>)

    const { result } = renderHook(() => useSelectEvents('session-1'))

    expect(result.current.selects).toHaveLength(1)
    const sel = result.current.selects[0]!
    expect(sel.selectId).toBe('sel-1')
    expect(sel.coroutineId).toBe('c1')
    expect(sel.clauses).toEqual([])
    expect(sel.winnerIndex).toBeNull()
    expect(sel.winnerType).toBeNull()
    expect(sel.isCompleted).toBe(false)
  })

  it('tracks clause registration', () => {
    mockedUseSessionEvents.mockReturnValue({
      data: [
        {
          kind: 'SelectStarted',
          sessionId: 's1',
          seq: 1,
          tsNanos: 1000,
          selectId: 'sel-1',
          coroutineId: 'c1',
        },
        {
          kind: 'SelectClauseRegistered',
          sessionId: 's1',
          seq: 2,
          tsNanos: 2000,
          selectId: 'sel-1',
          coroutineId: 'c1',
          clauseIndex: 0,
          clauseType: 'onReceive',
          channelId: 'ch1',
          deferredId: null,
          timeoutMillis: null,
          label: 'receive from ch1',
        },
        {
          kind: 'SelectClauseRegistered',
          sessionId: 's1',
          seq: 3,
          tsNanos: 3000,
          selectId: 'sel-1',
          coroutineId: 'c1',
          clauseIndex: 1,
          clauseType: 'onAwait',
          channelId: null,
          deferredId: 'def-1',
          timeoutMillis: null,
          label: 'await deferred',
        },
        {
          kind: 'SelectClauseRegistered',
          sessionId: 's1',
          seq: 4,
          tsNanos: 4000,
          selectId: 'sel-1',
          coroutineId: 'c1',
          clauseIndex: 2,
          clauseType: 'onTimeout',
          channelId: null,
          deferredId: null,
          timeoutMillis: 5000,
          label: 'timeout fallback',
        },
      ],
    } as unknown as ReturnType<typeof useSessionEvents>)

    const { result } = renderHook(() => useSelectEvents('session-1'))

    const sel = result.current.selects[0]!
    expect(sel.clauses).toHaveLength(3)

    expect(sel.clauses[0]!.clauseIndex).toBe(0)
    expect(sel.clauses[0]!.clauseType).toBe('onReceive')
    expect(sel.clauses[0]!.channelId).toBe('ch1')
    expect(sel.clauses[0]!.label).toBe('receive from ch1')

    expect(sel.clauses[1]!.clauseIndex).toBe(1)
    expect(sel.clauses[1]!.clauseType).toBe('onAwait')
    expect(sel.clauses[1]!.deferredId).toBe('def-1')

    expect(sel.clauses[2]!.clauseIndex).toBe(2)
    expect(sel.clauses[2]!.clauseType).toBe('onTimeout')
    expect(sel.clauses[2]!.timeoutMillis).toBe(5000)
  })

  it('tracks winning clause', () => {
    mockedUseSessionEvents.mockReturnValue({
      data: [
        {
          kind: 'SelectStarted',
          sessionId: 's1',
          seq: 1,
          tsNanos: 1000,
          selectId: 'sel-1',
          coroutineId: 'c1',
        },
        {
          kind: 'SelectClauseRegistered',
          sessionId: 's1',
          seq: 2,
          tsNanos: 2000,
          selectId: 'sel-1',
          clauseIndex: 0,
          clauseType: 'onReceive',
          channelId: 'ch1',
        },
        {
          kind: 'SelectClauseRegistered',
          sessionId: 's1',
          seq: 3,
          tsNanos: 3000,
          selectId: 'sel-1',
          clauseIndex: 1,
          clauseType: 'onAwait',
          deferredId: 'def-1',
        },
        {
          kind: 'SelectClauseWon',
          sessionId: 's1',
          seq: 4,
          tsNanos: 4000,
          selectId: 'sel-1',
          winningClauseIndex: 0,
          winnerClauseIndex: 0,
          winnerClauseType: 'onReceive',
          waitDurationNanos: 500000,
        },
      ],
    } as unknown as ReturnType<typeof useSessionEvents>)

    const { result } = renderHook(() => useSelectEvents('session-1'))

    const sel = result.current.selects[0]!
    expect(sel.winnerIndex).toBe(0)
    expect(sel.winnerType).toBe('onReceive')
    expect(sel.waitDurationNanos).toBe(500000)
    expect(sel.isCompleted).toBe(false)
  })

  it('tracks select completion', () => {
    mockedUseSessionEvents.mockReturnValue({
      data: [
        {
          kind: 'SelectStarted',
          sessionId: 's1',
          seq: 1,
          tsNanos: 1000,
          selectId: 'sel-1',
          coroutineId: 'c1',
        },
        {
          kind: 'SelectClauseWon',
          sessionId: 's1',
          seq: 2,
          tsNanos: 2000,
          selectId: 'sel-1',
          winningClauseIndex: 0,
          winnerClauseIndex: 0,
          winnerClauseType: 'onReceive',
          waitDurationNanos: 300000,
        },
        {
          kind: 'SelectCompleted',
          sessionId: 's1',
          seq: 3,
          tsNanos: 3000,
          selectId: 'sel-1',
          totalDurationNanos: 2000000,
        },
      ],
    } as unknown as ReturnType<typeof useSessionEvents>)

    const { result } = renderHook(() => useSelectEvents('session-1'))

    const sel = result.current.selects[0]!
    expect(sel.isCompleted).toBe(true)
    expect(sel.totalDurationNanos).toBe(2000000)
    expect(sel.winnerIndex).toBe(0)
  })

  it('tracks multiple independent selects', () => {
    mockedUseSessionEvents.mockReturnValue({
      data: [
        {
          kind: 'SelectStarted',
          sessionId: 's1',
          seq: 1,
          tsNanos: 1000,
          selectId: 'sel-1',
          coroutineId: 'c1',
        },
        {
          kind: 'SelectStarted',
          sessionId: 's1',
          seq: 2,
          tsNanos: 2000,
          selectId: 'sel-2',
          coroutineId: 'c2',
        },
        {
          kind: 'SelectClauseRegistered',
          sessionId: 's1',
          seq: 3,
          tsNanos: 3000,
          selectId: 'sel-1',
          clauseIndex: 0,
          clauseType: 'onReceive',
          channelId: 'ch1',
        },
        {
          kind: 'SelectClauseRegistered',
          sessionId: 's1',
          seq: 4,
          tsNanos: 4000,
          selectId: 'sel-2',
          clauseIndex: 0,
          clauseType: 'onTimeout',
          timeoutMillis: 1000,
        },
      ],
    } as unknown as ReturnType<typeof useSessionEvents>)

    const { result } = renderHook(() => useSelectEvents('session-1'))

    expect(result.current.selects).toHaveLength(2)
    expect(result.current.eventsBySelect.size).toBe(2)
    expect(result.current.eventsBySelect.get('sel-1')).toHaveLength(2)
    expect(result.current.eventsBySelect.get('sel-2')).toHaveLength(2)
  })

  it('groups events by select', () => {
    mockedUseSessionEvents.mockReturnValue({
      data: [
        {
          kind: 'SelectStarted',
          sessionId: 's1',
          seq: 1,
          tsNanos: 1000,
          selectId: 'sel-1',
          coroutineId: 'c1',
        },
        {
          kind: 'SelectClauseRegistered',
          sessionId: 's1',
          seq: 2,
          tsNanos: 2000,
          selectId: 'sel-1',
          clauseIndex: 0,
          clauseType: 'onReceive',
          channelId: 'ch1',
        },
        {
          kind: 'SelectClauseWon',
          sessionId: 's1',
          seq: 3,
          tsNanos: 3000,
          selectId: 'sel-1',
          winningClauseIndex: 0,
          winnerClauseIndex: 0,
          winnerClauseType: 'onReceive',
          waitDurationNanos: 100000,
        },
        {
          kind: 'SelectCompleted',
          sessionId: 's1',
          seq: 4,
          tsNanos: 4000,
          selectId: 'sel-1',
          totalDurationNanos: 3000000,
        },
      ],
    } as unknown as ReturnType<typeof useSessionEvents>)

    const { result } = renderHook(() => useSelectEvents('session-1'))

    expect(result.current.eventsBySelect.size).toBe(1)
    expect(result.current.eventsBySelect.get('sel-1')).toHaveLength(4)
    expect(result.current.selectEvents).toHaveLength(4)
  })

  it('ignores non-select events', () => {
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

    const { result } = renderHook(() => useSelectEvents('session-1'))

    expect(result.current.selectEvents).toEqual([])
    expect(result.current.selects).toEqual([])
  })

  it('filters select events from mixed event types', () => {
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
          kind: 'SelectStarted',
          sessionId: 's1',
          seq: 2,
          tsNanos: 2000,
          selectId: 'sel-1',
          coroutineId: 'c1',
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
          kind: 'SelectCompleted',
          sessionId: 's1',
          seq: 4,
          tsNanos: 4000,
          selectId: 'sel-1',
          totalDurationNanos: 2000000,
        },
        {
          kind: 'ChannelCreated',
          sessionId: 's1',
          seq: 5,
          tsNanos: 5000,
          channelId: 'ch1',
          name: 'test',
          capacity: 10,
          channelType: 'BUFFERED',
        },
      ],
    } as unknown as ReturnType<typeof useSessionEvents>)

    const { result } = renderHook(() => useSelectEvents('session-1'))

    // Only select events should be captured
    expect(result.current.selectEvents).toHaveLength(2)
    expect(result.current.selects).toHaveLength(1)
    expect(result.current.selects[0]!.selectId).toBe('sel-1')
    expect(result.current.selects[0]!.isCompleted).toBe(true)
  })
})
