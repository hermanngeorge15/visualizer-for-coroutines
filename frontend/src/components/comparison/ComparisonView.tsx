import { useState } from 'react'
import {
  Card,
  CardBody,
  CardHeader,
  Chip,
  Select,
  SelectItem,
  Spinner,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
} from '@heroui/react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiArrowUp, FiArrowDown, FiMinus } from 'react-icons/fi'
import { useSessions } from '@/hooks/use-sessions'
import { useComparison } from '@/hooks/use-comparison'
import { formatNanoTime } from '@/lib/utils'
import type { SessionComparison, CoroutineComparison } from '@/types/api'

/**
 * Side-by-side comparison of two coroutine visualization sessions.
 *
 * Renders two session selector dropdowns at the top, summary stats with
 * color-coded diffs, and a breakdown of coroutines unique to each session
 * and common coroutines with state differences.
 */
export function ComparisonView() {
  const [sessionAId, setSessionAId] = useState<string | undefined>()
  const [sessionBId, setSessionBId] = useState<string | undefined>()

  const { data: sessions, isLoading: sessionsLoading } = useSessions()
  const { data: comparison, isLoading: comparisonLoading, isError, error } = useComparison(sessionAId, sessionBId)

  return (
    <motion.div
      className="space-y-4"
      data-testid="comparison-view"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      {/* Session selectors */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Session Comparison</h2>
        </CardHeader>
        <CardBody>
          <div className="flex gap-4">
            <Select
              label="Session A (baseline)"
              placeholder="Select session A"
              data-testid="select-session-a"
              isLoading={sessionsLoading}
              selectedKeys={sessionAId ? [sessionAId] : []}
              onSelectionChange={(keys) => {
                const selected = Array.from(keys)[0] as string | undefined
                setSessionAId(selected)
              }}
              disabledKeys={sessionBId ? [sessionBId] : []}
              className="flex-1"
            >
              {(sessions ?? []).map((s) => (
                <SelectItem key={s.sessionId}>
                  {s.sessionId} ({s.coroutineCount} coroutines)
                </SelectItem>
              ))}
            </Select>

            <Select
              label="Session B (comparison)"
              placeholder="Select session B"
              data-testid="select-session-b"
              isLoading={sessionsLoading}
              selectedKeys={sessionBId ? [sessionBId] : []}
              onSelectionChange={(keys) => {
                const selected = Array.from(keys)[0] as string | undefined
                setSessionBId(selected)
              }}
              disabledKeys={sessionAId ? [sessionAId] : []}
              className="flex-1"
            >
              {(sessions ?? []).map((s) => (
                <SelectItem key={s.sessionId}>
                  {s.sessionId} ({s.coroutineCount} coroutines)
                </SelectItem>
              ))}
            </Select>
          </div>
        </CardBody>
      </Card>

      {/* Loading */}
      {comparisonLoading && (
        <div className="flex items-center justify-center py-12" data-testid="comparison-loading">
          <Spinner size="lg" />
        </div>
      )}

      {/* Error */}
      <AnimatePresence>
        {isError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="border border-danger/30">
              <CardBody>
                <div className="text-danger text-sm" data-testid="comparison-error">
                  Comparison failed: {error?.message || 'Unknown error'}
                </div>
              </CardBody>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results */}
      <AnimatePresence mode="wait">
        {comparison && (
          <motion.div
            key="comparison-results"
            className="space-y-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
          >
            <SummaryStats comparison={comparison} />
            <UniqueCoroutines comparison={comparison} />
            <CommonCoroutines comparison={comparison} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      {!comparison && !comparisonLoading && !isError && (
        <Card>
          <CardBody>
            <div className="text-center text-default-400 py-8" data-testid="comparison-empty">
              <p className="text-sm">Select two different sessions above to compare them.</p>
            </div>
          </CardBody>
        </Card>
      )}
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Summary Stats
// ---------------------------------------------------------------------------

function SummaryStats({ comparison }: { comparison: SessionComparison }) {
  return (
    <Card data-testid="comparison-summary">
      <CardHeader>
        <h3 className="text-sm font-semibold">Summary</h3>
      </CardHeader>
      <CardBody>
        <div className="grid grid-cols-3 gap-4">
          <DiffStat label="Coroutine Count" diff={comparison.coroutineCountDiff} />
          <DiffStat label="Event Count" diff={comparison.eventCountDiff} />
          <DiffStat
            label="Duration"
            diff={comparison.totalDurationDiffNanos}
            formatValue={(v) => formatNanoTime(Math.abs(v))}
          />
        </div>
      </CardBody>
    </Card>
  )
}

interface DiffStatProps {
  label: string
  diff: number
  formatValue?: (value: number) => string
}

function DiffStat({ label, diff, formatValue }: DiffStatProps) {
  const isPositive = diff > 0
  const isNegative = diff < 0
  const isZero = diff === 0
  const displayValue = formatValue ? formatValue(diff) : Math.abs(diff).toString()

  return (
    <div className="text-center" data-testid="diff-stat">
      <div className="text-xs text-default-500 mb-1">{label}</div>
      <div className="flex items-center justify-center gap-1">
        {isPositive && <FiArrowUp className="text-danger" size={14} />}
        {isNegative && <FiArrowDown className="text-success" size={14} />}
        {isZero && <FiMinus className="text-default-400" size={14} />}
        <Chip
          size="sm"
          variant="flat"
          color={isZero ? 'default' : isNegative ? 'success' : 'danger'}
          data-testid="diff-chip"
        >
          {isPositive ? '+' : isNegative ? '-' : ''}{displayValue}
        </Chip>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Unique Coroutines
// ---------------------------------------------------------------------------

function UniqueCoroutines({ comparison }: { comparison: SessionComparison }) {
  const hasUnique = comparison.coroutinesOnlyInA.length > 0 || comparison.coroutinesOnlyInB.length > 0

  if (!hasUnique) return null

  return (
    <Card data-testid="unique-coroutines">
      <CardHeader>
        <h3 className="text-sm font-semibold">Unique Coroutines</h3>
      </CardHeader>
      <CardBody className="space-y-3">
        {comparison.coroutinesOnlyInA.length > 0 && (
          <div>
            <div className="text-xs text-default-500 mb-1">
              Only in Session A ({comparison.coroutinesOnlyInA.length})
            </div>
            <div className="flex flex-wrap gap-1">
              {comparison.coroutinesOnlyInA.map((id) => (
                <Chip key={id} size="sm" variant="flat" color="warning" data-testid="only-in-a">
                  {id}
                </Chip>
              ))}
            </div>
          </div>
        )}
        {comparison.coroutinesOnlyInB.length > 0 && (
          <div>
            <div className="text-xs text-default-500 mb-1">
              Only in Session B ({comparison.coroutinesOnlyInB.length})
            </div>
            <div className="flex flex-wrap gap-1">
              {comparison.coroutinesOnlyInB.map((id) => (
                <Chip key={id} size="sm" variant="flat" color="secondary" data-testid="only-in-b">
                  {id}
                </Chip>
              ))}
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Common Coroutines Table
// ---------------------------------------------------------------------------

function CommonCoroutines({ comparison }: { comparison: SessionComparison }) {
  if (comparison.commonCoroutines.length === 0) return null

  return (
    <Card data-testid="common-coroutines">
      <CardHeader>
        <h3 className="text-sm font-semibold">
          Common Coroutines ({comparison.commonCoroutines.length})
        </h3>
      </CardHeader>
      <CardBody>
        <Table aria-label="Common coroutines comparison" removeWrapper>
          <TableHeader>
            <TableColumn>Coroutine</TableColumn>
            <TableColumn>State A</TableColumn>
            <TableColumn>State B</TableColumn>
            <TableColumn>Events A</TableColumn>
            <TableColumn>Events B</TableColumn>
            <TableColumn>Diff</TableColumn>
          </TableHeader>
          <TableBody>
            {comparison.commonCoroutines.map((c) => (
              <TableRow key={c.coroutineId}>
                <TableCell>
                  <div>
                    <span className="font-mono text-sm">{c.coroutineId}</span>
                    {c.label && (
                      <span className="text-xs text-default-400 ml-2">{c.label}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <StateBadge state={c.stateA} />
                </TableCell>
                <TableCell>
                  <StateBadge state={c.stateB} />
                </TableCell>
                <TableCell>{c.eventCountA}</TableCell>
                <TableCell>{c.eventCountB}</TableCell>
                <TableCell>
                  <EventCountDiff coroutine={c} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardBody>
    </Card>
  )
}

function StateBadge({ state }: { state: string }) {
  const colorMap: Record<string, 'success' | 'primary' | 'warning' | 'danger' | 'default'> = {
    COMPLETED: 'success',
    ACTIVE: 'primary',
    SUSPENDED: 'warning',
    CANCELLED: 'danger',
    FAILED: 'danger',
    CREATED: 'default',
    WAITING_FOR_CHILDREN: 'warning',
  }
  return (
    <Chip size="sm" variant="flat" color={colorMap[state] ?? 'default'} data-testid="state-badge">
      {state}
    </Chip>
  )
}

function EventCountDiff({ coroutine }: { coroutine: CoroutineComparison }) {
  const diff = coroutine.eventCountB - coroutine.eventCountA
  if (diff === 0) {
    return <Chip size="sm" variant="flat" color="default" data-testid="event-diff">0</Chip>
  }
  return (
    <Chip
      size="sm"
      variant="flat"
      color={diff < 0 ? 'success' : 'danger'}
      data-testid="event-diff"
    >
      {diff > 0 ? `+${diff}` : diff}
    </Chip>
  )
}
