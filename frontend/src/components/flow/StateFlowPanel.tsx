import { Card, CardBody, CardHeader, Chip } from '@heroui/react'
import { FiArrowRight } from 'react-icons/fi'
import type { FlowState } from '@/hooks/use-flow-events'

interface StateFlowPanelProps {
  flow: FlowState
}

export function StateFlowPanel({ flow }: StateFlowPanelProps) {
  const changes = flow.stateFlowChanges
  const latest = changes.length > 0 ? changes[changes.length - 1] : null

  return (
    <Card shadow="sm" data-testid="state-flow-panel">
      <CardHeader className="pb-2">
        <div className="flex w-full items-center justify-between">
          <div className="font-semibold text-sm">StateFlow</div>
          <div className="flex gap-2">
            <Chip size="sm" variant="flat" color="secondary">
              {flow.subscriberCount} subscriber{flow.subscriberCount !== 1 ? 's' : ''}
            </Chip>
          </div>
        </div>
      </CardHeader>
      <CardBody className="pt-0 space-y-3">
        {latest && (
          <div className="rounded-md bg-primary/10 px-3 py-2" data-testid="current-value">
            <div className="text-xs text-default-500 mb-1">Current Value</div>
            <div className="font-mono text-sm font-semibold text-primary">
              {latest.newValuePreview}
            </div>
            <div className="text-xs text-default-400 mt-1">
              Type: {latest.valueType}
            </div>
          </div>
        )}

        {changes.length > 0 && (
          <div>
            <div className="text-xs text-default-500 font-semibold mb-1">
              Value Change History ({changes.length})
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {changes.slice(-10).map((change, idx) => (
                <div
                  key={`${change.seq}-${idx}`}
                  className="flex items-center gap-2 rounded bg-default-50 px-2 py-1 text-xs"
                  data-testid="state-change-row"
                >
                  <span className="font-mono text-default-400 truncate">
                    {change.oldValuePreview}
                  </span>
                  <FiArrowRight className="text-default-400 shrink-0" size={12} />
                  <span className="font-mono text-primary truncate">
                    {change.newValuePreview}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {changes.length === 0 && (
          <div className="text-xs text-default-400">No value changes recorded</div>
        )}
      </CardBody>
    </Card>
  )
}
