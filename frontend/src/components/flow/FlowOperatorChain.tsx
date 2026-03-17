import { Chip } from '@heroui/react'
import { FiArrowRight } from 'react-icons/fi'
import type { FlowOperator } from '@/hooks/use-flow-events'

interface FlowOperatorChainProps {
  operators: FlowOperator[]
  flowLabel: string | null
}

function getOperatorColor(name: string): 'primary' | 'secondary' | 'warning' | 'success' | 'default' {
  const lower = name.toLowerCase()
  if (lower.includes('map') || lower.includes('transform')) return 'primary'
  if (lower.includes('filter')) return 'warning'
  if (lower.includes('collect') || lower.includes('reduce') || lower.includes('fold')) return 'success'
  if (lower.includes('flat') || lower.includes('merge') || lower.includes('combine')) return 'secondary'
  return 'default'
}

export function FlowOperatorChain({ operators, flowLabel }: FlowOperatorChainProps) {
  if (operators.length === 0) {
    return (
      <div className="text-xs text-default-400" data-testid="no-operators">
        No operators applied
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
        <Chip size="sm" variant="bordered" color="default">source</Chip>
        {sorted.map((op) => (
          <div key={`${op.flowId}-${op.operatorIndex}`} className="flex items-center gap-1">
            <FiArrowRight className="text-default-400 shrink-0" size={14} />
            <Chip
              size="sm"
              variant="flat"
              color={getOperatorColor(op.operatorName)}
            >
              {op.operatorName}
              {op.label ? ` (${op.label})` : ''}
            </Chip>
          </div>
        ))}
        <FiArrowRight className="text-default-400 shrink-0" size={14} />
        <Chip size="sm" variant="bordered" color="success">collect</Chip>
      </div>
    </div>
  )
}
