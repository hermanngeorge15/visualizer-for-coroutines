import { Card, CardBody, Divider } from '@heroui/react'
import { motion } from 'framer-motion'
import { useSyncEvents } from '@/hooks/use-sync-events'
import { MutexStateIndicator } from './MutexStateIndicator'
import { SemaphoreGauge } from './SemaphoreGauge'
import { WaitQueueList } from './WaitQueueList'
import { DeadlockWarning } from './DeadlockWarning'

interface SyncPanelProps {
  sessionId: string
}

export function SyncPanel({ sessionId }: SyncPanelProps) {
  const { mutexes, semaphores, deadlocks, warnings } = useSyncEvents(sessionId)

  if (mutexes.length === 0 && semaphores.length === 0 && deadlocks.length === 0 && warnings.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        <Card className="mt-2">
          <CardBody>
            <div className="text-center text-default-400 py-8" data-testid="sync-empty">
              <p className="text-lg font-semibold mb-2">No Sync Primitives</p>
              <p className="text-sm">
                Mutex and semaphore activity will appear here when synchronization primitives are used.
              </p>
            </div>
          </CardBody>
        </Card>
      </motion.div>
    )
  }

  return (
    <motion.div
      className="space-y-4 mt-2"
      data-testid="sync-panel"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      {/* Deadlock warnings at top */}
      <DeadlockWarning deadlocks={deadlocks} warnings={warnings} />

      {/* Mutexes */}
      {mutexes.length > 0 && (
        <motion.div
          className="space-y-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <h3 className="text-sm font-semibold text-default-600">
            Mutexes ({mutexes.length})
          </h3>
          {mutexes.map((mutex, index) => (
            <motion.div
              key={mutex.mutexId}
              className="space-y-2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
            >
              <MutexStateIndicator mutex={mutex} />
              {mutex.waitQueue.length > 0 && (
                <div className="ml-4">
                  <WaitQueueList queue={mutex.waitQueue} title="Mutex Wait Queue" />
                </div>
              )}
            </motion.div>
          ))}
        </motion.div>
      )}

      {mutexes.length > 0 && semaphores.length > 0 && <Divider />}

      {/* Semaphores */}
      {semaphores.length > 0 && (
        <motion.div
          className="space-y-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <h3 className="text-sm font-semibold text-default-600">
            Semaphores ({semaphores.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {semaphores.map((sem, index) => (
              <motion.div
                key={sem.semaphoreId}
                className="space-y-2"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                <SemaphoreGauge semaphore={sem} />
                {sem.waitQueue.length > 0 && (
                  <div className="ml-4">
                    <WaitQueueList queue={sem.waitQueue} title="Semaphore Wait Queue" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}
