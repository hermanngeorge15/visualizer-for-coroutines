import { Chip } from '@heroui/react'
import { motion } from 'framer-motion'
import { FiArrowRight } from 'react-icons/fi'
import type { FlowOperator } from '@/hooks/use-flow-events'
import type { FlowState } from '@/hooks/use-flow-events'
import { FlowParticlePath } from './FlowParticlePath'

interface FlowOperatorChainProps {
  operators: FlowOperator[]
  flowLabel: string | null
  visualMode?: 'chips' | 'svg'
  flow?: FlowState
}

function getOperatorColor(name: string): 'primary' | 'secondary' | 'warning' | 'success' | 'default' {
  const lower = name.toLowerCase()
  if (lower.includes('map') || lower.includes('transform')) return 'primary'
  if (lower.includes('filter')) return 'warning'
  if (lower.includes('collect') || lower.includes('reduce') || lower.includes('fold')) return 'success'
  if (lower.includes('flat') || lower.includes('merge') || lower.includes('combine')) return 'secondary'
  return 'default'
}

export function FlowOperatorChain({ operators, flowLabel, visualMode = 'chips', flow }: FlowOperatorChainProps) {
  if (operators.length === 0) {
    return (
      <div className="text-xs text-default-400" data-testid="no-operators">
        No operators applied
      </div>
    )
  }

  if (visualMode === 'svg' && flow) {
    return (
      <div className="space-y-2" data-testid="flow-operator-chain">
        {flowLabel && (
          <div className="text-xs text-default-500 font-mono mb-1">{flowLabel}</div>
        )}
        <FlowParticlePath flow={flow} />
      </div>
    )
  }

  const sorted = [...operators].sort((a, b) => a.operatorIndex - b.operatorIndex)

  return (
    <div className="space-y-2" data-testid="flow-operator-chain">
      {flowLabel && (
        <div className="text-xs text-default-500 font-mono mb-1">{flowLabel}</div>
      )}
      <div className="flex flex-wrap items-center gap-1">
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Chip size="sm" variant="bordered" color="default">source</Chip>
        </motion.div>
        {sorted.map((op, index) => (
          <motion.div
            key={`${op.flowId}-${op.operatorIndex}`}
            className="flex items-center gap-1"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: (index + 1) * 0.08 }}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.2, delay: (index + 1) * 0.08 }}
            >
              <FiArrowRight className="text-default-400 shrink-0" size={14} />
            </motion.div>
            <Chip
              size="sm"
              variant="flat"
              color={getOperatorColor(op.operatorName)}
            >
              {op.operatorName}
              {op.label ? ` (${op.label})` : ''}
            </Chip>
          </motion.div>
        ))}
        <motion.div
          className="flex items-center gap-1"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: (sorted.length + 1) * 0.08 }}
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.2, delay: (sorted.length + 1) * 0.08 }}
          >
            <FiArrowRight className="text-default-400 shrink-0" size={14} />
          </motion.div>
          <Chip size="sm" variant="bordered" color="success">collect</Chip>
        </motion.div>
      </div>
    </div>
  )
}
