import { Card, CardBody, Chip } from '@heroui/react'
import type { WaitingForChildrenEvent } from '@/types/api'

interface WaitingForChildrenCardProps {
  event: WaitingForChildrenEvent
}

export function WaitingForChildrenCard({ event }: WaitingForChildrenCardProps) {
  return (
    <Card shadow="sm" className="border border-primary/30" data-testid="waiting-for-children-card">
      <CardBody className="space-y-2">
        <div className="flex items-center gap-2">
          <Chip size="sm" variant="flat" color="primary">Waiting for Children</Chip>
          <span className="text-xs text-default-500">
            {event.activeChildrenCount} active child{event.activeChildrenCount !== 1 ? 'ren' : ''}
          </span>
        </div>
        <div className="text-xs">
          <span className="text-default-500">Parent: </span>
          <span className="font-mono">{event.label || event.coroutineId}</span>
        </div>
        {event.activeChildrenIds.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {event.activeChildrenIds.map((childId) => (
              <Chip key={childId} size="sm" variant="bordered" color="secondary">
                {childId}
              </Chip>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  )
}
