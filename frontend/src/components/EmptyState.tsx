import { Card, CardBody, Button } from '@heroui/react'
import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
  }
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <Card>
      <CardBody className="py-12">
        <div className="flex flex-col items-center justify-center gap-4 text-center">
          {icon && <div className="text-default-300">{icon}</div>}
          <div>
            <h3 className="mb-2 text-xl font-semibold">{title}</h3>
            <p className="text-default-500">{description}</p>
          </div>
          {action && (
            <Button color="primary" onPress={action.onClick}>
              {action.label}
            </Button>
          )}
        </div>
      </CardBody>
    </Card>
  )
}

