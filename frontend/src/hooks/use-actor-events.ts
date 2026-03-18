import { useMemo } from 'react'
import { useSessionEvents } from '@/hooks/use-sessions'
import { ACTOR_EVENT_KINDS } from '@/types/api'
import type {
  VizEvent,
  ActorCreated,
  ActorStateChanged,
  ActorMailboxChanged,
  ActorClosed,
  ActorEvent,
} from '@/types/api'

export interface ActorState {
  actorId: string
  coroutineId: string
  name: string | null
  mailboxCapacity: number
  currentMailboxSize: number
  pendingSenders: number
  isClosed: boolean
  closeReason: string | null
  totalMessagesProcessed: number
  statePreview: string | null
}

export interface UseActorEventsResult {
  actorEvents: ActorEvent[]
  actors: ActorState[]
  eventsByActor: Map<string, ActorEvent[]>
}

export function useActorEvents(sessionId: string): UseActorEventsResult {
  const { data: events } = useSessionEvents(sessionId)

  return useMemo(() => {
    const actorEvents: ActorEvent[] = []
    const eventsByActor = new Map<string, ActorEvent[]>()
    const actorStates = new Map<string, ActorState>()

    if (!events || events.length === 0) {
      return { actorEvents: [], actors: [], eventsByActor: new Map() }
    }

    for (const event of events) {
      if (!ACTOR_EVENT_KINDS.has((event as VizEvent & { kind: string }).kind)) continue

      const actorEvent = event as unknown as ActorEvent
      actorEvents.push(actorEvent)
      const actorId = actorEvent.actorId
      if (!actorId) continue

      if (!eventsByActor.has(actorId)) eventsByActor.set(actorId, [])
      eventsByActor.get(actorId)!.push(actorEvent)

      if (!actorStates.has(actorId)) {
        actorStates.set(actorId, {
          actorId,
          coroutineId: '',
          name: null,
          mailboxCapacity: 0,
          currentMailboxSize: 0,
          pendingSenders: 0,
          isClosed: false,
          closeReason: null,
          totalMessagesProcessed: 0,
          statePreview: null,
        })
      }

      const state = actorStates.get(actorId)!

      switch (actorEvent.kind) {
        case 'ActorCreated': {
          const e = actorEvent as ActorCreated
          state.coroutineId = e.coroutineId
          state.name = e.name ?? null
          state.mailboxCapacity = e.mailboxCapacity
          break
        }
        case 'ActorMessageProcessed': {
          state.totalMessagesProcessed++
          break
        }
        case 'ActorStateChanged': {
          const e = actorEvent as ActorStateChanged
          state.statePreview = e.newStatePreview
          break
        }
        case 'ActorMailboxChanged': {
          const e = actorEvent as ActorMailboxChanged
          state.currentMailboxSize = e.currentSize
          state.pendingSenders = e.pendingSenders
          break
        }
        case 'ActorClosed': {
          const e = actorEvent as ActorClosed
          state.isClosed = true
          state.closeReason = e.reason ?? null
          state.totalMessagesProcessed = e.totalMessagesProcessed ?? state.totalMessagesProcessed
          break
        }
      }
    }

    return {
      actorEvents,
      actors: Array.from(actorStates.values()),
      eventsByActor,
    }
  }, [events])
}
