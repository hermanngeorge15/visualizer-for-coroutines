import { Chip } from '@heroui/react'
import { motion } from 'framer-motion'
import { JobStateBadge } from './JobStateBadge'
import type { JobState } from '@/hooks/use-job-events'

interface JobHierarchyViewProps {
  jobs: JobState[]
  roots: JobState[]
}

function JobNode({ job, jobs, depth, index }: { job: JobState; jobs: JobState[]; depth: number; index: number }) {
  // Find children whose parentCoroutineId matches this job's coroutineId
  const children = jobs.filter((j) => j.parentCoroutineId === job.coroutineId)
  const isBlocked = job.waitingForChildren.length > 0

  return (
    <motion.div
      className="space-y-1"
      data-testid="job-tree-node"
      initial={{ opacity: 0, x: -15 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: (depth * 0.1) + (index * 0.05) }}
    >
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
      {children.map((child, childIndex) => (
        <JobNode key={child.jobId} job={child} jobs={jobs} depth={depth + 1} index={childIndex} />
      ))}
    </motion.div>
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
      {roots.map((root, index) => (
        <JobNode key={root.jobId} job={root} jobs={jobs} depth={0} index={index} />
      ))}
    </div>
  )
}
