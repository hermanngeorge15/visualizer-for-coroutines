import { Button, Card, CardBody, Divider } from '@heroui/react'
import { FiPlay } from 'react-icons/fi'
import { useValidation } from '@/hooks/use-validation'
import {
  ValidationPassCard,
  ValidationErrorCard,
  ValidationWarningCard,
} from './ValidationResultCard'
import { TimingReportView } from './TimingReportView'

interface ValidationPanelProps {
  sessionId: string
}

export function ValidationPanel({ sessionId }: ValidationPanelProps) {
  const { validate, data, isLoading, isError, error } = useValidation(sessionId)

  return (
    <div className="space-y-4 mt-2" data-testid="validation-panel">
      {/* Run button */}
      <Card>
        <CardBody className="flex flex-row items-center justify-between">
          <div>
            <div className="font-semibold">Session Validation</div>
            <div className="text-xs text-default-500">
              Run validation checks to detect event ordering issues, timing anomalies, and structural problems.
            </div>
          </div>
          <Button
            color="primary"
            startContent={isLoading ? undefined : <FiPlay />}
            onPress={() => validate()}
            isLoading={isLoading}
            data-testid="run-validation-btn"
          >
            {isLoading ? 'Running...' : 'Run Validation'}
          </Button>
        </CardBody>
      </Card>

      {/* Error state */}
      {isError && (
        <Card className="border border-danger/30">
          <CardBody>
            <div className="text-danger text-sm" data-testid="validation-error">
              Validation failed: {error?.message || 'Unknown error'}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Results */}
      {data && (
        <>
          {/* Summary pass/fail */}
          <ValidationPassCard
            valid={data.valid}
            errorCount={data.errors.length}
            warningCount={data.warnings.length}
          />

          {/* Errors */}
          {data.errors.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-danger">
                Errors ({data.errors.length})
              </h3>
              {data.errors.map((err, idx) => (
                <ValidationErrorCard key={`${err.code}-${idx}`} error={err} />
              ))}
            </div>
          )}

          {/* Warnings */}
          {data.warnings.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-warning">
                Warnings ({data.warnings.length})
              </h3>
              {data.warnings.map((warn, idx) => (
                <ValidationWarningCard key={`${warn.code}-${idx}`} warning={warn} />
              ))}
            </div>
          )}

          <Divider />

          {/* Timing report */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-default-600">Timing Report</h3>
            <TimingReportView timing={data.timing} />
          </div>
        </>
      )}

      {/* No results yet */}
      {!data && !isLoading && !isError && (
        <Card>
          <CardBody>
            <div className="text-center text-default-400 py-8" data-testid="validation-empty">
              <p className="text-sm">
                Click "Run Validation" to analyze this session for issues.
              </p>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  )
}
