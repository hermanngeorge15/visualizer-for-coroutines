import { Card, CardBody, CardHeader, Chip } from '@heroui/react'
import type { SemaphoreState } from '@/hooks/use-sync-events'

interface SemaphoreGaugeProps {
  semaphore: SemaphoreState
}

function getGaugeColor(available: number, total: number): 'success' | 'warning' | 'danger' {
  if (total === 0) return 'success'
  const ratio = available / total
  if (ratio <= 0) return 'danger'
  if (ratio < 0.3) return 'warning'
  return 'success'
}

export function SemaphoreGauge({ semaphore }: SemaphoreGaugeProps) {
  const usedPermits = semaphore.totalPermits - semaphore.availablePermits
  const percent = semaphore.totalPermits > 0
    ? (usedPermits / semaphore.totalPermits) * 100
    : 0
  const color = getGaugeColor(semaphore.availablePermits, semaphore.totalPermits)

  return (
    <Card shadow="sm" data-testid="semaphore-gauge">
      <CardHeader className="pb-2">
        <div className="flex w-full items-center justify-between">
          <div>
            <div className="font-semibold text-sm">
              {semaphore.label || semaphore.semaphoreId}
            </div>
            <div className="text-xs text-default-500 font-mono">{semaphore.semaphoreId}</div>
          </div>
          <Chip size="sm" variant="flat" color={color}>
            {semaphore.availablePermits} / {semaphore.totalPermits} available
          </Chip>
        </div>
      </CardHeader>
      <CardBody className="pt-0 space-y-3">
        {/* Circular gauge representation using progress bar */}
        <div className="flex items-center justify-center" data-testid="gauge-visual">
          <div className="relative w-24 h-24">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              {/* Background circle */}
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="currentColor"
                strokeWidth="8"
                className="text-default-200"
              />
              {/* Used permits arc */}
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="currentColor"
                strokeWidth="8"
                strokeDasharray={`${percent * 2.51} ${251 - percent * 2.51}`}
                className={
                  color === 'danger'
                    ? 'text-danger'
                    : color === 'warning'
                      ? 'text-warning'
                      : 'text-success'
                }
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-lg font-bold">{usedPermits}</div>
              <div className="text-[10px] text-default-400">used</div>
            </div>
          </div>
        </div>

        {/* Waiting info */}
        {semaphore.waitQueue.length > 0 && (
          <div className="text-xs">
            <Chip size="sm" variant="flat" color="warning">
              {semaphore.waitQueue.length} waiting
            </Chip>
          </div>
        )}
      </CardBody>
    </Card>
  )
}
