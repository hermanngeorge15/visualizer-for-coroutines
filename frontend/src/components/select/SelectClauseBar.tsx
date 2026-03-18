import { Chip, Progress } from '@heroui/react'
import { motion } from 'framer-motion'
import { FiRadio, FiSend, FiClock, FiCheck } from 'react-icons/fi'
import type { SelectClause } from '@/hooks/use-select-events'

interface SelectClauseBarProps {
  clause: SelectClause
  isWinner: boolean
  isCompleted: boolean
}

const clauseIcons: Record<string, typeof FiRadio> = {
  onReceive: FiRadio,
  onSend: FiSend,
  onAwait: FiClock,
  onTimeout: FiClock,
  onJoin: FiCheck,
}

export function SelectClauseBar({ clause, isWinner, isCompleted }: SelectClauseBarProps) {
  const Icon = clauseIcons[clause.clauseType] ?? FiRadio

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: clause.clauseIndex * 0.05 }}
      className={`flex items-center gap-2 p-2 rounded-lg ${
        isWinner ? 'bg-success-50 border border-success-200' : 'bg-default-50'
      }`}
    >
      <Icon size={14} className={isWinner ? 'text-success' : 'text-default-400'} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium">{clause.clauseType}</span>
          {clause.label && (
            <span className="text-xs text-default-400">{clause.label}</span>
          )}
          {clause.channelId && (
            <Chip size="sm" variant="flat">ch:{clause.channelId.slice(-6)}</Chip>
          )}
          {clause.deferredId && (
            <Chip size="sm" variant="flat">def:{clause.deferredId.slice(-6)}</Chip>
          )}
          {clause.timeoutMillis != null && (
            <Chip size="sm" variant="flat">{clause.timeoutMillis}ms</Chip>
          )}
        </div>

        {isCompleted && (
          <Progress
            size="sm"
            value={isWinner ? 100 : 0}
            color={isWinner ? 'success' : 'default'}
            className="mt-1"
          />
        )}
      </div>

      {isWinner && (
        <Chip size="sm" color="success" variant="solid">
          Winner
        </Chip>
      )}
    </motion.div>
  )
}
