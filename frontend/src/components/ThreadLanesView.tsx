import { Card, CardBody, CardHeader, Chip } from '@heroui/react'
import { useThreadLanesByDispatcher, useThreadUtilizationStats } from '@/hooks/use-thread-activity'
import { formatNanoTime } from '@/lib/utils'
import { useMemo } from 'react'
import type { ThreadLaneData, ThreadSegment } from '@/types/api'

interface ThreadLanesViewProps {
  sessionId: string
}

export function ThreadLanesView({ sessionId }: ThreadLanesViewProps) {
  const { data: lanesByDispatcher, dispatcherInfo, isLoading } = useThreadLanesByDispatcher(sessionId)
  const utilStats = useThreadUtilizationStats({ 
    threads: Array.from(lanesByDispatcher?.values() || []).flat(),
    dispatcherInfo: dispatcherInfo || []
  })

  if (isLoading) {
    return (
      <Card>
        <CardBody>
          <div className="text-center text-default-400 py-8">Loading thread activity...</div>
        </CardBody>
      </Card>
    )
  }

  if (!lanesByDispatcher || lanesByDispatcher.size === 0) {
    return (
      <Card>
        <CardBody>
          <div className="text-center text-default-400 py-8">No thread activity data available</div>
        </CardBody>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Overall Statistics */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Thread Activity Overview</h3>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-primary/10">
              <div className="text-sm text-default-600">Average Utilization</div>
              <div className="text-2xl font-bold text-primary">
                {(utilStats.avgUtilization * 100).toFixed(1)}%
              </div>
            </div>
            <div className="p-4 rounded-lg bg-success/10">
              <div className="text-sm text-default-600">Max Utilization</div>
              <div className="text-2xl font-bold text-success">
                {(utilStats.maxUtilization * 100).toFixed(1)}%
              </div>
            </div>
            <div className="p-4 rounded-lg bg-default-100">
              <div className="text-sm text-default-600">Dispatchers</div>
              <div className="text-2xl font-bold">{lanesByDispatcher.size}</div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Thread Lanes by Dispatcher */}
      {Array.from(lanesByDispatcher.entries()).map(([dispatcherName, lanes]) => {
        const dispatcher = dispatcherInfo?.find(d => d.name === dispatcherName)
        const avgUtil = utilStats.byDispatcher.get(dispatcherName) || 0

        return (
          <Card key={dispatcherName}>
            <CardHeader>
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-3">
                  <Chip size="lg" variant="flat" color={getDispatcherColor(dispatcherName)}>
                    {dispatcherName}
                  </Chip>
                  <span className="text-sm text-default-500">
                    {lanes.length} {lanes.length === 1 ? 'thread' : 'threads'}
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-sm text-default-500">Avg Utilization</div>
                  <div className="text-lg font-semibold">{(avgUtil * 100).toFixed(1)}%</div>
                </div>
              </div>
            </CardHeader>
            <CardBody>
              <div className="space-y-3">
                {lanes.map(lane => (
                  <ThreadLane key={lane.threadId} lane={lane} />
                ))}
              </div>
              
              {dispatcher?.queueDepth !== undefined && dispatcher.queueDepth > 0 && (
                <div className="mt-4 p-3 bg-warning/10 rounded-lg border border-warning/20">
                  <div className="text-sm font-semibold text-warning">
                    Queue Depth: {dispatcher.queueDepth}
                  </div>
                  <div className="text-xs text-default-600 mt-1">
                    {dispatcher.queueDepth} {dispatcher.queueDepth === 1 ? 'task' : 'tasks'} waiting for thread
                  </div>
                </div>
              )}
            </CardBody>
          </Card>
        )
      })}
    </div>
  )
}

function ThreadLane({ lane }: { lane: ThreadLaneData }) {
  // Calculate time range
  const timeRange = useMemo(() => {
    if (lane.segments.length === 0) return { start: 0, end: 0, duration: 0 }
    
    const start = Math.min(...lane.segments.map(s => s.startNanos))
    const end = Math.max(...lane.segments.map(s => s.endNanos || s.startNanos))
    
    return { start, end, duration: end - start }
  }, [lane.segments])

  return (
    <div className="space-y-2">
      {/* Lane Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">{lane.threadName}</span>
          <Chip size="sm" variant="dot" color="default">
            ID: {lane.threadId}
          </Chip>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-default-500">
            Utilization: <span className="font-semibold">{(lane.utilization * 100).toFixed(1)}%</span>
          </div>
          <Chip size="sm" variant="flat">
            {lane.segments.length} segments
          </Chip>
        </div>
      </div>

      {/* Utilization Bar */}
      <div className="h-2 bg-default-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${lane.utilization * 100}%` }}
        />
      </div>

      {/* Timeline with Segments */}
      <div className="relative h-16 bg-default-50 rounded-lg overflow-hidden border border-default-200">
        {timeRange.duration > 0 && lane.segments.map((segment, i) => (
          <ThreadSegmentBar
            key={i}
            segment={segment}
            timeRange={timeRange}
          />
        ))}
        
        {lane.segments.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-default-400">
            No activity
          </div>
        )}
      </div>

      {/* Segment Details */}
      {lane.segments.length > 0 && (
        <div className="text-xs text-default-500 flex justify-between">
          <span>Start: {formatNanoTime(timeRange.start)}</span>
          <span>Duration: {formatNanoTime(timeRange.duration)}</span>
        </div>
      )}
    </div>
  )
}

function ThreadSegmentBar({
  segment,
  timeRange
}: {
  segment: ThreadSegment
  timeRange: { start: number; end: number; duration: number }
}) {
  const startPercent = ((segment.startNanos - timeRange.start) / timeRange.duration) * 100
  const endNanos = segment.endNanos || timeRange.end
  const widthPercent = ((endNanos - segment.startNanos) / timeRange.duration) * 100

  const bgColor = segment.state === 'ACTIVE' ? 'bg-success' : 'bg-warning'
  const hoverColor = segment.state === 'ACTIVE' ? 'hover:bg-success-600' : 'hover:bg-warning-600'

  return (
    <div
      className={`absolute h-full ${bgColor} ${hoverColor} transition-colors cursor-pointer group`}
      style={{
        left: `${startPercent}%`,
        width: `${widthPercent}%`
      }}
      title={`${segment.coroutineName || segment.coroutineId} - ${segment.state}`}
    >
      {/* Tooltip on hover */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-default-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
        <div className="font-semibold">{segment.coroutineName || segment.coroutineId}</div>
        <div className="text-default-300">{segment.state}</div>
        <div className="text-default-400">
          {formatNanoTime(segment.endNanos ? segment.endNanos - segment.startNanos : 0)}
        </div>
      </div>
    </div>
  )
}

function getDispatcherColor(dispatcherName: string): 'primary' | 'secondary' | 'success' | 'warning' {
  const colors: Record<string, 'primary' | 'secondary' | 'success' | 'warning'> = {
    'Default': 'primary',
    'IO': 'secondary',
    'Main': 'success',
    'Unconfined': 'warning',
  }
  return colors[dispatcherName] || 'primary'
}

