import { useCallback, useMemo, useRef, useState } from 'react'
import { Chip, Input } from '@heroui/react'
import type { VizEvent } from '@/types/api'
import { formatNanoTime, formatRelativeTime } from '@/lib/utils'
import { FiSearch } from 'react-icons/fi'

interface VirtualizedEventListProps {
  events: VizEvent[]
  itemHeight?: number
  overscan?: number
}

/**
 * Color-code rows by event kind, matching the scheme from EventsList.
 */
function getEventColor(kind: string): 'primary' | 'success' | 'warning' | 'danger' | 'default' | 'secondary' {
  if (kind.includes('created')) return 'default'
  if (kind.includes('started')) return 'primary'
  if (kind.includes('body-completed')) return 'primary'
  if (kind.includes('completed')) return 'success'
  if (kind.includes('failed')) return 'danger'
  if (kind.includes('cancelled')) return 'warning'
  if (kind.includes('suspended')) return 'secondary'
  if (kind.includes('resumed')) return 'primary'
  if (kind === 'DispatcherSelected') return 'primary'
  if (kind === 'thread.assigned') return 'success'
  if (kind === 'DeferredValueAvailable') return 'success'
  if (kind === 'DeferredAwaitStarted') return 'warning'
  if (kind === 'DeferredAwaitCompleted') return 'success'
  if (kind === 'JobStateChanged') return 'secondary'
  if (kind === 'JobCancellationRequested') return 'warning'
  if (kind === 'JobJoinRequested') return 'primary'
  if (kind === 'JobJoinCompleted') return 'success'
  return 'default'
}

/**
 * Map a Chip color to a left-border Tailwind class for the row container.
 */
function getBorderClass(kind: string): string {
  if (kind.includes('failed')) return 'border-l-4 border-danger'
  if (kind.includes('cancelled')) return 'border-l-4 border-warning'
  if (kind.includes('body-completed')) return 'border-l-4 border-primary/50'
  return ''
}

/**
 * A virtualized event list that only renders visible items.
 *
 * Uses absolute positioning within an overflow-auto container to avoid
 * mounting thousands of DOM nodes for large event streams.
 */
export function VirtualizedEventList({
  events,
  itemHeight = 60,
  overscan = 10,
}: VirtualizedEventListProps) {
  const [filter, setFilter] = useState('')
  const [scrollTop, setScrollTop] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const filteredEvents = useMemo(() => {
    if (!filter) return events

    const lower = filter.toLowerCase()
    return events.filter(
      e =>
        e.kind?.toLowerCase().includes(lower) ||
        e.coroutineId?.toLowerCase().includes(lower) ||
        e.label?.toLowerCase().includes(lower)
    )
  }, [events, filter])

  // Sort newest-first (descending seq)
  const sortedEvents = useMemo(
    () => [...filteredEvents].sort((a, b) => b.seq - a.seq),
    [filteredEvents]
  )

  const containerHeight = containerRef.current?.clientHeight ?? 600
  const totalHeight = sortedEvents.length * itemHeight

  // Calculate the visible window
  const rawStart = Math.floor(scrollTop / itemHeight) - overscan
  const startIndex = Math.max(0, rawStart)
  const rawEnd = Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  const endIndex = Math.min(sortedEvents.length, rawEnd)

  const visibleEvents = sortedEvents.slice(startIndex, endIndex)

  const baseTime = events[0]?.tsNanos ?? 0

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])

  if (events.length === 0) {
    return (
      <div className="py-8 text-center text-default-400">
        No events yet. Events will appear here as coroutines are created and executed.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Filter input (non-virtualized, always visible) */}
      <div className="flex-shrink-0 flex items-center gap-3">
        <Input
          placeholder="Filter events..."
          value={filter}
          onValueChange={setFilter}
          startContent={<FiSearch />}
          isClearable
          onClear={() => setFilter('')}
          className="flex-1"
        />
        <span className="text-xs text-default-400 whitespace-nowrap">
          {sortedEvents.length} / {events.length} events
        </span>
      </div>

      {/* Virtualized scrollable container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto min-h-0"
        style={{ maxHeight: '70vh' }}
        onScroll={handleScroll}
      >
        <div
          className="relative w-full"
          style={{ height: `${totalHeight}px` }}
        >
          {visibleEvents.map((event, i) => {
            const actualIndex = startIndex + i
            const kind = event.kind ?? 'unknown'

            return (
              <div
                key={`${event.sessionId}-${event.seq}`}
                className={`absolute left-0 right-0 flex items-center px-3 gap-3 rounded-md bg-content1 hover:bg-content2 transition-colors ${getBorderClass(kind)}`}
                style={{
                  top: `${actualIndex * itemHeight}px`,
                  height: `${itemHeight - 4}px`,
                  marginBottom: '4px',
                }}
              >
                {/* Sequence number */}
                <div className="font-mono text-xs text-default-500 w-10 flex-shrink-0 text-right">
                  #{event.seq}
                </div>

                {/* Event kind chip */}
                <Chip
                  size="sm"
                  color={getEventColor(kind)}
                  variant="flat"
                  className="flex-shrink-0"
                >
                  {kind}
                </Chip>

                {/* Coroutine ID and label */}
                <div className="flex-1 min-w-0 overflow-hidden">
                  <div className="font-semibold text-sm truncate">
                    {event.label || event.coroutineId}
                  </div>
                  <div className="text-xs text-default-500 truncate">
                    ID: <code className="font-mono">{event.coroutineId}</code>
                    {event.parentCoroutineId && (
                      <span className="ml-2">
                        Parent: <code className="font-mono">{event.parentCoroutineId}</code>
                      </span>
                    )}
                  </div>
                </div>

                {/* Timestamp */}
                <div className="text-right text-xs text-default-400 flex-shrink-0 flex flex-col items-end">
                  <div>{formatNanoTime(event.tsNanos)}</div>
                  <Chip size="sm" variant="flat" color="default">
                    {formatRelativeTime(event.tsNanos, baseTime)}
                  </Chip>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
