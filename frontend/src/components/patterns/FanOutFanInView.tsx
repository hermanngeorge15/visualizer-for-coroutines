import { Card, CardBody, CardHeader, Chip } from '@heroui/react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  fadeSlideUp,
  scaleIn,
  staggerContainer,
  pulseActive,
} from '@/lib/animation-variants'
import { FiSend, FiCpu, FiDownload, FiArrowDown } from 'react-icons/fi'

interface ProducerNode {
  id: string
  label: string
  itemsProduced: number
}

interface WorkerNode {
  id: string
  label: string
  itemsProcessed: number
  isActive: boolean
}

interface CollectorNode {
  id: string
  label: string
  itemsCollected: number
}

interface FanOutFanInViewProps {
  producer: ProducerNode
  workers: WorkerNode[]
  collector: CollectorNode
}

export function FanOutFanInView({
  producer,
  workers,
  collector,
}: FanOutFanInViewProps) {
  const activeWorkers = workers.filter(w => w.isActive)
  const totalProcessed = workers.reduce((sum, w) => sum + w.itemsProcessed, 0)

  return (
    <Card data-testid="fan-out-fan-in-view">
      <CardHeader className="flex items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <FiCpu className="h-5 w-5 text-primary" />
          <span className="text-lg font-semibold">Fan-Out / Fan-In</span>
        </div>
        <div className="flex items-center gap-2">
          <Chip size="sm" variant="flat" color="primary">
            {workers.length} workers
          </Chip>
          {activeWorkers.length > 0 && (
            <Chip
              size="sm"
              variant="flat"
              color="success"
              startContent={
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
                </span>
              }
            >
              {activeWorkers.length} active
            </Chip>
          )}
        </div>
      </CardHeader>

      <CardBody className="pt-0">
        <div className="flex flex-col items-center gap-6" data-testid="fofi-diagram">
          {/* Producer (top) */}
          <motion.div
            className="w-64 rounded-xl border-2 border-primary bg-primary/5 p-4 text-center"
            variants={scaleIn}
            initial="hidden"
            animate="visible"
            data-testid={`producer-${producer.id}`}
          >
            <div className="mb-1 flex items-center justify-center gap-2">
              <FiSend className="h-4 w-4 text-primary" />
              <span className="text-sm font-bold">{producer.label}</span>
            </div>
            <Chip
              size="sm"
              variant="flat"
              color="primary"
              classNames={{ content: 'text-[10px] font-mono' }}
            >
              {producer.itemsProduced} produced
            </Chip>
            <div className="mt-1 text-[10px] font-mono text-default-400">{producer.id}</div>
          </motion.div>

          {/* Fan-out arrows: producer -> workers */}
          <div className="relative flex w-full items-center justify-center" data-testid="fan-out-lines">
            <svg
              className="absolute h-12 w-full"
              viewBox={`0 0 ${Math.max(workers.length * 160, 320)} 48`}
              preserveAspectRatio="xMidYMid meet"
            >
              {workers.map((worker, index) => {
                const totalWidth = Math.max(workers.length * 160, 320)
                const centerX = totalWidth / 2
                const workerX =
                  workers.length === 1
                    ? centerX
                    : (index / (workers.length - 1)) * (totalWidth - 80) + 40

                return (
                  <motion.line
                    key={`fan-out-${worker.id}`}
                    x1={centerX}
                    y1={0}
                    x2={workerX}
                    y2={48}
                    stroke={worker.isActive ? 'var(--heroui-primary)' : 'var(--heroui-default-300)'}
                    strokeWidth={worker.isActive ? 2 : 1}
                    strokeDasharray={worker.isActive ? undefined : '4 4'}
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ duration: 0.5, delay: index * 0.08 }}
                  />
                )
              })}
            </svg>

            {/* Animated flow particles for active paths */}
            {activeWorkers.length > 0 && (
              <motion.div
                className="flex items-center justify-center text-primary"
                animate={{ y: [0, 8, 0], opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
              >
                <FiArrowDown className="h-4 w-4" />
              </motion.div>
            )}
          </div>

          {/* Workers (middle row) */}
          <motion.div
            className="flex flex-wrap items-start justify-center gap-3"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            data-testid="workers-row"
          >
            <AnimatePresence mode="popLayout">
              {workers.map((worker) => (
                <motion.div
                  key={worker.id}
                  className={`w-36 rounded-lg border-2 p-3 text-center ${
                    worker.isActive
                      ? 'border-success bg-success/5'
                      : 'border-default-200 bg-default-50'
                  }`}
                  variants={pulseActive}
                  animate={worker.isActive ? 'active' : 'idle'}
                  layout
                  data-testid={`worker-${worker.id}`}
                >
                  <div className="mb-1 flex items-center justify-center gap-1.5">
                    <FiCpu
                      className={`h-3.5 w-3.5 ${
                        worker.isActive ? 'text-success' : 'text-default-400'
                      }`}
                    />
                    <span className="text-xs font-bold">{worker.label}</span>
                  </div>
                  <Chip
                    size="sm"
                    variant="flat"
                    color={worker.isActive ? 'success' : 'default'}
                    classNames={{ content: 'text-[10px] font-mono' }}
                  >
                    {worker.itemsProcessed} processed
                  </Chip>
                  {worker.isActive && (
                    <motion.div
                      className="mt-1.5 h-0.5 overflow-hidden rounded-full bg-default-200"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      <motion.div
                        className="h-full bg-success"
                        animate={{ x: ['-100%', '100%'] }}
                        transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                        style={{ width: '40%' }}
                      />
                    </motion.div>
                  )}
                  <div className="mt-1 text-[9px] font-mono text-default-400">{worker.id}</div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>

          {/* Fan-in arrows: workers -> collector */}
          <div className="relative flex w-full items-center justify-center" data-testid="fan-in-lines">
            <svg
              className="absolute h-12 w-full"
              viewBox={`0 0 ${Math.max(workers.length * 160, 320)} 48`}
              preserveAspectRatio="xMidYMid meet"
            >
              {workers.map((worker, index) => {
                const totalWidth = Math.max(workers.length * 160, 320)
                const centerX = totalWidth / 2
                const workerX =
                  workers.length === 1
                    ? centerX
                    : (index / (workers.length - 1)) * (totalWidth - 80) + 40

                return (
                  <motion.line
                    key={`fan-in-${worker.id}`}
                    x1={workerX}
                    y1={0}
                    x2={centerX}
                    y2={48}
                    stroke={worker.isActive ? 'var(--heroui-secondary)' : 'var(--heroui-default-300)'}
                    strokeWidth={worker.isActive ? 2 : 1}
                    strokeDasharray={worker.isActive ? undefined : '4 4'}
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.3 + index * 0.08 }}
                  />
                )
              })}
            </svg>

            {activeWorkers.length > 0 && (
              <motion.div
                className="flex items-center justify-center text-secondary"
                animate={{ y: [0, 8, 0], opacity: [0.4, 1, 0.4] }}
                transition={{
                  duration: 1.2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: 0.6,
                }}
              >
                <FiArrowDown className="h-4 w-4" />
              </motion.div>
            )}
          </div>

          {/* Collector (bottom) */}
          <motion.div
            className="w-64 rounded-xl border-2 border-secondary bg-secondary/5 p-4 text-center"
            variants={fadeSlideUp}
            initial="hidden"
            animate="visible"
            data-testid={`collector-${collector.id}`}
          >
            <div className="mb-1 flex items-center justify-center gap-2">
              <FiDownload className="h-4 w-4 text-secondary" />
              <span className="text-sm font-bold">{collector.label}</span>
            </div>
            <Chip
              size="sm"
              variant="flat"
              color="secondary"
              classNames={{ content: 'text-[10px] font-mono' }}
            >
              {collector.itemsCollected} collected
            </Chip>
            <div className="mt-1 text-[10px] font-mono text-default-400">{collector.id}</div>
          </motion.div>

          {/* Summary row */}
          <div className="flex items-center justify-center gap-4 text-xs text-default-500">
            <span>Total produced: {producer.itemsProduced}</span>
            <span>|</span>
            <span>Total processed: {totalProcessed}</span>
            <span>|</span>
            <span>Total collected: {collector.itemsCollected}</span>
          </div>
        </div>
      </CardBody>
    </Card>
  )
}
