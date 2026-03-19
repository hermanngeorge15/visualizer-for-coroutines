import { useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { FlowState } from '@/hooks/use-flow-events'
import {
  flowParticle,
  flowParticleFiltered,
  flowParticleTransform,
} from '@/lib/animation-variants'

interface FlowParticlePathProps {
  flow: FlowState
}

const NODE_RADIUS = 18
const NODE_GAP = 120
const SVG_PADDING = 40
const PARTICLE_RADIUS = 5

function getOperatorFill(name: string): string {
  const lower = name.toLowerCase()
  if (lower.includes('map') || lower.includes('transform')) return '#6366f1' // indigo
  if (lower.includes('filter')) return '#f59e0b' // amber
  if (lower.includes('collect') || lower.includes('reduce') || lower.includes('fold')) return '#10b981' // emerald
  if (lower.includes('flat') || lower.includes('merge') || lower.includes('combine')) return '#a855f7' // purple
  return '#94a3b8' // slate
}

export function FlowParticlePath({ flow }: FlowParticlePathProps) {
  const operators = useMemo(
    () => [...flow.operators].sort((a, b) => a.operatorIndex - b.operatorIndex),
    [flow.operators],
  )

  // Nodes: source + operators + collect
  const nodeCount = operators.length + 2
  const svgWidth = SVG_PADDING * 2 + (nodeCount - 1) * NODE_GAP
  const svgHeight = 100

  // Calculate positions for each node
  const nodePositions = useMemo(() => {
    const positions: Array<{ x: number; y: number; label: string; color: string }> = []
    for (let i = 0; i < nodeCount; i++) {
      const x = SVG_PADDING + i * NODE_GAP
      const y = svgHeight / 2
      if (i === 0) {
        positions.push({ x, y, label: 'source', color: '#94a3b8' })
      } else if (i === nodeCount - 1) {
        positions.push({ x, y, label: 'collect', color: '#10b981' })
      } else {
        const op = operators[i - 1]!
        positions.push({ x, y, label: op.operatorName, color: getOperatorFill(op.operatorName) })
      }
    }
    return positions
  }, [operators, nodeCount])

  // Build the path d attribute connecting all nodes
  const pathD = useMemo(() => {
    if (nodePositions.length < 2) return ''
    const first = nodePositions[0]!
    const last = nodePositions[nodePositions.length - 1]!
    return `M ${first.x + NODE_RADIUS} ${first.y} L ${last.x - NODE_RADIUS} ${last.y}`
  }, [nodePositions])

  // Recent value traces for particle animation (show last 8)
  const recentTraces = useMemo(() => {
    return flow.valueTraces.slice(-8)
  }, [flow.valueTraces])

  return (
    <div className="overflow-x-auto" data-testid="flow-particle-path">
      <svg
        width={svgWidth}
        height={svgHeight}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="min-w-full"
      >
        {/* Connection line */}
        <motion.path
          d={pathD}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          className="text-default-300"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.8, ease: 'easeInOut' }}
        />

        {/* Operator station nodes */}
        {nodePositions.map((pos, i) => (
          <g key={i}>
            <motion.circle
              cx={pos.x}
              cy={pos.y}
              r={NODE_RADIUS}
              fill={pos.color}
              fillOpacity={0.15}
              stroke={pos.color}
              strokeWidth={2}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: i * 0.08, type: 'spring', stiffness: 300, damping: 20 }}
            />
            <text
              x={pos.x}
              y={pos.y + NODE_RADIUS + 14}
              textAnchor="middle"
              className="fill-current text-default-600"
              fontSize={10}
              fontFamily="monospace"
            >
              {pos.label}
            </text>
          </g>
        ))}

        {/* Animated particles for recent value traces */}
        <AnimatePresence>
          {recentTraces.map((trace, idx) => {
            // Determine which operator this trace relates to
            const opIndex = operators.findIndex(op => op.operatorName === trace.operatorName)
            const targetNodeIdx = opIndex >= 0 ? opIndex + 1 : nodePositions.length - 1
            const startPos = nodePositions[0]!
            const endPos = nodePositions[targetNodeIdx]!

            const isFiltered = trace.filtered === true
            const isTransformed = trace.transformedValue !== null

            if (isFiltered) {
              return (
                <motion.circle
                  key={`particle-${trace.sequenceNumber}-${idx}`}
                  r={PARTICLE_RADIUS}
                  fill="#f59e0b"
                  variants={flowParticleFiltered}
                  initial="enter"
                  animate="filtered"
                  exit="filtered"
                  custom={{ startX: startPos.x, endX: endPos.x, y: startPos.y }}
                />
              )
            }

            if (isTransformed) {
              return (
                <motion.circle
                  key={`particle-${trace.sequenceNumber}-${idx}`}
                  r={PARTICLE_RADIUS}
                  variants={flowParticleTransform}
                  initial="enter"
                  animate="animate"
                  exit="exit"
                  custom={{ startX: startPos.x, endX: endPos.x, y: startPos.y }}
                />
              )
            }

            return (
              <motion.circle
                key={`particle-${trace.sequenceNumber}-${idx}`}
                r={PARTICLE_RADIUS}
                fill="#6366f1"
                variants={flowParticle}
                initial="enter"
                animate="animate"
                exit="exit"
                custom={{
                  startX: startPos.x + NODE_RADIUS,
                  endX: nodePositions[nodePositions.length - 1]!.x - NODE_RADIUS,
                  y: startPos.y,
                  delay: idx * 0.15,
                }}
              />
            )
          })}
        </AnimatePresence>
      </svg>
    </div>
  )
}
