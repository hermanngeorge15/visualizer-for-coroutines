import { Card, CardBody, CardHeader, Chip } from '@heroui/react'
import { useMemo } from 'react'
import type { ThreadActivity } from '@/types/api'

interface ThreadTimelineProps {
  threadActivity: ThreadActivity
}

export function ThreadTimeline({ threadActivity }: ThreadTimelineProps) {
  const threads = useMemo(() => {
    return Object.entries(threadActivity).map(([threadId, events]) => ({
      threadId,
      threadName: events[0]?.threadName || `Thread ${threadId}`,
      events,
    }))
  }, [threadActivity])

  if (threads.length === 0) {
    return (
      <Card>
        <CardBody>
          <div className="text-center text-default-400 py-4">
            No thread activity data available yet
          </div>
        </CardBody>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between w-full">
          <h3 className="text-lg font-semibold">Thread Activity</h3>
          <Chip size="sm" variant="flat" color="primary">
            {threads.length} {threads.length === 1 ? 'Thread' : 'Threads'}
          </Chip>
        </div>
      </CardHeader>
      <CardBody>
        <div className="space-y-4">
          {threads.map(({ threadId, threadName, events }) => (
            <div key={threadId} className="space-y-2">
              {/* Thread header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{threadName}</span>
                  <Chip size="sm" variant="dot" color="success">
                    {events.length} {events.length === 1 ? 'event' : 'events'}
                  </Chip>
                </div>
                <code className="text-xs text-default-500">ID: {threadId}</code>
              </div>

              {/* Events list for this thread */}
              <div className="pl-4 border-l-2 border-default-200 space-y-1">
                {events.map((event, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 text-xs py-1"
                  >
                    <Chip
                      size="sm"
                      variant="flat"
                      color={event.eventType === 'ASSIGNED' ? 'success' : 'default'}
                    >
                      {event.eventType}
                    </Chip>
                    <span className="text-default-600">{event.coroutineId}</span>
                    <span className="text-default-400">
                      @ {new Date(event.timestamp / 1000000).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  )
}

