import { Chip } from '@heroui/react'
import type { JobStatus } from '@/hooks/use-job-events'

interface JobStateBadgeProps {
  status: JobStatus
}

function getStatusColor(status: JobStatus): 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'secondary' {
  switch (status) {
    case 'New': return 'default'
    case 'Active': return 'success'
    case 'Completing': return 'primary'
    case 'Completed': return 'primary'
    case 'Cancelled': return 'warning'
    case 'Failed': return 'danger'
    default: return 'default'
  }
}

export function JobStateBadge({ status }: JobStateBadgeProps) {
  return (
    <Chip
      size="sm"
      variant="flat"
      color={getStatusColor(status)}
      data-testid="job-state-badge"
    >
      {status}
    </Chip>
  )
}
