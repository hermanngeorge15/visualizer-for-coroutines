import { Card, CardBody, CardHeader, Chip } from '@heroui/react'
import { motion } from 'framer-motion'
import type { JobStateChangedEvent } from '@/types/api'

interface JobStateDisplayProps {
  jobStates: Map<string, JobStateChangedEvent>
}

function JobPropertyTag({ label, value }: { label: string; value: boolean }) {
  return (
    <Chip
      size="sm"
      variant={value ? 'flat' : 'bordered'}
      color={value ? 'success' : 'default'}
      classNames={{
        base: value ? '' : 'opacity-40',
        content: 'text-[10px] font-mono font-semibold'
      }}
    >
      {label}={value.toString()}
    </Chip>
  )
}

export function JobStateDisplay({ jobStates }: JobStateDisplayProps) {
  if (jobStates.size === 0) {
    return (
      <div className="py-8 text-center text-default-400">
        No job state information available yet.
        <div className="mt-2 text-xs">
          Job states are emitted when coroutines have children or when their lifecycle changes.
        </div>
      </div>
    )
  }

  // Calculate statistics
  const stats = {
    total: jobStates.size,
    active: Array.from(jobStates.values()).filter(j => j.isActive).length,
    completed: Array.from(jobStates.values()).filter(j => j.isCompleted).length,
    cancelled: Array.from(jobStates.values()).filter(j => j.isCancelled).length,
    withChildren: Array.from(jobStates.values()).filter(j => j.childrenCount > 0).length,
  }

  return (
    <div className="space-y-4">
      {/* Statistics */}
      <div className="grid grid-cols-5 gap-3">
        <Card shadow="sm">
          <CardBody className="py-3">
            <div className="text-2xl font-bold text-primary">{stats.total}</div>
            <div className="text-xs text-default-500">Total Jobs</div>
          </CardBody>
        </Card>
        <Card shadow="sm">
          <CardBody className="py-3">
            <div className="text-2xl font-bold text-success">{stats.active}</div>
            <div className="text-xs text-default-500">Active</div>
          </CardBody>
        </Card>
        <Card shadow="sm">
          <CardBody className="py-3">
            <div className="text-2xl font-bold text-primary">{stats.completed}</div>
            <div className="text-xs text-default-500">Completed</div>
          </CardBody>
        </Card>
        <Card shadow="sm">
          <CardBody className="py-3">
            <div className="text-2xl font-bold text-warning">{stats.cancelled}</div>
            <div className="text-xs text-default-500">Cancelled</div>
          </CardBody>
        </Card>
        <Card shadow="sm">
          <CardBody className="py-3">
            <div className="text-2xl font-bold text-secondary">{stats.withChildren}</div>
            <div className="text-xs text-default-500">With Children</div>
          </CardBody>
        </Card>
      </div>

      {/* Job Cards */}
      <div className="space-y-3">
        {Array.from(jobStates.values()).map((jobState) => (
        <motion.div
          key={jobState.jobId}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card shadow="sm">
            <CardHeader className="pb-2">
              <div className="flex w-full items-center justify-between">
                <div>
                  <div className="font-semibold">
                    {jobState.label || jobState.jobId}
                  </div>
                  <div className="text-xs text-default-500">
                    Job ID: {jobState.jobId}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Chip
                    size="sm"
                    color={jobState.isActive ? 'success' : 'default'}
                    variant="flat"
                  >
                    {jobState.isActive ? '🟢 Active' : '⚫ Inactive'}
                  </Chip>
                  {jobState.isCompleted && (
                    <Chip size="sm" color="success" variant="flat">
                      ✅ Completed
                    </Chip>
                  )}
                  {jobState.isCancelled && (
                    <Chip size="sm" color="warning" variant="flat">
                      🚫 Cancelled
                    </Chip>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardBody className="pt-0">
              <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                <div>
                  <div className="text-xs text-default-500">Coroutine ID</div>
                  <div className="font-mono text-xs">{jobState.coroutineId}</div>
                </div>
                <div>
                  <div className="text-xs text-default-500">Scope ID</div>
                  <div className="font-mono text-xs">{jobState.scopeId}</div>
                </div>
                {jobState.parentCoroutineId && (
                  <div>
                    <div className="text-xs text-default-500">Parent</div>
                    <div className="font-mono text-xs">{jobState.parentCoroutineId}</div>
                  </div>
                )}
                <div>
                  <div className="text-xs text-default-500">Children Count</div>
                  <div className="font-mono text-xs font-semibold">{jobState.childrenCount}</div>
                </div>
              </div>

              {/* Job Properties */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-default-500 font-mono">Job Properties:</span>
                <JobPropertyTag label="isActive" value={jobState.isActive} />
                <JobPropertyTag label="isCompleted" value={jobState.isCompleted} />
                <JobPropertyTag label="isCancelled" value={jobState.isCancelled} />
              </div>

              {/* Explanation for waiting state */}
              {jobState.isActive && !jobState.isCompleted && jobState.childrenCount > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="rounded-md bg-primary/10 px-3 py-2 text-xs text-primary"
                >
                  <div className="font-semibold mb-1">📘 Job is Active:</div>
                  <div>
                    This job has <span className="font-semibold">{jobState.childrenCount} children</span>. 
                    The coroutine body may have finished, but the Job remains <span className="font-mono font-semibold">isActive=true</span> until 
                    all children complete. This is <span className="font-semibold">structured concurrency</span>!
                  </div>
                </motion.div>
              )}

              {/* Explanation for completed state */}
              {jobState.isCompleted && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="rounded-md bg-success/10 px-3 py-2 text-xs text-success"
                >
                  ✅ Job completed successfully. All children (if any) have finished.
                </motion.div>
              )}

              {/* Explanation for cancelled state */}
              {jobState.isCancelled && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="rounded-md bg-warning/10 px-3 py-2 text-xs text-warning"
                >
                  🚫 Job was cancelled (likely due to structured concurrency propagation).
                </motion.div>
              )}
            </CardBody>
          </Card>
        </motion.div>
        ))}
      </div>
    </div>
  )
}

