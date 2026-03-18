/**
 * EventHighlight — displays details of the current event in step-through mode
 *
 * Shows the event kind, timestamp, coroutineId, and any event-specific fields
 * with a fade-in animation when the event changes.
 */

import { Card, CardBody, Chip } from '@heroui/react'
import { AnimatePresence, motion } from 'framer-motion'
import type { VizEvent } from '@/types/api'
import { formatNanoTime } from '@/lib/utils'

interface EventHighlightProps {
  currentEvent: VizEvent | null
}

/**
 * Extract event-specific fields (beyond the base VizEvent fields)
 * so they can be rendered dynamically.
 */
function getEventSpecificFields(event: VizEvent): Array<{ key: string; value: string }> {
  const baseKeys = new Set([
    'sessionId',
    'seq',
    'tsNanos',
    'kind',
    'coroutineId',
    'jobId',
    'parentCoroutineId',
    'scopeId',
    'label',
  ])

  const fields: Array<{ key: string; value: string }> = []

  for (const [key, value] of Object.entries(event)) {
    if (baseKeys.has(key)) continue
    if (value === null || value === undefined) continue

    const display =
      typeof value === 'object' ? JSON.stringify(value) : String(value)
    fields.push({ key, value: display })
  }

  return fields
}

function getKindColor(kind: string): 'primary' | 'success' | 'warning' | 'danger' | 'default' | 'secondary' {
  if (kind.includes('created') || kind.includes('Created')) return 'default'
  if (kind.includes('started') || kind.includes('Started')) return 'primary'
  if (kind.includes('completed') || kind.includes('Completed')) return 'success'
  if (kind.includes('failed') || kind.includes('Failed')) return 'danger'
  if (kind.includes('cancelled') || kind.includes('Cancelled')) return 'warning'
  if (kind.includes('suspended') || kind.includes('Suspended')) return 'secondary'
  if (kind.includes('resumed') || kind.includes('Resumed')) return 'primary'
  return 'default'
}

export function EventHighlight({ currentEvent }: EventHighlightProps) {
  if (!currentEvent) {
    return (
      <Card shadow="sm">
        <CardBody>
          <div className="py-4 text-center text-sm text-default-400">
            No event selected. Use the replay controls to step through events.
          </div>
        </CardBody>
      </Card>
    )
  }

  const specificFields = getEventSpecificFields(currentEvent)

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={`${currentEvent.sessionId}-${currentEvent.seq}`}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.2 }}
        data-testid="event-highlight"
      >
        <Card shadow="sm" className="border-l-4 border-primary">
          <CardBody className="space-y-3 py-3">
            {/* Header: kind + seq */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-default-500">
                  #{currentEvent.seq}
                </span>
                <Chip
                  size="sm"
                  color={getKindColor(currentEvent.kind ?? '')}
                  variant="flat"
                >
                  {currentEvent.kind ?? 'unknown'}
                </Chip>
              </div>
              <span className="font-mono text-xs text-default-400">
                {formatNanoTime(currentEvent.tsNanos)}
              </span>
            </div>

            {/* Core fields */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              {currentEvent.coroutineId && (
                <>
                  <span className="text-default-500">Coroutine</span>
                  <code className="font-mono text-default-700">
                    {currentEvent.coroutineId}
                  </code>
                </>
              )}
              {currentEvent.label && (
                <>
                  <span className="text-default-500">Label</span>
                  <span className="font-semibold">{currentEvent.label}</span>
                </>
              )}
              {currentEvent.scopeId && (
                <>
                  <span className="text-default-500">Scope</span>
                  <code className="font-mono text-default-700">
                    {currentEvent.scopeId}
                  </code>
                </>
              )}
              {currentEvent.parentCoroutineId && (
                <>
                  <span className="text-default-500">Parent</span>
                  <code className="font-mono text-default-700">
                    {currentEvent.parentCoroutineId}
                  </code>
                </>
              )}
            </div>

            {/* Event-specific fields */}
            {specificFields.length > 0 && (
              <div className="border-t border-divider pt-2">
                <div className="mb-1 text-xs font-semibold text-default-500">
                  Details
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  {specificFields.map(({ key, value }) => (
                    <div key={key} className="contents">
                      <span className="text-default-500">{key}</span>
                      <code className="truncate font-mono text-default-700">
                        {value}
                      </code>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      </motion.div>
    </AnimatePresence>
  )
}
