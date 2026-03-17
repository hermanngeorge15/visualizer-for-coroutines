import { Card, CardBody, Chip } from '@heroui/react'
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
    <div className="space-y-4" data-testid="timing-report">
      {/* Key metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card shadow="sm">
          <CardBody className="py-2">
            <div className="text-lg font-bold text-primary">
              {formatNanos(timing.totalDurationNanos)}
            </div>
            <div className="text-xs text-default-500">Total Duration</div>
          </CardBody>
        </Card>
        <Card shadow="sm">
          <CardBody className="py-2">
            <div className="text-lg font-bold text-secondary">{timing.eventCount}</div>
            <div className="text-xs text-default-500">Events</div>
          </CardBody>
        </Card>
        <Card shadow="sm">
          <CardBody className="py-2">
            <div className="text-lg font-bold text-success">{timing.coroutineCount}</div>
            <div className="text-xs text-default-500">Coroutines</div>
          </CardBody>
        </Card>
        <Card shadow="sm">
          <CardBody className="py-2">
            <div className="text-lg font-bold text-warning">
              {formatNanos(timing.maxGapNanos)}
            </div>
            <div className="text-xs text-default-500">Max Gap</div>
          </CardBody>
        </Card>
      </div>

      {/* Average event interval */}
      <div className="text-xs text-default-500">
        Avg event interval: <span className="font-mono">{formatNanos(timing.avgEventIntervalNanos)}</span>
      </div>

      {/* Latency distribution - horizontal bar chart */}
      {timing.suspendResumeLatencies.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-semibold text-default-600">
            Suspend/Resume Latency Distribution
          </div>
          <div className="space-y-1">
            {timing.suspendResumeLatencies.map((bucket) => {
              const widthPercent = (bucket.count / maxBucketCount) * 100
              return (
                <div
                  key={bucket.label}
                  className="flex items-center gap-2 text-xs"
                  data-testid="latency-bucket"
                >
                  <div className="w-24 text-right text-default-500 shrink-0 font-mono">
                    {bucket.label}
                  </div>
                  <div className="flex-1 h-4 bg-default-100 rounded overflow-hidden">
                    <div
                      className="h-full bg-primary rounded transition-all duration-300"
                      style={{ width: `${widthPercent}%` }}
                    />
                  </div>
                  <Chip size="sm" variant="flat" color="default" className="shrink-0">
                    {bucket.count}
                  </Chip>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
