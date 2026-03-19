import { Card, CardBody, CardHeader, Chip } from '@heroui/react'
import { motion, AnimatePresence } from 'framer-motion'
import { fadeSlideIn, scaleIn, staggerContainer, shakeError } from '@/lib/animation-variants'
import { FiCheckCircle, FiXCircle, FiRepeat, FiClock } from 'react-icons/fi'

interface RetryAttempt {
  attemptNumber: number
  delay: number
  success: boolean
  error?: string
}

interface RetryVisualizationProps {
  attempts: RetryAttempt[]
  maxRetries: number
}

/** Maximum width (px) for the longest delay bar in the timeline. */
const MAX_BAR_WIDTH = 320

export function RetryVisualization({ attempts, maxRetries }: RetryVisualizationProps) {
  const maxDelay = Math.max(...attempts.map(a => a.delay), 1)
  const lastAttempt = attempts[attempts.length - 1]
  const succeeded = lastAttempt?.success ?? false
  const remainingRetries = maxRetries - attempts.length

  if (attempts.length === 0) {
    return (
      <Card data-testid="retry-empty">
        <CardBody>
          <div className="py-6 text-center text-default-400">
            No retry attempts recorded yet.
          </div>
        </CardBody>
      </Card>
    )
  }

  return (
    <Card data-testid="retry-visualization">
      <CardHeader className="flex items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <FiRepeat className="h-5 w-5 text-primary" />
          <span className="text-lg font-semibold">Retry with Exponential Backoff</span>
        </div>
        <div className="flex items-center gap-2">
          <Chip size="sm" variant="flat" color="default">
            {attempts.length} / {maxRetries} attempts
          </Chip>
          {remainingRetries > 0 && !succeeded && (
            <Chip size="sm" variant="flat" color="warning">
              {remainingRetries} remaining
            </Chip>
          )}
        </div>
      </CardHeader>

      <CardBody className="pt-0">
        {/* Attempt Timeline */}
        <motion.div
          className="space-y-3"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          data-testid="retry-timeline"
        >
          <AnimatePresence mode="popLayout">
            {attempts.map((attempt) => {
              const barWidth = (attempt.delay / maxDelay) * MAX_BAR_WIDTH

              return (
                <motion.div
                  key={attempt.attemptNumber}
                  className="flex items-center gap-3"
                  variants={attempt.success ? fadeSlideIn : shakeError}
                  initial={attempt.success ? 'hidden' : 'idle'}
                  animate={attempt.success ? 'visible' : 'error'}
                  custom={attempt.attemptNumber}
                  data-testid={`retry-attempt-${attempt.attemptNumber}`}
                >
                  {/* Attempt number badge */}
                  <div className="flex w-8 shrink-0 items-center justify-center">
                    <Chip
                      size="sm"
                      variant="flat"
                      color={attempt.success ? 'success' : 'danger'}
                      classNames={{ content: 'text-xs font-mono' }}
                    >
                      #{attempt.attemptNumber}
                    </Chip>
                  </div>

                  {/* Delay bar (exponential growth visualization) */}
                  <div className="relative flex flex-1 items-center gap-2">
                    <motion.div
                      className={`h-8 rounded-lg flex items-center px-3 ${
                        attempt.success
                          ? 'bg-success/20 border border-success/30'
                          : 'bg-danger/10 border border-danger/20'
                      }`}
                      initial={{ width: 0, opacity: 0 }}
                      animate={{ width: Math.max(barWidth, 48), opacity: 1 }}
                      transition={{
                        duration: 0.5,
                        delay: attempt.attemptNumber * 0.1,
                        ease: 'easeOut',
                      }}
                    >
                      <div className="flex items-center gap-1.5 whitespace-nowrap text-xs">
                        <FiClock className="h-3 w-3 text-default-500" />
                        <span className="font-mono text-default-600">
                          {attempt.delay}ms
                        </span>
                      </div>
                    </motion.div>

                    {/* Status icon */}
                    <motion.div
                      variants={scaleIn}
                      initial="hidden"
                      animate="visible"
                    >
                      {attempt.success ? (
                        <FiCheckCircle className="h-5 w-5 text-success" />
                      ) : (
                        <FiXCircle className="h-5 w-5 text-danger" />
                      )}
                    </motion.div>

                    {/* Error message */}
                    {attempt.error && (
                      <span className="ml-1 truncate text-xs text-danger/80">
                        {attempt.error}
                      </span>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </motion.div>

        {/* Final result indicator */}
        <motion.div
          className={`mt-4 rounded-lg px-4 py-3 text-sm ${
            succeeded
              ? 'bg-success/10 border border-success/30 text-success'
              : 'bg-danger/10 border border-danger/30 text-danger'
          }`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: attempts.length * 0.1 + 0.2 }}
          data-testid="retry-result"
        >
          <div className="flex items-center gap-2">
            {succeeded ? (
              <>
                <FiCheckCircle className="h-4 w-4" />
                <span className="font-semibold">
                  Succeeded on attempt #{lastAttempt!.attemptNumber}
                </span>
              </>
            ) : (
              <>
                <FiXCircle className="h-4 w-4" />
                <span className="font-semibold">
                  All {attempts.length} attempts failed
                  {remainingRetries > 0
                    ? ` (${remainingRetries} retries remaining)`
                    : ' (max retries exhausted)'}
                </span>
              </>
            )}
          </div>
        </motion.div>
      </CardBody>
    </Card>
  )
}
