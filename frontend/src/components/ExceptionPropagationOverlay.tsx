import { useMemo } from 'react'
import { Card, CardBody, Chip, Divider } from '@heroui/react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiZap, FiShield, FiX } from 'react-icons/fi'
import { exceptionWave, shakeError } from '@/lib/animation-variants'
import type { HierarchyNode, CoroutineState } from '@/types/api'

interface ExceptionPropagationOverlayProps {
  hierarchy: HierarchyNode[]
  failedCoroutineId: string
  isOpen: boolean
  onClose: () => void
}

interface PropagationStep {
  coroutineId: string
  name: string | null
  state: CoroutineState
  depth: number
  isSupervisor: boolean
  isFailureSource: boolean
}

export function ExceptionPropagationOverlay({
  hierarchy,
  failedCoroutineId,
  isOpen,
  onClose,
}: ExceptionPropagationOverlayProps) {
  const propagationPath = useMemo(() => {
    const nodeMap = new Map<string, HierarchyNode>()
    hierarchy.forEach(n => nodeMap.set(n.id, n))

    const steps: PropagationStep[] = []
    let current = nodeMap.get(failedCoroutineId)
    let depth = 0

    while (current) {
      steps.push({
        coroutineId: current.id,
        name: current.name,
        state: current.state,
        depth,
        isSupervisor: false, // Would need job type info
        isFailureSource: current.id === failedCoroutineId,
      })
      current = current.parentId ? nodeMap.get(current.parentId) : undefined
      depth++
    }

    return steps
  }, [hierarchy, failedCoroutineId])

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            variants={shakeError}
            initial="idle"
            animate="error"
            onClick={(e) => e.stopPropagation()}
            className="max-w-lg w-full mx-4"
          >
            <Card className="border-2 border-danger">
              <div className="flex items-center justify-between px-4 py-3 bg-danger-50">
                <div className="flex items-center gap-2">
                  <FiZap className="text-danger" />
                  <span className="font-bold text-danger">Exception Propagation</span>
                </div>
                <button onClick={onClose} className="p-1 hover:bg-danger-100 rounded">
                  <FiX size={18} />
                </button>
              </div>
              <Divider />
              <CardBody className="space-y-0">
                {propagationPath.map((step, i) => (
                  <motion.div
                    key={step.coroutineId}
                    variants={exceptionWave}
                    initial="idle"
                    animate="propagate"
                    custom={i * 0.3} // Staggered delay
                    className="flex items-center gap-3 py-2 px-3 rounded-lg"
                  >
                    {/* Vertical line connector */}
                    {i > 0 && (
                      <div className="absolute left-7 -mt-6 w-0.5 h-4 bg-danger-200" />
                    )}

                    {step.isFailureSource ? (
                      <FiZap className="text-danger shrink-0" size={18} />
                    ) : step.isSupervisor ? (
                      <FiShield className="text-warning shrink-0" size={18} />
                    ) : (
                      <div className="w-3 h-3 rounded-full bg-danger-300 shrink-0" />
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">
                          {step.name ?? step.coroutineId}
                        </span>
                        <Chip
                          size="sm"
                          variant="flat"
                          color={step.state === 'FAILED' ? 'danger' : step.state === 'CANCELLED' ? 'warning' : 'default'}
                        >
                          {step.state}
                        </Chip>
                        {step.isFailureSource && (
                          <Chip size="sm" color="danger" variant="dot">
                            Source
                          </Chip>
                        )}
                        {step.isSupervisor && (
                          <Chip size="sm" color="warning" variant="dot">
                            Supervisor boundary
                          </Chip>
                        )}
                      </div>
                      <span className="text-xs text-default-400 font-mono">
                        {step.coroutineId}
                      </span>
                    </div>
                  </motion.div>
                ))}

                {propagationPath.length === 0 && (
                  <div className="text-center text-default-400 py-4">
                    No propagation path found.
                  </div>
                )}
              </CardBody>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
