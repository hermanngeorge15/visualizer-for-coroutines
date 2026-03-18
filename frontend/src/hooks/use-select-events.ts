import { useMemo } from 'react'
import { useSessionEvents } from '@/hooks/use-sessions'
import { SELECT_EVENT_KINDS } from '@/types/api'
import type {
  VizEvent,
  SelectStarted,
  SelectClauseRegistered,
  SelectClauseWon,
  SelectCompleted,
  SelectEvent,
} from '@/types/api'

export interface SelectClause {
  clauseIndex: number
  clauseType: string
  channelId?: string | null
  deferredId?: string | null
  timeoutMillis?: number | null
  label?: string | null
}

export interface SelectState {
  selectId: string
  coroutineId: string
  clauses: SelectClause[]
  winnerIndex: number | null
  winnerType: string | null
  waitDurationNanos: number | null
  totalDurationNanos: number | null
  isCompleted: boolean
}

export interface UseSelectEventsResult {
  selectEvents: SelectEvent[]
  selects: SelectState[]
  eventsBySelect: Map<string, SelectEvent[]>
}

export function useSelectEvents(sessionId: string): UseSelectEventsResult {
  const { data: events } = useSessionEvents(sessionId)

  return useMemo(() => {
    const selectEvents: SelectEvent[] = []
    const eventsBySelect = new Map<string, SelectEvent[]>()
    const selectStates = new Map<string, SelectState>()

    if (!events || events.length === 0) {
      return { selectEvents: [], selects: [], eventsBySelect: new Map() }
    }

    for (const event of events) {
      if (!SELECT_EVENT_KINDS.has((event as VizEvent & { kind: string }).kind)) continue

      const selectEvent = event as unknown as SelectEvent
      selectEvents.push(selectEvent)
      const selectId = selectEvent.selectId
      if (!selectId) continue

      if (!eventsBySelect.has(selectId)) eventsBySelect.set(selectId, [])
      eventsBySelect.get(selectId)!.push(selectEvent)

      if (!selectStates.has(selectId)) {
        selectStates.set(selectId, {
          selectId,
          coroutineId: selectEvent.coroutineId ?? '',
          clauses: [],
          winnerIndex: null,
          winnerType: null,
          waitDurationNanos: null,
          totalDurationNanos: null,
          isCompleted: false,
        })
      }

      const state = selectStates.get(selectId)!

      switch (selectEvent.kind) {
        case 'SelectStarted': {
          const e = selectEvent as SelectStarted
          state.coroutineId = e.coroutineId
          break
        }
        case 'SelectClauseRegistered': {
          const e = selectEvent as SelectClauseRegistered
          state.clauses.push({
            clauseIndex: e.clauseIndex,
            clauseType: e.clauseType,
            channelId: e.channelId,
            deferredId: e.deferredId,
            timeoutMillis: e.timeoutMillis,
            label: e.label,
          })
          break
        }
        case 'SelectClauseWon': {
          const e = selectEvent as SelectClauseWon
          state.winnerIndex = e.winnerClauseIndex
          state.winnerType = e.winnerClauseType
          state.waitDurationNanos = e.waitDurationNanos
          break
        }
        case 'SelectCompleted': {
          const e = selectEvent as SelectCompleted
          state.totalDurationNanos = e.totalDurationNanos
          state.isCompleted = true
          break
        }
      }
    }

    return {
      selectEvents,
      selects: Array.from(selectStates.values()),
      eventsBySelect,
    }
  }, [events])
}
