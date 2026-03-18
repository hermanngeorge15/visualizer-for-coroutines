import { Card, CardBody, Chip } from '@heroui/react'
import { FiAlertCircle, FiAlertTriangle, FiInfo, FiChevronDown, FiChevronUp } from 'react-icons/fi'
import { useState } from 'react'
import type { RuleFinding } from './types'

interface FindingCardProps {
  finding: RuleFinding
}

const severityConfig = {
  ERROR: { color: 'danger' as const, icon: FiAlertCircle, label: 'Error' },
  WARNING: { color: 'warning' as const, icon: FiAlertTriangle, label: 'Warning' },
  INFO: { color: 'primary' as const, icon: FiInfo, label: 'Info' },
}

export function FindingCard({ finding }: FindingCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const config = severityConfig[finding.severity as keyof typeof severityConfig] ?? severityConfig.INFO

  const Icon = config.icon

  return (
    <Card shadow="none" className="border border-default-200">
      <CardBody className="py-2 px-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 min-w-0">
            <Icon size={16} className={`mt-0.5 shrink-0 text-${config.color}`} />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Chip size="sm" variant="flat" color={config.color}>
                  {config.label}
                </Chip>
                <Chip size="sm" variant="light">
                  {finding.category}
                </Chip>
                {finding.coroutineId && (
                  <span className="text-xs text-default-400 font-mono">
                    {finding.coroutineId}
                  </span>
                )}
              </div>
              <p className="text-sm text-default-700 mt-1">{finding.message}</p>
            </div>
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-default-100 rounded shrink-0"
          >
            {isExpanded ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
          </button>
        </div>

        {isExpanded && (
          <div className="mt-2 ml-6 space-y-2">
            <div className="text-xs bg-primary-50 text-primary-700 rounded px-2 py-1.5">
              {finding.suggestion}
            </div>
            {finding.affectedEntities.length > 0 && (
              <div className="text-xs text-default-400">
                Affected: {finding.affectedEntities.join(', ')}
              </div>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  )
}
