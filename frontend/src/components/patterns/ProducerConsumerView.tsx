import { Card, CardBody, CardHeader, Chip } from '@heroui/react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  fadeSlideIn,
  scaleIn,
  staggerContainer,
  fillGauge,
  gaugeColors,
} from '@/lib/animation-variants'
import { FiArrowRight, FiBox, FiUpload, FiDownload } from 'react-icons/fi'

interface ProducerInfo {
  id: string
  label: string
  itemsSent: number
}

interface ConsumerInfo {
  id: string
  label: string
  itemsReceived: number
}

interface BufferItem {
  id: string
  value: string
  state: 'queued' | 'processing' | 'done'
}

interface ProducerConsumerViewProps {
  producers: ProducerInfo[]
  consumers: ConsumerInfo[]
  bufferSize: number
  bufferCapacity: number
  items: BufferItem[]
}

function getItemColor(state: BufferItem['state']): 'default' | 'primary' | 'success' {
  switch (state) {
    case 'queued':
      return 'default'
    case 'processing':
      return 'primary'
    case 'done':
      return 'success'
  }
}

export function ProducerConsumerView({
  producers,
  consumers,
  bufferSize,
  bufferCapacity,
  items,
}: ProducerConsumerViewProps) {
  const fillPercent = bufferCapacity > 0 ? bufferSize / bufferCapacity : 0
  const fillColorClass = gaugeColors.bg(fillPercent)

  const queuedItems = items.filter(i => i.state === 'queued')
  const processingItems = items.filter(i => i.state === 'processing')

  return (
    <Card data-testid="producer-consumer-view">
      <CardHeader className="flex items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <FiBox className="h-5 w-5 text-primary" />
          <span className="text-lg font-semibold">Producer / Consumer</span>
        </div>
        <div className="flex items-center gap-2">
          <Chip size="sm" variant="flat" color="primary">
            {producers.length} producer{producers.length !== 1 ? 's' : ''}
          </Chip>
          <Chip size="sm" variant="flat" color="secondary">
            {consumers.length} consumer{consumers.length !== 1 ? 's' : ''}
          </Chip>
        </div>
      </CardHeader>

      <CardBody className="pt-0">
        <div className="flex items-stretch gap-4" data-testid="pc-diagram">
          {/* Producers (left) */}
          <motion.div
            className="flex-1 space-y-2"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            data-testid="producers-column"
          >
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-default-500">
              <FiUpload className="h-3.5 w-3.5" />
              Producers
            </div>
            <AnimatePresence mode="popLayout">
              {producers.map((producer) => (
                <motion.div
                  key={producer.id}
                  className="rounded-lg border border-primary/20 bg-primary/5 p-3"
                  variants={fadeSlideIn}
                  data-testid={`producer-${producer.id}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{producer.label}</span>
                    <Chip
                      size="sm"
                      variant="flat"
                      color="primary"
                      classNames={{ content: 'text-[10px] font-mono' }}
                    >
                      {producer.itemsSent} sent
                    </Chip>
                  </div>
                  <div className="mt-1 text-[10px] font-mono text-default-400">
                    {producer.id}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>

          {/* Animated arrows: producer -> buffer */}
          <div className="flex flex-col items-center justify-center gap-1">
            {producers.length > 0 && (
              <motion.div
                className="text-primary"
                animate={{ x: [0, 6, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              >
                <FiArrowRight className="h-5 w-5" />
              </motion.div>
            )}
          </div>

          {/* Buffer (center) */}
          <motion.div
            className="flex w-48 shrink-0 flex-col items-center gap-3"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            data-testid="buffer-section"
          >
            <div className="text-xs font-semibold uppercase tracking-wide text-default-500">
              Buffer
            </div>

            {/* Buffer gauge */}
            <div className="w-full space-y-1">
              <div className="flex h-6 overflow-hidden rounded-full bg-default-100">
                <motion.div
                  className={`${fillColorClass} rounded-full`}
                  initial={{ width: 0 }}
                  animate={fillGauge.style(fillPercent)}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-default-500">
                <span>{bufferSize} / {bufferCapacity}</span>
                <span>{(fillPercent * 100).toFixed(0)}% full</span>
              </div>
            </div>

            {/* Queued items */}
            <div className="w-full space-y-1" data-testid="buffer-items">
              <AnimatePresence mode="popLayout">
                {queuedItems.slice(0, 5).map((item) => (
                  <motion.div
                    key={item.id}
                    className="flex items-center justify-between rounded-md border border-default-200 bg-default-50 px-2 py-1"
                    variants={scaleIn}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                  >
                    <span className="truncate text-xs font-mono">{item.value}</span>
                    <Chip
                      size="sm"
                      variant="dot"
                      color={getItemColor(item.state)}
                      classNames={{ content: 'text-[9px]' }}
                    >
                      {item.state}
                    </Chip>
                  </motion.div>
                ))}
              </AnimatePresence>
              {queuedItems.length > 5 && (
                <div className="text-center text-[10px] text-default-400">
                  +{queuedItems.length - 5} more items
                </div>
              )}
            </div>

            {/* Processing items indicator */}
            {processingItems.length > 0 && (
              <motion.div
                className="w-full rounded-md bg-primary/10 px-2 py-1 text-center text-[10px] text-primary"
                animate={{ opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              >
                {processingItems.length} item{processingItems.length !== 1 ? 's' : ''} processing
              </motion.div>
            )}
          </motion.div>

          {/* Animated arrows: buffer -> consumer */}
          <div className="flex flex-col items-center justify-center gap-1">
            {consumers.length > 0 && (
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
                <FiArrowRight className="h-5 w-5" />
              </motion.div>
            )}
          </div>

          {/* Consumers (right) */}
          <motion.div
            className="flex-1 space-y-2"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            data-testid="consumers-column"
          >
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-default-500">
              <FiDownload className="h-3.5 w-3.5" />
              Consumers
            </div>
            <AnimatePresence mode="popLayout">
              {consumers.map((consumer) => (
                <motion.div
                  key={consumer.id}
                  className="rounded-lg border border-secondary/20 bg-secondary/5 p-3"
                  variants={fadeSlideIn}
                  data-testid={`consumer-${consumer.id}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{consumer.label}</span>
                    <Chip
                      size="sm"
                      variant="flat"
                      color="secondary"
                      classNames={{ content: 'text-[10px] font-mono' }}
                    >
                      {consumer.itemsReceived} received
                    </Chip>
                  </div>
                  <div className="mt-1 text-[10px] font-mono text-default-400">
                    {consumer.id}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        </div>
      </CardBody>
    </Card>
  )
}
