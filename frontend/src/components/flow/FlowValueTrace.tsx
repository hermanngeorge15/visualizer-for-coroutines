import { Chip } from '@heroui/react'
import { motion } from 'framer-motion'
import { FiArrowRight, FiCheck, FiX } from 'react-icons/fi'
import { useAnimationSlot } from '@/lib/animation-throttle'
import { rippleEmit } from '@/lib/animation-variants'

interface ValueTrace {
  sequenceNumber: number
  inputValue: string
  transformedValue: string | null
  filtered: boolean | null
  operatorName: string
}

interface FlowValueTraceProps {
  traces: ValueTrace[]
}

/**
 * Single trace row that plays the rippleEmit animation when a slot is available.
 */
function TraceRow({ trace }: { trace: ValueTrace }) {
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
      className="flex items-center gap-2 rounded-md bg-default-50 px-2 py-1 text-xs"
      data-testid="trace-row"
    >
      <span className="font-mono text-default-400 w-6">#{trace.sequenceNumber}</span>
      <Chip size="sm" variant="flat" color="default" className="shrink-0">
        {trace.operatorName}
      </Chip>
      <span className="font-mono text-primary truncate">{trace.inputValue}</span>
      {trace.transformedValue != null && (
        <>
          <FiArrowRight className="text-default-400 shrink-0" size={12} />
          <span className="font-mono text-success truncate">{trace.transformedValue}</span>
        </>
      )}
      {trace.filtered != null && (
        <Chip
          size="sm"
          variant="flat"
          color={trace.filtered ? 'danger' : 'success'}
          startContent={trace.filtered ? <FiX size={10} /> : <FiCheck size={10} />}
        >
          {trace.filtered ? 'filtered' : 'passed'}
        </Chip>
      )}
    </Component>
  )
}

export function FlowValueTrace({ traces }: FlowValueTraceProps) {
  if (traces.length === 0) {
    return (
      <div className="text-xs text-default-400" data-testid="no-traces">
        No value traces recorded
      </div>
    )
  }

  // Show most recent traces (limit to 20)
  const recent = traces.slice(-20)

  return (
    <div className="space-y-2" data-testid="flow-value-trace">
      <div className="text-xs text-default-500 font-semibold">
        Value Traces ({traces.length} total)
      </div>
      <div className="space-y-1 max-h-64 overflow-y-auto">
        {recent.map((trace, idx) => (
          <TraceRow
            key={`${trace.sequenceNumber}-${idx}`}
            trace={trace}
          />
        ))}
      </div>
    </div>
  )
}
