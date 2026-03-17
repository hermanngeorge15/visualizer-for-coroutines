import { Chip } from '@heroui/react'
import type { FlowBackpressure } from '@/types/api'

interface FlowBackpressureIndicatorProps {
  events: FlowBackpressure[]
}

export function FlowBackpressureIndicator({ events }: FlowBackpressureIndicatorProps) {
  if (events.length === 0) return null

  const latest = events[events.length - 1]!

  return (
    <div className="space-y-1" data-testid="backpressure-indicator">
      <Chip
        size="sm"
        variant="flat"
        color="warning"
        data-testid="backpressure-badge"
      >
        Backpressure ({events.length} event{events.length !== 1 ? 's' : ''})
      </Chip>
      <div className="text-xs text-default-500">
        <span className="font-mono">Reason: {latest.reason}</span>
        {latest.pendingEmissions > 0 && (
          <span className="ml-2">| Pending: {latest.pendingEmissions}</span>
        )}
        {latest.bufferCapacity != null && (
          <span className="ml-2">| Buffer: {latest.bufferCapacity}</span>
        )}
      </div>
    </div>
  )
}
