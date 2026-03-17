import { Card, CardBody, CardHeader, Chip, Divider } from '@heroui/react'
import { useFlowEvents } from '@/hooks/use-flow-events'
import { FlowOperatorChain } from './FlowOperatorChain'
import { FlowBackpressureIndicator } from './FlowBackpressureIndicator'
import { FlowValueTrace } from './FlowValueTrace'
import { SharedFlowPanel } from './SharedFlowPanel'
import { StateFlowPanel } from './StateFlowPanel'

interface FlowPanelProps {
  sessionId: string
}

function getFlowTypeColor(flowType: string): 'primary' | 'secondary' | 'warning' | 'success' {
  switch (flowType) {
    case 'Cold': return 'primary'
    case 'Hot': return 'secondary'
    case 'SharedFlow': return 'warning'
    case 'StateFlow': return 'success'
    default: return 'primary'
  }
}

export function FlowPanel({ sessionId }: FlowPanelProps) {
  const { flows, hasBackpressure } = useFlowEvents(sessionId)

  if (flows.length === 0) {
    return (
      <Card className="mt-2">
        <CardBody>
          <div className="text-center text-default-400 py-8" data-testid="flow-empty">
            <p className="text-lg font-semibold mb-2">No Flow Activity</p>
            <p className="text-sm">
              Flow events will appear here when flows are created and collected.
            </p>
          </div>
        </CardBody>
      </Card>
    )
  }

  return (
    <div className="space-y-4 mt-2" data-testid="flow-panel">
      {/* Summary statistics */}
      <div className="grid grid-cols-4 gap-3">
        <Card shadow="sm">
          <CardBody className="py-3">
            <div className="text-2xl font-bold text-primary">{flows.length}</div>
            <div className="text-xs text-default-500">Total Flows</div>
          </CardBody>
        </Card>
        <Card shadow="sm">
          <CardBody className="py-3">
            <div className="text-2xl font-bold text-secondary">
              {flows.reduce((sum, f) => sum + f.operators.length, 0)}
            </div>
            <div className="text-xs text-default-500">Operators</div>
          </CardBody>
        </Card>
        <Card shadow="sm">
          <CardBody className="py-3">
            <div className="text-2xl font-bold text-success">
              {flows.reduce((sum, f) => sum + f.emissions.length, 0)}
            </div>
            <div className="text-xs text-default-500">Emissions</div>
          </CardBody>
        </Card>
        <Card shadow="sm">
          <CardBody className="py-3">
            <div className={`text-2xl font-bold ${hasBackpressure ? 'text-warning' : 'text-default-300'}`}>
              {flows.reduce((sum, f) => sum + f.backpressureEvents.length, 0)}
            </div>
            <div className="text-xs text-default-500">Backpressure</div>
          </CardBody>
        </Card>
      </div>

      {/* Per-flow detail cards */}
      {flows.map((flow) => (
        <Card key={flow.flowId} shadow="sm">
          <CardHeader className="pb-2">
            <div className="flex w-full items-center justify-between">
              <div>
                <div className="font-semibold">
                  {flow.label || flow.flowId}
                </div>
                <div className="text-xs text-default-500 font-mono">
                  {flow.flowId}
                </div>
              </div>
              <div className="flex gap-2">
                <Chip size="sm" variant="flat" color={getFlowTypeColor(flow.flowType)}>
                  {flow.flowType}
                </Chip>
                <Chip size="sm" variant="bordered" color="default">
                  {flow.emissions.length} emitted
                </Chip>
              </div>
            </div>
          </CardHeader>
          <CardBody className="pt-0 space-y-4">
            {/* Operator chain */}
            <FlowOperatorChain operators={flow.operators} flowLabel={flow.label} />

            {/* Backpressure warning */}
            <FlowBackpressureIndicator events={flow.backpressureEvents} />

            {/* Value traces */}
            {flow.valueTraces.length > 0 && (
              <>
                <Divider />
                <FlowValueTrace traces={flow.valueTraces} />
              </>
            )}

            {/* SharedFlow sub-panel */}
            {flow.flowType === 'SharedFlow' && (
              <>
                <Divider />
                <SharedFlowPanel flow={flow} />
              </>
            )}

            {/* StateFlow sub-panel */}
            {flow.flowType === 'StateFlow' && (
              <>
                <Divider />
                <StateFlowPanel flow={flow} />
              </>
            )}
          </CardBody>
        </Card>
      ))}
    </div>
  )
}
