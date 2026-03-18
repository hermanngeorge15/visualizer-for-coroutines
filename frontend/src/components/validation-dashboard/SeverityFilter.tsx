import { Chip } from '@heroui/react'
import { FiAlertCircle, FiAlertTriangle, FiInfo } from 'react-icons/fi'

interface SeverityFilterProps {
  counts: { errors: number; warnings: number; info: number }
  active: Set<string>
  onToggle: (severity: string) => void
}

const filters = [
  { key: 'ERROR', label: 'Errors', icon: FiAlertCircle, color: 'danger' as const },
  { key: 'WARNING', label: 'Warnings', icon: FiAlertTriangle, color: 'warning' as const },
  { key: 'INFO', label: 'Info', icon: FiInfo, color: 'primary' as const },
]

export function SeverityFilter({ counts, active, onToggle }: SeverityFilterProps) {
  const countMap: Record<string, number> = {
    ERROR: counts.errors,
    WARNING: counts.warnings,
    INFO: counts.info,
  }

  return (
    <div className="flex gap-2">
      {filters.map(({ key, label, icon: Icon, color }) => (
        <Chip
          key={key}
          color={active.has(key) ? color : 'default'}
          variant={active.has(key) ? 'solid' : 'bordered'}
          startContent={<Icon size={12} />}
          className="cursor-pointer"
          onClick={() => onToggle(key)}
        >
          {label} ({countMap[key]})
        </Chip>
      ))}
    </div>
  )
}
