import { Chip } from '@heroui/react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiArrowRight, FiBox } from 'react-icons/fi'
import type { ChannelState } from '@/hooks/use-channel-events'

interface ChannelProducerConsumerProps {
  channel: ChannelState
}

export function ChannelProducerConsumer({ channel }: ChannelProducerConsumerProps) {
  const producers = Array.from(channel.producers)
  const consumers = Array.from(channel.consumers)

  const hasProducers = producers.length > 0
  const hasConsumers = consumers.length > 0

  if (!hasProducers && !hasConsumers) {
    return (
      <motion.div
        className="text-center text-default-400 py-4"
        data-testid="producer-consumer-empty"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        No producer/consumer activity recorded yet.
      </motion.div>
    )
  }

  const fillPercent =
    channel.capacity > 0
      ? Math.min((channel.currentSize / channel.capacity) * 100, 100)
      : 0

  return (
    <motion.div
      className="flex items-center gap-4 py-4"
      data-testid="producer-consumer-diagram"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, delay: 0.1 }}
    >
      {/* Producers (left) */}
      <div className="flex-1 space-y-2" data-testid="producers-column">
        <div className="text-xs font-semibold text-default-500 uppercase tracking-wide mb-2">
          Producers ({producers.length})
        </div>
        <AnimatePresence mode="popLayout">
          {producers.map((id, index) => (
            <motion.div
              key={id}
              className="flex items-center gap-2 p-2 rounded-lg bg-primary/5 border border-primary/20"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2, delay: index * 0.03 }}
            >
              <div className="w-2 h-2 rounded-full bg-primary" />
              <span className="text-xs font-mono truncate">{id}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Animated arrows + channel buffer (middle) */}
      <div className="flex flex-col items-center gap-2 min-w-[120px]">
        {/* Incoming arrows */}
        {hasProducers && (
          <motion.div
            className="text-primary"
            animate={{ x: [0, 6, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <FiArrowRight className="w-5 h-5" />
          </motion.div>
        )}

        {/* Channel buffer visualization */}
        <div
          className="relative w-20 h-14 rounded-lg border-2 border-default-300 bg-default-50 flex items-center justify-center overflow-hidden"
          data-testid="buffer-visualization"
        >
          {/* Fill level */}
          {channel.capacity > 0 && (
            <motion.div
              className="absolute bottom-0 left-0 right-0 bg-primary/20"
              initial={{ height: 0 }}
              animate={{ height: `${fillPercent}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          )}
          <div className="relative z-10 flex flex-col items-center">
            <FiBox className="w-4 h-4 text-default-400" />
            <span className="text-[10px] font-semibold text-default-600 mt-0.5">
              {channel.currentSize}
              {channel.channelType !== 'UNLIMITED' && `/${channel.capacity}`}
            </span>
          </div>
        </div>

        {/* Outgoing arrows */}
        {hasConsumers && (
          <motion.div
            className="text-secondary"
            animate={{ x: [0, 6, 0] }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: 0.5,
            }}
          >
            <FiArrowRight className="w-5 h-5" />
          </motion.div>
        )}

        {/* Channel state chips */}
        <div className="flex gap-1 flex-wrap justify-center">
          <Chip size="sm" variant="flat" color={channel.isClosed ? 'danger' : 'success'}>
            {channel.isClosed ? 'Closed' : 'Open'}
          </Chip>
        </div>
      </div>

      {/* Consumers (right) */}
      <div className="flex-1 space-y-2" data-testid="consumers-column">
        <div className="text-xs font-semibold text-default-500 uppercase tracking-wide mb-2">
          Consumers ({consumers.length})
        </div>
        <AnimatePresence mode="popLayout">
          {consumers.map((id, index) => (
            <motion.div
              key={id}
              className="flex items-center gap-2 p-2 rounded-lg bg-secondary/5 border border-secondary/20"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2, delay: index * 0.03 }}
            >
              <div className="w-2 h-2 rounded-full bg-secondary" />
              <span className="text-xs font-mono truncate">{id}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
