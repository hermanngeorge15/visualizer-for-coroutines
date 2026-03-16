import { Card, CardBody } from '@heroui/react'
import { FiAlertCircle } from 'react-icons/fi'

interface ErrorAlertProps {
  message: string
  title?: string
}

export function ErrorAlert({ message, title = 'Error' }: ErrorAlertProps) {
  return (
    <Card className="border-danger">
      <CardBody>
        <div className="flex items-start gap-3">
          <FiAlertCircle className="h-5 w-5 text-danger" />
          <div>
            <h4 className="font-semibold text-danger">{title}</h4>
            <p className="text-sm text-default-600">{message}</p>
          </div>
        </div>
      </CardBody>
    </Card>
  )
}

