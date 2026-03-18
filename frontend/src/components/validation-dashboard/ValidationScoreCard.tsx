import { Card, CardBody, CircularProgress } from '@heroui/react'
import { FiCheckCircle, FiAlertCircle, FiAlertTriangle } from 'react-icons/fi'

interface ValidationScoreCardProps {
  score: number
  errors: number
  warnings: number
  info: number
  total: number
}

export function ValidationScoreCard({ score, errors, warnings, info, total }: ValidationScoreCardProps) {
  const color = score >= 80 ? 'success' : score >= 50 ? 'warning' : 'danger'
  const Icon = score >= 80 ? FiCheckCircle : score >= 50 ? FiAlertTriangle : FiAlertCircle

  return (
    <Card>
      <CardBody className="flex flex-row items-center gap-4">
        <CircularProgress
          size="lg"
          value={score}
          color={color}
          showValueLabel
          classNames={{
            value: 'text-lg font-bold',
          }}
        />
        <div>
          <div className="flex items-center gap-2">
            <Icon className={`text-${color}`} />
            <span className="font-semibold">
              {score >= 80 ? 'Healthy' : score >= 50 ? 'Needs Attention' : 'Issues Found'}
            </span>
          </div>
          <div className="flex gap-3 mt-1 text-xs text-default-500">
            {errors > 0 && <span className="text-danger">{errors} errors</span>}
            {warnings > 0 && <span className="text-warning">{warnings} warnings</span>}
            {info > 0 && <span className="text-primary">{info} info</span>}
            <span>{total} total findings</span>
          </div>
        </div>
      </CardBody>
    </Card>
  )
}
