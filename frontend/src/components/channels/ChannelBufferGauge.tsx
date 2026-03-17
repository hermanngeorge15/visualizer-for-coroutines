import { Chip } from '@heroui/react'
import { motion } from 'framer-motion'

interface ChannelBufferGaugeProps {
  currentSize: number
  capacity: number
  channelType: string
  isClosed?: boolean
}

function getFillPercent(currentSize: number, capacity: number): number {
  if (capacity <= 0) return 0
  return Math.min((currentSize / capacity) * 100, 100)
}

function getBarColor(percent: number): string {
  if (percent >= 80) return 'bg-danger'
  if (percent >= 50) return 'bg-warning'
  return 'bg-success'
}

function getBarColorName(percent: number): 'success' | 'warning' | 'danger' {
  if (percent >= 80) return 'danger'
  if (percent >= 50) return 'warning'
  return 'success'
}

function getTypeBadgeColor(
  channelType: string,
): 'primary' | 'secondary' | 'warning' | 'default' {
  switch (channelType) {
    case 'RENDEZVOUS':
      return 'secondary'
    case 'BUFFERED':
      return 'primary'
    case 'CONFLATED':
      return 'warning'
    case 'UNLIMITED':
      return 'default'
    default:
      return 'default'
  }
}

export function ChannelBufferGauge({
  currentSize,
  capacity,
  channelType,
  isClosed = false,
}: ChannelBufferGaugeProps) {
  const isUnlimited = channelType === 'UNLIMITED'
  const isRendezvous = channelType === 'RENDEZVOUS'

  // Rendezvous channels have capacity 0, unlimited have no meaningful cap
  const effectiveCapacity = isRendezvous ? 1 : capacity
  const fillPercent = isUnlimited ? 0 : getFillPercent(currentSize, effectiveCapacity)
  const barColor = getBarColor(fillPercent)
  const barColorName = getBarColorName(fillPercent)

  return (
    <motion.div
      className="space-y-2"
      data-testid="channel-buffer-gauge"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, delay: 0.1 }}
    >
      {/* Header: type badge + closed indicator */}
      <div className="flex items-center justify-between">
        <Chip
          size="sm"
          variant="flat"
          color={getTypeBadgeColor(channelType)}
          data-testid="channel-type-badge"
        >
          {channelType}
        </Chip>
        {isClosed && (
          <Chip size="sm" variant="flat" color="danger" data-testid="channel-closed-badge">
            CLOSED
          </Chip>
        )}
      </div>

      {/* Buffer bar */}
      {isUnlimited ? (
        <div className="text-xs text-default-500">
          Unlimited buffer ({currentSize} items)
        </div>
      ) : (
        <>
          <div className="flex h-4 rounded-full overflow-hidden bg-default-100" data-testid="buffer-bar">
            <motion.div
              className={`${barColor} rounded-full`}
              initial={{ width: 0 }}
              animate={{ width: `${fillPercent}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              data-testid="buffer-fill"
            />
          </div>
          <div className="flex items-center justify-between text-xs">
            <Chip size="sm" variant="dot" color={barColorName}>
              {currentSize} / {effectiveCapacity}
            </Chip>
            <span className="text-default-400">
              {fillPercent.toFixed(0)}% full
            </span>
          </div>
        </>
      )}
    </motion.div>
  )
}
