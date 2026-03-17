import { Card, CardBody, Chip } from '@heroui/react'
import { FiCheckCircle, FiXCircle, FiAlertTriangle } from 'react-icons/fi'
import type { ValidationError, ValidationWarning } from '@/types/api'

interface ValidationErrorCardProps {
  error: ValidationError
}

export function ValidationErrorCard({ error }: ValidationErrorCardProps) {
  return (
    <Card shadow="sm" className="border border-danger/30" data-testid="validation-error-card">
      <CardBody className="flex flex-row items-start gap-3">
        <FiXCircle className="text-danger shrink-0 mt-0.5" size={18} />
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Chip size="sm" variant="flat" color="danger">{error.code}</Chip>
          </div>
          <p className="text-sm text-default-700">{error.message}</p>
          {(error.eventSeq != null || error.coroutineId) && (
            <div className="flex gap-2 text-xs text-default-400">
              {error.eventSeq != null && <span>Event #{error.eventSeq}</span>}
              {error.coroutineId && <span className="font-mono">{error.coroutineId}</span>}
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  )
}

interface ValidationWarningCardProps {
  warning: ValidationWarning
}

export function ValidationWarningCard({ warning }: ValidationWarningCardProps) {
  return (
    <Card shadow="sm" className="border border-warning/30" data-testid="validation-warning-card">
      <CardBody className="flex flex-row items-start gap-3">
        <FiAlertTriangle className="text-warning shrink-0 mt-0.5" size={18} />
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Chip size="sm" variant="flat" color="warning">{warning.code}</Chip>
          </div>
          <p className="text-sm text-default-700">{warning.message}</p>
          {warning.suggestion && (
            <p className="text-xs text-default-500">{warning.suggestion}</p>
          )}
          {(warning.eventSeq != null || warning.coroutineId) && (
            <div className="flex gap-2 text-xs text-default-400">
              {warning.eventSeq != null && <span>Event #{warning.eventSeq}</span>}
              {warning.coroutineId && <span className="font-mono">{warning.coroutineId}</span>}
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  )
}

interface ValidationPassCardProps {
  valid: boolean
  errorCount: number
  warningCount: number
}

export function ValidationPassCard({ valid, errorCount, warningCount }: ValidationPassCardProps) {
  return (
    <Card shadow="sm" data-testid="validation-summary">
      <CardBody className="flex flex-row items-center gap-3">
        {valid ? (
          <>
            <FiCheckCircle className="text-success" size={24} />
            <div>
              <div className="font-semibold text-success">Validation Passed</div>
              {warningCount > 0 && (
                <div className="text-xs text-default-500">
                  {warningCount} warning{warningCount !== 1 ? 's' : ''}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <FiXCircle className="text-danger" size={24} />
            <div>
              <div className="font-semibold text-danger">Validation Failed</div>
              <div className="text-xs text-default-500">
                {errorCount} error{errorCount !== 1 ? 's' : ''}
                {warningCount > 0 && `, ${warningCount} warning${warningCount !== 1 ? 's' : ''}`}
              </div>
            </div>
          </>
        )}
      </CardBody>
    </Card>
  )
}
