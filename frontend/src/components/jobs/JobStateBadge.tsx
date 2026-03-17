import { Chip } from '@heroui/react'
import { motion } from 'framer-motion'
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
  const isActive = status === 'Active'

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className="inline-flex"
    >
      <motion.div
        animate={
          isActive
            ? {
                boxShadow: [
                  '0 0 0 rgba(23, 201, 100, 0)',
                  '0 0 8px rgba(23, 201, 100, 0.3)',
                  '0 0 0 rgba(23, 201, 100, 0)',
                ],
              }
            : {}
        }
        transition={isActive ? { duration: 1.5, repeat: Infinity } : {}}
        className="rounded-full"
      >
        <Chip
          size="sm"
          variant="flat"
          color={getStatusColor(status)}
          data-testid="job-state-badge"
        >
          {status}
        </Chip>
      </motion.div>
    </motion.div>
  )
}
