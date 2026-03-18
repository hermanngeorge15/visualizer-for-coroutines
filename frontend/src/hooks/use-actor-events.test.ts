import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

vi.mock('@/hooks/use-sessions', () => ({
  useSessionEvents: vi.fn(),
}))

import { useActorEvents } from './use-actor-events'
import { useSessionEvents } from '@/hooks/use-sessions'

const mockedUseSessionEvents = vi.mocked(useSessionEvents)

describe('useActorEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns empty result when no events', () => {
    mockedUseSessionEvents.mockReturnValue({ data: [] } as unknown as ReturnType<typeof useSessionEvents>)

    const { result } = renderHook(() => useActorEvents('session-1'))

    expect(result.current.actorEvents).toEqual([])
    expect(result.current.actors).toEqual([])
    expect(result.current.eventsByActor.size).toBe(0)
  })

  it('returns empty result when events is undefined', () => {
    mockedUseSessionEvents.mockReturnValue({ data: undefined } as unknown as ReturnType<typeof useSessionEvents>)

    const { result } = renderHook(() => useActorEvents('session-1'))

    expect(result.current.actorEvents).toEqual([])
    expect(result.current.actors).toEqual([])
    expect(result.current.eventsByActor.size).toBe(0)
  })

  it('tracks actor creation with metadata', () => {
    mockedUseSessionEvents.mockReturnValue({
      data: [
        {
          kind: 'ActorCreated',
          sessionId: 's1',
          seq: 1,
          tsNanos: 1000,
          actorId: 'actor-1',
          coroutineId: 'c1',
          name: 'counter',
          mailboxCapacity: 10,
        },
        {
          kind: 'ActorCreated',
          sessionId: 's1',
          seq: 2,
          tsNanos: 2000,
          actorId: 'actor-2',
          coroutineId: 'c2',
          name: null,
          mailboxCapacity: 0,
        },
      ],
    } as unknown as ReturnType<typeof useSessionEvents>)

    const { result } = renderHook(() => useActorEvents('session-1'))

    expect(result.current.actors).toHaveLength(2)

    const a1 = result.current.actors.find(a => a.actorId === 'actor-1')!
    expect(a1.coroutineId).toBe('c1')
    expect(a1.name).toBe('counter')
    expect(a1.mailboxCapacity).toBe(10)
    expect(a1.isClosed).toBe(false)

    const a2 = result.current.actors.find(a => a.actorId === 'actor-2')!
    expect(a2.coroutineId).toBe('c2')
    expect(a2.name).toBeNull()
    expect(a2.mailboxCapacity).toBe(0)
  })

  it('tracks actor state changes', () => {
    mockedUseSessionEvents.mockReturnValue({
      data: [
        {
          kind: 'ActorCreated',
          sessionId: 's1',
          seq: 1,
          tsNanos: 1000,
          actorId: 'actor-1',
          coroutineId: 'c1',
          name: 'stateful',
          mailboxCapacity: 5,
        },
        {
          kind: 'ActorStateChanged',
          sessionId: 's1',
          seq: 2,
          tsNanos: 2000,
          actorId: 'actor-1',
          state: 'processing',
          newStatePreview: 'count=3',
        },
        {
          kind: 'ActorStateChanged',
          sessionId: 's1',
          seq: 3,
          tsNanos: 3000,
          actorId: 'actor-1',
          state: 'idle',
          newStatePreview: 'count=7',
        },
      ],
    } as unknown as ReturnType<typeof useSessionEvents>)

    const { result } = renderHook(() => useActorEvents('session-1'))

    const actor = result.current.actors[0]!
    // Should reflect the last state change
    expect(actor.statePreview).toBe('count=7')
  })

  it('tracks mailbox changes', () => {
    mockedUseSessionEvents.mockReturnValue({
      data: [
        {
          kind: 'ActorCreated',
          sessionId: 's1',
          seq: 1,
          tsNanos: 1000,
          actorId: 'actor-1',
          coroutineId: 'c1',
          name: 'worker',
          mailboxCapacity: 20,
        },
        {
          kind: 'ActorMailboxChanged',
          sessionId: 's1',
          seq: 2,
          tsNanos: 2000,
          actorId: 'actor-1',
          mailboxSize: 3,
          capacity: 20,
          currentSize: 3,
          pendingSenders: 0,
        },
        {
          kind: 'ActorMailboxChanged',
          sessionId: 's1',
          seq: 3,
          tsNanos: 3000,
          actorId: 'actor-1',
          mailboxSize: 15,
          capacity: 20,
          currentSize: 15,
          pendingSenders: 2,
        },
      ],
    } as unknown as ReturnType<typeof useSessionEvents>)

    const { result } = renderHook(() => useActorEvents('session-1'))

    const actor = result.current.actors[0]!
    // Should reflect the last mailbox change
    expect(actor.currentMailboxSize).toBe(15)
    expect(actor.pendingSenders).toBe(2)
  })

  it('tracks message processing count', () => {
    mockedUseSessionEvents.mockReturnValue({
      data: [
        {
          kind: 'ActorCreated',
          sessionId: 's1',
          seq: 1,
          tsNanos: 1000,
          actorId: 'actor-1',
          coroutineId: 'c1',
          name: 'processor',
          mailboxCapacity: 10,
        },
        {
          kind: 'ActorMessageProcessed',
          sessionId: 's1',
          seq: 2,
          tsNanos: 2000,
          actorId: 'actor-1',
        },
        {
          kind: 'ActorMessageProcessed',
          sessionId: 's1',
          seq: 3,
          tsNanos: 3000,
          actorId: 'actor-1',
        },
        {
          kind: 'ActorMessageProcessed',
          sessionId: 's1',
          seq: 4,
          tsNanos: 4000,
          actorId: 'actor-1',
        },
      ],
    } as unknown as ReturnType<typeof useSessionEvents>)

    const { result } = renderHook(() => useActorEvents('session-1'))

    const actor = result.current.actors[0]!
    expect(actor.totalMessagesProcessed).toBe(3)
  })

  it('tracks actor close', () => {
    mockedUseSessionEvents.mockReturnValue({
      data: [
        {
          kind: 'ActorCreated',
          sessionId: 's1',
          seq: 1,
          tsNanos: 1000,
          actorId: 'actor-1',
          coroutineId: 'c1',
          name: 'closeable',
          mailboxCapacity: 5,
        },
        {
          kind: 'ActorClosed',
          sessionId: 's1',
          seq: 2,
          tsNanos: 2000,
          actorId: 'actor-1',
          processedCount: 10,
          reason: null,
          totalMessagesProcessed: 10,
        },
      ],
    } as unknown as ReturnType<typeof useSessionEvents>)

    const { result } = renderHook(() => useActorEvents('session-1'))

    const actor = result.current.actors[0]!
    expect(actor.isClosed).toBe(true)
    expect(actor.closeReason).toBeNull()
    expect(actor.totalMessagesProcessed).toBe(10)
  })

  it('tracks actor close with reason', () => {
    mockedUseSessionEvents.mockReturnValue({
      data: [
        {
          kind: 'ActorCreated',
          sessionId: 's1',
          seq: 1,
          tsNanos: 1000,
          actorId: 'actor-1',
          coroutineId: 'c1',
          name: 'failing',
          mailboxCapacity: 5,
        },
        {
          kind: 'ActorClosed',
          sessionId: 's1',
          seq: 2,
          tsNanos: 2000,
          actorId: 'actor-1',
          processedCount: 3,
          reason: 'CancellationException: Parent was cancelled',
          totalMessagesProcessed: 3,
        },
      ],
    } as unknown as ReturnType<typeof useSessionEvents>)

    const { result } = renderHook(() => useActorEvents('session-1'))

    const actor = result.current.actors[0]!
    expect(actor.isClosed).toBe(true)
    expect(actor.closeReason).toBe('CancellationException: Parent was cancelled')
  })

  it('groups events by actor', () => {
    mockedUseSessionEvents.mockReturnValue({
      data: [
        {
          kind: 'ActorCreated',
          sessionId: 's1',
          seq: 1,
          tsNanos: 1000,
          actorId: 'actor-1',
          coroutineId: 'c1',
          name: 'alpha',
          mailboxCapacity: 10,
        },
        {
          kind: 'ActorCreated',
          sessionId: 's1',
          seq: 2,
          tsNanos: 2000,
          actorId: 'actor-2',
          coroutineId: 'c2',
          name: 'beta',
          mailboxCapacity: 5,
        },
        {
          kind: 'ActorMessageProcessed',
          sessionId: 's1',
          seq: 3,
          tsNanos: 3000,
          actorId: 'actor-1',
        },
        {
          kind: 'ActorMessageProcessed',
          sessionId: 's1',
          seq: 4,
          tsNanos: 4000,
          actorId: 'actor-2',
        },
        {
          kind: 'ActorMessageProcessed',
          sessionId: 's1',
          seq: 5,
          tsNanos: 5000,
          actorId: 'actor-1',
        },
      ],
    } as unknown as ReturnType<typeof useSessionEvents>)

    const { result } = renderHook(() => useActorEvents('session-1'))

    expect(result.current.eventsByActor.size).toBe(2)
    // actor-1: ActorCreated + 2 ActorMessageProcessed = 3 events
    expect(result.current.eventsByActor.get('actor-1')).toHaveLength(3)
    // actor-2: ActorCreated + 1 ActorMessageProcessed = 2 events
    expect(result.current.eventsByActor.get('actor-2')).toHaveLength(2)
  })

  it('ignores non-actor events', () => {
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
          kind: 'ChannelCreated',
          sessionId: 's1',
          seq: 3,
          tsNanos: 3000,
          channelId: 'ch1',
          name: 'test',
          capacity: 10,
          channelType: 'BUFFERED',
        },
      ],
    } as unknown as ReturnType<typeof useSessionEvents>)

    const { result } = renderHook(() => useActorEvents('session-1'))

    expect(result.current.actorEvents).toEqual([])
    expect(result.current.actors).toEqual([])
  })

  it('filters actor events from mixed event types', () => {
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
          kind: 'ActorCreated',
          sessionId: 's1',
          seq: 2,
          tsNanos: 2000,
          actorId: 'actor-1',
          coroutineId: 'c1',
          name: 'mixed-test',
          mailboxCapacity: 10,
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
          kind: 'ActorMessageProcessed',
          sessionId: 's1',
          seq: 4,
          tsNanos: 4000,
          actorId: 'actor-1',
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

    const { result } = renderHook(() => useActorEvents('session-1'))

    // Only actor events should be captured
    expect(result.current.actorEvents).toHaveLength(2)
    expect(result.current.actors).toHaveLength(1)
    expect(result.current.actors[0]!.actorId).toBe('actor-1')
    expect(result.current.actors[0]!.totalMessagesProcessed).toBe(1)
  })
})
