import { Chip } from '@heroui/react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiArrowUp, FiArrowDown, FiPause, FiXCircle, FiActivity } from 'react-icons/fi'
import { formatNanoTime } from '@/lib/utils'
import type { ChannelEvent } from '@/types/api'

interface ChannelTimelineProps {
  events: ChannelEvent[]
}

type EventSide = 'send' | 'receive' | 'meta'

function getEventSide(kind: string): EventSide {
  if (kind.includes('Send')) return 'send'
  if (kind.includes('Receive')) return 'receive'
  return 'meta'
}

function getEventIcon(kind: string) {
  switch (kind) {
    case 'ChannelSendStarted':
    case 'ChannelSendCompleted':
      return <FiArrowUp className="w-3 h-3" />
    case 'ChannelSendSuspended':
      return <FiPause className="w-3 h-3" />
    case 'ChannelReceiveStarted':
    case 'ChannelReceiveCompleted':
      return <FiArrowDown className="w-3 h-3" />
    case 'ChannelReceiveSuspended':
      return <FiPause className="w-3 h-3" />
    case 'ChannelClosed':
      return <FiXCircle className="w-3 h-3" />
    case 'ChannelCreated':
    case 'ChannelBufferStateChanged':
      return <FiActivity className="w-3 h-3" />
    default:
      return <FiActivity className="w-3 h-3" />
  }
}

function getEventColor(
  kind: string,
): 'success' | 'primary' | 'warning' | 'danger' | 'secondary' | 'default' {
  switch (kind) {
    case 'ChannelSendStarted':
      return 'primary'
    case 'ChannelSendCompleted':
      return 'success'
    case 'ChannelSendSuspended':
      return 'warning'
    case 'ChannelReceiveStarted':
      return 'secondary'
    case 'ChannelReceiveCompleted':
      return 'success'
    case 'ChannelReceiveSuspended':
      return 'warning'
    case 'ChannelClosed':
      return 'danger'
    case 'ChannelCreated':
      return 'primary'
    case 'ChannelBufferStateChanged':
      return 'default'
    default:
      return 'default'
  }
}

function getEventLabel(kind: string): string {
  switch (kind) {
    case 'ChannelCreated':
      return 'Created'
    case 'ChannelSendStarted':
      return 'Send Started'
    case 'ChannelSendCompleted':
      return 'Send Completed'
    case 'ChannelSendSuspended':
      return 'Send Suspended'
    case 'ChannelReceiveStarted':
      return 'Receive Started'
    case 'ChannelReceiveCompleted':
      return 'Receive Completed'
    case 'ChannelReceiveSuspended':
      return 'Receive Suspended'
    case 'ChannelClosed':
      return 'Closed'
    case 'ChannelBufferStateChanged':
      return 'Buffer Changed'
    default:
      return kind
  }
}

function getValueDescription(event: ChannelEvent): string | null {
  if ('valueDescription' in event && event.valueDescription) {
    return event.valueDescription as string
  }
  return null
}

function getCoroutineId(event: ChannelEvent): string | null {
  if ('coroutineId' in event) {
    return (event as { coroutineId: string }).coroutineId
  }
  return null
}

export function ChannelTimeline({ events }: ChannelTimelineProps) {
  if (events.length === 0) {
    return (
      <div className="text-center text-default-400 py-6" data-testid="channel-timeline-empty">
        No events recorded for this channel.
      </div>
    )
  }

  return (
    <div className="space-y-1" data-testid="channel-timeline">
      <AnimatePresence mode="popLayout">
        {events.map((event, index) => {
          const side = getEventSide(event.kind)
          const isLast = index === events.length - 1

          return (
            <motion.div
              key={event.seq}
              className="flex items-stretch gap-0"
              data-testid="timeline-event"
              initial={{ opacity: 0, x: side === 'send' ? -20 : 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: side === 'send' ? -20 : 20 }}
              transition={{ duration: 0.2, delay: index * 0.03 }}
            >
              {/* Left (send) column */}
              <div className="flex-1 flex justify-end pr-2">
                {side === 'send' && (
                  <TimelineCard event={event} />
                )}
              </div>

              {/* Center spine */}
              <div className="flex flex-col items-center w-8">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-white bg-${getEventColor(event.kind)}`}
                  style={{
                    backgroundColor:
                      getEventColor(event.kind) === 'success'
                        ? 'rgb(23, 201, 100)'
                        : getEventColor(event.kind) === 'warning'
                          ? 'rgb(245, 165, 36)'
                          : getEventColor(event.kind) === 'danger'
                            ? 'rgb(243, 18, 96)'
                            : getEventColor(event.kind) === 'primary'
                              ? 'rgb(0, 111, 238)'
                              : getEventColor(event.kind) === 'secondary'
                                ? 'rgb(126, 34, 206)'
                                : 'rgb(113, 113, 122)',
                  }}
                >
                  {getEventIcon(event.kind)}
                </div>
                {!isLast && <div className="w-0.5 flex-1 bg-default-200 min-h-[12px]" />}
              </div>

              {/* Right (receive) column */}
              <div className="flex-1 pl-2">
                {side === 'receive' && (
                  <TimelineCard event={event} />
                )}
                {side === 'meta' && (
                  <TimelineCard event={event} />
                )}
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}

function TimelineCard({ event }: { event: ChannelEvent }) {
  const color = getEventColor(event.kind)
  const valueDesc = getValueDescription(event)
  const coroutineId = getCoroutineId(event)

  return (
    <div className="p-2 rounded-lg bg-default-50 mb-1 max-w-[280px]" data-testid="timeline-card">
      <div className="flex items-center gap-2 mb-1">
        <Chip size="sm" variant="flat" color={color}>
          {getEventLabel(event.kind)}
        </Chip>
        <span className="text-xs text-default-400">
          {formatNanoTime(event.tsNanos)}
        </span>
      </div>
      {coroutineId && (
        <div className="text-xs text-default-500 font-mono truncate">
          coroutine: {coroutineId}
        </div>
      )}
      {valueDesc && (
        <div className="text-xs text-default-600 mt-1 truncate">
          value: {valueDesc}
        </div>
      )}
    </div>
  )
}
