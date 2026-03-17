import { Card, CardBody, Chip, Divider } from '@heroui/react'
import { useJobEvents } from '@/hooks/use-job-events'
import { JobStateBadge } from './JobStateBadge'
import { WaitingForChildrenCard } from './WaitingForChildrenCard'
import { JobHierarchyView } from './JobHierarchyView'

interface JobPanelProps {
  sessionId: string
}

export function JobPanel({ sessionId }: JobPanelProps) {
  const { jobs, roots, waitingForChildren } = useJobEvents(sessionId)

  if (jobs.length === 0) {
    return (
      <Card className="mt-2">
        <CardBody>
          <div className="text-center text-default-400 py-8" data-testid="jobs-empty">
            <p className="text-lg font-semibold mb-2">No Job Activity</p>
            <p className="text-sm">
              Job state changes and structured concurrency events will appear here.
            </p>
          </div>
        </CardBody>
      </Card>
    )
  }

  const active = jobs.filter((j) => j.isActive).length
  const completed = jobs.filter((j) => j.isCompleted).length
  const cancelled = jobs.filter((j) => j.isCancelled).length

  return (
    <div className="space-y-4 mt-2" data-testid="job-panel">
      {/* Summary */}
      <div className="grid grid-cols-4 gap-3">
        <Card shadow="sm">
          <CardBody className="py-3">
            <div className="text-2xl font-bold text-primary">{jobs.length}</div>
            <div className="text-xs text-default-500">Total Jobs</div>
          </CardBody>
        </Card>
        <Card shadow="sm">
          <CardBody className="py-3">
            <div className="text-2xl font-bold text-success">{active}</div>
            <div className="text-xs text-default-500">Active</div>
          </CardBody>
        </Card>
        <Card shadow="sm">
          <CardBody className="py-3">
            <div className="text-2xl font-bold text-primary">{completed}</div>
            <div className="text-xs text-default-500">Completed</div>
          </CardBody>
        </Card>
        <Card shadow="sm">
          <CardBody className="py-3">
            <div className="text-2xl font-bold text-warning">{cancelled}</div>
            <div className="text-xs text-default-500">Cancelled</div>
          </CardBody>
        </Card>
      </div>

      {/* WaitingForChildren cards */}
      {waitingForChildren.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-default-600">Structured Concurrency</h3>
          {waitingForChildren.map((evt, idx) => (
            <WaitingForChildrenCard key={`${evt.seq}-${idx}`} event={evt} />
          ))}
        </div>
      )}

      <Divider />

      {/* Job hierarchy */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-default-600">Job Hierarchy</h3>
        <Card shadow="sm">
          <CardBody>
            <JobHierarchyView jobs={jobs} roots={roots} />
          </CardBody>
        </Card>
      </div>

      <Divider />

      {/* Individual job detail list */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-default-600">Job Details</h3>
        {jobs.map((job) => (
          <Card key={job.jobId} shadow="sm">
            <CardBody>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="font-semibold text-sm">{job.label || job.jobId}</div>
                  <div className="text-xs text-default-500 font-mono">{job.jobId}</div>
                </div>
                <div className="flex gap-2">
                  <JobStateBadge status={job.status} />
                  {job.childrenCount > 0 && (
                    <Chip size="sm" variant="bordered" color="default">
                      {job.childrenCount} children
                    </Chip>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-default-500">Coroutine: </span>
                  <span className="font-mono">{job.coroutineId}</span>
                </div>
                {job.parentCoroutineId && (
                  <div>
                    <span className="text-default-500">Parent: </span>
                    <span className="font-mono">{job.parentCoroutineId}</span>
                  </div>
                )}
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  )
}
