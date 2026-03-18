import { Card, CardBody, CardHeader, Chip } from '@heroui/react'
import { motion } from 'framer-motion'
import type { FlowState } from '@/hooks/use-flow-events'
import { useAnimationSlot } from '@/lib/animation-throttle'
import { rippleEmit } from '@/lib/animation-variants'

interface SharedFlowPanelProps {
  flow: FlowState
}

/**
 * Wrapper for each emission row that plays the rippleEmit animation
 * when an animation slot is available.
 */
function EmissionRow({
  emission,
}: {
  emission: FlowState['sharedEmissions'][number]
}) {
  const shouldAnimate = useAnimationSlot()
  const Component = shouldAnimate ? motion.div : 'div'

  return (
    <Component
      {...(shouldAnimate
        ? {
            variants: rippleEmit,
            initial: 'idle',
            animate: 'emit',
          }
        : {})}
      className="flex items-center justify-between rounded bg-default-50 px-2 py-1 text-xs"
      data-testid="shared-emission-row"
    >
      <span className="font-mono truncate">{emission.valuePreview}</span>
      <div className="flex gap-2 shrink-0">
        <Chip size="sm" variant="bordered" color="default">
          replay: {emission.replayCache}
        </Chip>
        <Chip size="sm" variant="bordered" color="default">
          buffer: {emission.extraBufferCapacity}
        </Chip>
      </div>
    </Component>
  )
}

export function SharedFlowPanel({ flow }: SharedFlowPanelProps) {
  return (
    <Card shadow="sm" data-testid="shared-flow-panel">
      <CardHeader className="pb-2">
        <div className="flex w-full items-center justify-between">
          <div className="font-semibold text-sm">SharedFlow</div>
          <Chip size="sm" variant="flat" color="secondary">
            {flow.subscriberCount} subscriber{flow.subscriberCount !== 1 ? 's' : ''}
          </Chip>
        </div>
      </CardHeader>
      <CardBody className="pt-0 space-y-3">
        {flow.sharedEmissions.length > 0 && (
          <div>
            <div className="text-xs text-default-500 font-semibold mb-1">
              Emission History ({flow.sharedEmissions.length})
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {flow.sharedEmissions.slice(-10).map((emission, idx) => (
                <EmissionRow
                  key={`${emission.seq}-${idx}`}
                  emission={emission}
                />
              ))}
            </div>
          </div>
        )}
        {flow.sharedEmissions.length === 0 && (
          <div className="text-xs text-default-400">No emissions yet</div>
        )}
      </CardBody>
    </Card>
  )
}
