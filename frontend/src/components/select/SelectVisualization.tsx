import { Card, CardBody, CardHeader, Chip, Divider } from '@heroui/react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiZap, FiClock, FiCheck } from 'react-icons/fi'
import { scaleIn, staggerContainer } from '@/lib/animation-variants'
import { SelectClauseBar } from './SelectClauseBar'
import type { SelectState } from '@/hooks/use-select-events'

interface SelectVisualizationProps {
  selects: SelectState[]
}

export function SelectVisualization({ selects }: SelectVisualizationProps) {
  if (selects.length === 0) {
    return (
      <div className="text-center text-default-400 py-8">
        No select expressions detected.
      </div>
    )
  }

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="space-y-3"
    >
      {selects.map(select => (
        <motion.div key={select.selectId} variants={scaleIn}>
          <Card>
            <CardHeader className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                <FiZap size={16} />
                <span className="text-sm font-medium">
                  Select: {select.selectId.slice(-8)}
                </span>
                <Chip size="sm" variant="flat" color={select.isCompleted ? 'success' : 'warning'}>
                  {select.isCompleted ? 'Completed' : 'In Progress'}
                </Chip>
              </div>
              {select.totalDurationNanos && (
                <div className="flex items-center gap-1 text-xs text-default-400">
                  <FiClock size={12} />
                  {(select.totalDurationNanos / 1_000_000).toFixed(1)}ms
                </div>
              )}
            </CardHeader>
            <Divider />
            <CardBody className="space-y-2">
              <div className="text-xs text-default-400 mb-1">
                Coroutine: <span className="font-mono">{select.coroutineId}</span>
              </div>

              <AnimatePresence>
                {select.clauses.map(clause => (
                  <SelectClauseBar
                    key={clause.clauseIndex}
                    clause={clause}
                    isWinner={clause.clauseIndex === select.winnerIndex}
                    isCompleted={select.isCompleted}
                  />
                ))}
              </AnimatePresence>

              {select.winnerType && (
                <div className="flex items-center gap-1 text-xs text-success mt-1">
                  <FiCheck size={12} />
                  Winner: {select.winnerType}
                  {select.waitDurationNanos != null && (
                    <span className="text-default-400">
                      ({(select.waitDurationNanos / 1_000_000).toFixed(1)}ms wait)
                    </span>
                  )}
                </div>
              )}
            </CardBody>
          </Card>
        </motion.div>
      ))}
    </motion.div>
  )
}
