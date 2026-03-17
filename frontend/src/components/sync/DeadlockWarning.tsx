import { Card, CardBody, Chip } from '@heroui/react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiAlertTriangle } from 'react-icons/fi'
import type { DeadlockDetected, PotentialDeadlockWarning } from '@/types/api'

interface DeadlockWarningProps {
  deadlocks: DeadlockDetected[]
  warnings: PotentialDeadlockWarning[]
}

export function DeadlockWarning({ deadlocks, warnings }: DeadlockWarningProps) {
  if (deadlocks.length === 0 && warnings.length === 0) return null

  return (
    <div className="space-y-2" data-testid="deadlock-warning">
      <AnimatePresence mode="popLayout">
        {deadlocks.map((dl, idx) => (
          <motion.div
            key={`deadlock-${dl.seq}-${idx}`}
            initial={{ opacity: 0, x: -20, scale: 0.95 }}
            animate={{
              opacity: 1,
              x: [0, -3, 3, -3, 3, 0],
              scale: 1,
            }}
            exit={{ opacity: 0, x: 20 }}
            transition={{
              opacity: { duration: 0.3 },
              x: { duration: 0.5, delay: 0.3 },
              scale: { duration: 0.3 },
            }}
          >
            <motion.div
              animate={{
                boxShadow: [
                  '0 0 0 rgba(243, 18, 96, 0)',
                  '0 0 15px rgba(243, 18, 96, 0.3)',
                  '0 0 0 rgba(243, 18, 96, 0)',
                ],
              }}
              transition={{ duration: 2, repeat: Infinity }}
              className="rounded-xl"
            >
              <Card shadow="sm" className="border-2 border-danger">
                <CardBody className="space-y-2">
                  <div className="flex items-center gap-2">
                    <FiAlertTriangle className="text-danger" size={20} />
                    <span className="font-bold text-danger">Deadlock Detected</span>
                  </div>
                  <p className="text-xs text-default-600" data-testid="deadlock-description">
                    {dl.cycleDescription}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {dl.involvedCoroutines.map((cId, i) => (
                      <Chip key={cId} size="sm" variant="flat" color="danger">
                        {dl.involvedCoroutineLabels[i] || cId}
                      </Chip>
                    ))}
                  </div>
                </CardBody>
              </Card>
            </motion.div>
          </motion.div>
        ))}

        {warnings.map((warn, idx) => (
          <motion.div
            key={`warning-${warn.seq}-${idx}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3, delay: idx * 0.05 }}
          >
            <motion.div
              animate={{
                boxShadow: [
                  '0 0 0 rgba(245, 165, 36, 0)',
                  '0 0 10px rgba(245, 165, 36, 0.2)',
                  '0 0 0 rgba(245, 165, 36, 0)',
                ],
              }}
              transition={{ duration: 2, repeat: Infinity }}
              className="rounded-xl"
            >
              <Card shadow="sm" className="border-2 border-warning">
                <CardBody className="space-y-2">
                  <div className="flex items-center gap-2">
                    <FiAlertTriangle className="text-warning" size={20} />
                    <span className="font-bold text-warning">Potential Deadlock Warning</span>
                  </div>
                  <p className="text-xs text-default-600" data-testid="warning-description">
                    Coroutine <span className="font-mono">{warn.coroutineLabel || warn.coroutineId}</span>{' '}
                    holds mutex <span className="font-mono">{warn.holdingMutexLabel || warn.holdingMutex}</span>{' '}
                    while requesting <span className="font-mono">{warn.requestingMutexLabel || warn.requestingMutex}</span>.
                  </p>
                  <div className="text-xs text-default-500">
                    {warn.recommendation}
                  </div>
                </CardBody>
              </Card>
            </motion.div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
