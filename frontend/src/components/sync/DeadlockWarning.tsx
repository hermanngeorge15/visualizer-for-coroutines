import { Card, CardBody, Chip } from '@heroui/react'
import { FiAlertTriangle } from 'react-icons/fi'
import type { DeadlockDetected, PotentialDeadlockWarning } from '@/types/api'

interface DeadlockWarningProps {
  deadlocks: DeadlockDetected[]
  warnings: PotentialDeadlockWarning[]
}

export function DeadlockWarning({ deadlocks, warnings }: DeadlockWarningProps) {
  if (deadlocks.length === 0 && warnings.length === 0) return null

  return (
    <div className="space-y-2" data-testid="deadlock-warning">
      {deadlocks.map((dl, idx) => (
        <Card key={`deadlock-${dl.seq}-${idx}`} shadow="sm" className="border-2 border-danger">
          <CardBody className="space-y-2">
            <div className="flex items-center gap-2">
              <FiAlertTriangle className="text-danger" size={20} />
              <span className="font-bold text-danger">Deadlock Detected</span>
            </div>
            <p className="text-xs text-default-600" data-testid="deadlock-description">
              {dl.cycleDescription}
            </p>
            <div className="flex flex-wrap gap-1">
              {dl.involvedCoroutines.map((cId, i) => (
                <Chip key={cId} size="sm" variant="flat" color="danger">
                  {dl.involvedCoroutineLabels[i] || cId}
                </Chip>
              ))}
            </div>
          </CardBody>
        </Card>
      ))}

      {warnings.map((warn, idx) => (
        <Card key={`warning-${warn.seq}-${idx}`} shadow="sm" className="border-2 border-warning">
          <CardBody className="space-y-2">
            <div className="flex items-center gap-2">
              <FiAlertTriangle className="text-warning" size={20} />
              <span className="font-bold text-warning">Potential Deadlock Warning</span>
            </div>
            <p className="text-xs text-default-600" data-testid="warning-description">
              Coroutine <span className="font-mono">{warn.coroutineLabel || warn.coroutineId}</span>{' '}
              holds mutex <span className="font-mono">{warn.holdingMutexLabel || warn.holdingMutex}</span>{' '}
              while requesting <span className="font-mono">{warn.requestingMutexLabel || warn.requestingMutex}</span>.
            </p>
            <div className="text-xs text-default-500">
              {warn.recommendation}
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  )
}
