import { Card, CardBody, Chip, Progress } from '@heroui/react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiCheck, FiX, FiLoader, FiClock } from 'react-icons/fi'
import { pulseActive, scaleIn, shakeError } from '@/lib/animation-variants'

export type StageStatus = 'pending' | 'active' | 'completed' | 'failed'

export interface PipelineStageProps {
  label: string
  status: StageStatus
  duration?: number
  children?: React.ReactNode
}

const statusConfig: Record<
  StageStatus,
  {
    color: 'default' | 'primary' | 'success' | 'danger'
    chipColor: 'default' | 'primary' | 'success' | 'danger'
    borderClass: string
    bgClass: string
    icon: React.ReactNode
    text: string
  }
> = {
  pending: {
    color: 'default',
    chipColor: 'default',
    borderClass: 'border-default-200',
    bgClass: 'bg-default-50',
    icon: <FiClock className="w-3.5 h-3.5 text-default-400" />,
    text: 'Pending',
  },
  active: {
    color: 'primary',
    chipColor: 'primary',
    borderClass: 'border-primary',
    bgClass: 'bg-primary-50',
    icon: <FiLoader className="w-3.5 h-3.5 text-primary animate-spin" />,
    text: 'Running',
  },
  completed: {
    color: 'success',
    chipColor: 'success',
    borderClass: 'border-success',
    bgClass: 'bg-success-50',
    icon: <FiCheck className="w-3.5 h-3.5 text-success" />,
    text: 'Done',
  },
  failed: {
    color: 'danger',
    chipColor: 'danger',
    borderClass: 'border-danger',
    bgClass: 'bg-danger-50',
    icon: <FiX className="w-3.5 h-3.5 text-danger" />,
    text: 'Failed',
  },
}

function formatDurationMs(nanos: number): string {
  const ms = nanos / 1_000_000
  if (ms < 1000) return `${ms.toFixed(0)}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

/**
 * Shared reusable component for a single stage in a scenario pipeline.
 *
 * Renders as a card with color-coded status, animated transitions,
 * and optional child content for additional detail.
 */
export function ScenarioPipelineStage({ label, status, duration, children }: PipelineStageProps) {
  const config = statusConfig[status]

  // Select the appropriate framer-motion variant based on status
  const animateVariant = status === 'active' ? 'active' : status === 'failed' ? 'error' : 'idle'
  const variants = status === 'active' ? pulseActive : status === 'failed' ? shakeError : scaleIn

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={`${label}-${status}`}
        variants={variants}
        initial={status === 'completed' ? 'hidden' : 'idle'}
        animate={status === 'completed' ? 'visible' : animateVariant}
        layout
      >
        <Card
          shadow="sm"
          className={`border-2 ${config.borderClass} ${config.bgClass} min-w-[160px] transition-colors duration-300`}
        >
          <CardBody className="p-3 gap-2">
            {/* Header: icon + label */}
            <div className="flex items-center gap-2">
              {config.icon}
              <span className="text-sm font-semibold truncate">{label}</span>
            </div>

            {/* Status chip */}
            <div className="flex items-center justify-between gap-2">
              <Chip size="sm" variant="flat" color={config.chipColor}>
                {config.text}
              </Chip>
              {duration != null && duration > 0 && (
                <span className="text-xs text-default-500 font-mono">
                  {formatDurationMs(duration)}
                </span>
              )}
            </div>

            {/* Active progress bar */}
            {status === 'active' && (
              <Progress
                size="sm"
                isIndeterminate
                color="primary"
                aria-label={`${label} in progress`}
                className="mt-1"
              />
            )}

            {/* Optional children (e.g., parallel sub-stages) */}
            {children && <div className="mt-2">{children}</div>}
          </CardBody>
        </Card>
      </motion.div>
    </AnimatePresence>
  )
}
