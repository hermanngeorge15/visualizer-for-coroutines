import { Chip } from '@heroui/react'
import { FiAlertTriangle, FiAlertCircle, FiInfo } from 'react-icons/fi'
import type { AntiPatternSeverity } from '@/hooks/use-anti-patterns'

interface AntiPatternBadgeProps {
  severity: AntiPatternSeverity
  count: number
  onClick?: () => void
}

const severityConfig: Record<AntiPatternSeverity, { color: 'danger' | 'warning' | 'primary'; icon: typeof FiAlertCircle }> = {
  ERROR: { color: 'danger', icon: FiAlertCircle },
  WARNING: { color: 'warning', icon: FiAlertTriangle },
  INFO: { color: 'primary', icon: FiInfo },
}

export function AntiPatternBadge({ severity, count, onClick }: AntiPatternBadgeProps) {
  if (count === 0) return null

  const config = severityConfig[severity]
  const Icon = config.icon

  return (
    <Chip
      color={config.color}
      variant="flat"
      size="sm"
      startContent={<Icon size={12} />}
      className="cursor-pointer"
      onClick={onClick}
    >
      {count}
    </Chip>
  )
}
