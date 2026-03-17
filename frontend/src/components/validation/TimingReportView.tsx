import { Card, CardBody, Chip } from '@heroui/react'
import { motion } from 'framer-motion'
import type { TimingReport } from '@/types/api'

interface TimingReportViewProps {
  timing: TimingReport
}

function formatNanos(nanos: number): string {
  if (nanos >= 1_000_000_000) {
    return `${(nanos / 1_000_000_000).toFixed(2)}s`
  }
  if (nanos >= 1_000_000) {
    return `${(nanos / 1_000_000).toFixed(2)}ms`
  }
  if (nanos >= 1_000) {
    return `${(nanos / 1_000).toFixed(1)}us`
  }
  return `${nanos}ns`
}

export function TimingReportView({ timing }: TimingReportViewProps) {
  const maxBucketCount = Math.max(1, ...timing.suspendResumeLatencies.map((b) => b.count))

  return (
    <motion.div
      className="space-y-4"
      data-testid="timing-report"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      {/* Key metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { value: formatNanos(timing.totalDurationNanos), label: 'Total Duration', color: 'text-primary' },
          { value: timing.eventCount, label: 'Events', color: 'text-secondary' },
          { value: timing.coroutineCount, label: 'Coroutines', color: 'text-success' },
          { value: formatNanos(timing.maxGapNanos), label: 'Max Gap', color: 'text-warning' },
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25, delay: index * 0.1 }}
          >
            <Card shadow="sm">
              <CardBody className="py-2">
                <div className={`text-lg font-bold ${stat.color}`}>
                  {stat.value}
                </div>
                <div className="text-xs text-default-500">{stat.label}</div>
              </CardBody>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Average event interval */}
      <motion.div
        className="text-xs text-default-500"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.4 }}
      >
        Avg event interval: <span className="font-mono">{formatNanos(timing.avgEventIntervalNanos)}</span>
      </motion.div>

      {/* Latency distribution - horizontal bar chart */}
      {timing.suspendResumeLatencies.length > 0 && (
        <motion.div
          className="space-y-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.5 }}
        >
          <div className="text-sm font-semibold text-default-600">
            Suspend/Resume Latency Distribution
          </div>
          <div className="space-y-1">
            {timing.suspendResumeLatencies.map((bucket, index) => {
              const widthPercent = (bucket.count / maxBucketCount) * 100
              return (
                <motion.div
                  key={bucket.label}
                  className="flex items-center gap-2 text-xs"
                  data-testid="latency-bucket"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: 0.5 + index * 0.05 }}
                >
                  <div className="w-24 text-right text-default-500 shrink-0 font-mono">
                    {bucket.label}
                  </div>
                  <div className="flex-1 h-4 bg-default-100 rounded overflow-hidden">
                    <motion.div
                      className="h-full bg-primary rounded"
                      initial={{ width: 0 }}
                      animate={{ width: `${widthPercent}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut', delay: 0.5 + index * 0.05 }}
                    />
                  </div>
                  <Chip size="sm" variant="flat" color="default" className="shrink-0">
                    {bucket.count}
                  </Chip>
                </motion.div>
              )
            })}
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}
