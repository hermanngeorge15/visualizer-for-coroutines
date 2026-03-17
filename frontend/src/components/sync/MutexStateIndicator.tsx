import { Card, CardBody, CardHeader, Chip } from '@heroui/react'
import type { MutexState } from '@/hooks/use-sync-events'

interface MutexStateIndicatorProps {
  mutex: MutexState
}

export function MutexStateIndicator({ mutex }: MutexStateIndicatorProps) {
  return (
    <Card shadow="sm" data-testid="mutex-state">
      <CardHeader className="pb-2">
        <div className="flex w-full items-center justify-between">
          <div>
            <div className="font-semibold text-sm">
              {mutex.label || mutex.mutexId}
            </div>
            <div className="text-xs text-default-500 font-mono">{mutex.mutexId}</div>
          </div>
          <Chip
            size="sm"
            variant="flat"
            color={mutex.isLocked ? 'danger' : 'success'}
            data-testid="lock-status"
          >
            {mutex.isLocked ? 'Locked' : 'Unlocked'}
          </Chip>
        </div>
      </CardHeader>
      <CardBody className="pt-0">
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div>
            <div className="text-default-500">Holder</div>
            <div className="font-mono font-semibold">
              {mutex.currentHolder
                ? mutex.currentHolderLabel || mutex.currentHolder
                : 'None'}
            </div>
          </div>
          <div>
            <div className="text-default-500">Contention</div>
            <div className="font-semibold">{mutex.contentionCount}</div>
          </div>
          <div>
            <div className="text-default-500">Acquisitions</div>
            <div className="font-semibold">{mutex.lockAcquisitions}</div>
          </div>
        </div>
      </CardBody>
    </Card>
  )
}
