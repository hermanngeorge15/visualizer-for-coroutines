import { Chip } from '@heroui/react'
import { motion } from 'framer-motion'
import type { FlowBackpressure } from '@/types/api'

interface FlowBackpressureIndicatorProps {
  events: FlowBackpressure[]
}

export function FlowBackpressureIndicator({ events }: FlowBackpressureIndicatorProps) {
  if (events.length === 0) return null

  const latest = events[events.length - 1]!

  return (
    <motion.div
      className="space-y-1"
      data-testid="backpressure-indicator"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div
        animate={{
          boxShadow: [
            '0 0 0 rgba(245, 165, 36, 0)',
            '0 0 15px rgba(245, 165, 36, 0.3)',
            '0 0 0 rgba(245, 165, 36, 0)',
          ],
        }}
        transition={{ duration: 2, repeat: Infinity }}
        className="inline-block rounded-lg"
      >
        <Chip
          size="sm"
          variant="flat"
          color="warning"
          data-testid="backpressure-badge"
        >
          Backpressure ({events.length} event{events.length !== 1 ? 's' : ''})
        </Chip>
      </motion.div>
      <div className="text-xs text-default-500">
        <span className="font-mono">Reason: {latest.reason}</span>
        {latest.pendingEmissions > 0 && (
          <span className="ml-2">| Pending: {latest.pendingEmissions}</span>
        )}
        {latest.bufferCapacity != null && (
          <span className="ml-2">| Buffer: {latest.bufferCapacity}</span>
        )}
      </div>
    </motion.div>
  )
}
