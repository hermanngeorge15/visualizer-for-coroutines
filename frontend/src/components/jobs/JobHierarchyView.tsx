import { Chip } from '@heroui/react'
import { JobStateBadge } from './JobStateBadge'
import type { JobState } from '@/hooks/use-job-events'

interface JobHierarchyViewProps {
  jobs: JobState[]
  roots: JobState[]
}

function JobNode({ job, jobs, depth }: { job: JobState; jobs: JobState[]; depth: number }) {
  // Find children whose parentCoroutineId matches this job's coroutineId
  const children = jobs.filter((j) => j.parentCoroutineId === job.coroutineId)
  const isBlocked = job.waitingForChildren.length > 0

  return (
    <div className="space-y-1" data-testid="job-tree-node">
      <div
        className="flex items-center gap-2 rounded px-2 py-1 text-xs"
        style={{ marginLeft: `${depth * 20}px` }}
      >
        {depth > 0 && (
          <span className="text-default-300 font-mono">{'|--'}</span>
        )}
        <span className="font-mono font-semibold truncate">
          {job.label || job.jobId}
        </span>
        <JobStateBadge status={job.status} />
        {job.childrenCount > 0 && (
          <Chip size="sm" variant="bordered" color="default">
            {job.childrenCount} children
          </Chip>
        )}
        {isBlocked && (
          <Chip size="sm" variant="flat" color="warning" data-testid="blocking-indicator">
            blocked
          </Chip>
        )}
        {job.cancellationRequested && (
          <Chip size="sm" variant="flat" color="danger">
            cancel requested
          </Chip>
        )}
      </div>
      {children.map((child) => (
        <JobNode key={child.jobId} job={child} jobs={jobs} depth={depth + 1} />
      ))}
    </div>
  )
}

export function JobHierarchyView({ jobs, roots }: JobHierarchyViewProps) {
  if (jobs.length === 0) {
    return (
      <div className="text-xs text-default-400" data-testid="no-hierarchy">
        No job hierarchy to display
      </div>
    )
  }

  return (
    <div className="space-y-1" data-testid="job-hierarchy-view">
      {roots.map((root) => (
        <JobNode key={root.jobId} job={root} jobs={jobs} depth={0} />
      ))}
    </div>
  )
}
