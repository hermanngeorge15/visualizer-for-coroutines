import { useMemo } from 'react'
import { Card, CardBody, CardHeader, Chip } from '@heroui/react'
import { motion } from 'framer-motion'
import { FiArrowRight, FiUser, FiCheckCircle, FiGitBranch, FiBell } from 'react-icons/fi'
import { staggerContainer, fadeSlideIn } from '@/lib/animation-variants'
import { ScenarioPipelineStage } from './ScenarioPipelineStage'
import type { StageStatus } from './ScenarioPipelineStage'
import type { VizEvent, CoroutineEvent } from '@/types/api'

interface RegistrationFlowViewProps {
  events: VizEvent[]
}

/**
 * Labels emitted by the backend's User Registration scenario.
 */
const STAGE_LABELS = {
  root: 'UserService.register',
  validate: 'InputValidator.validateUserData',
  dbCheck: 'UserRepository.checkExists',
  createUser: 'UserRepository.createUser',
  profile: 'ProfileService.createProfile',
  settings: 'SettingsService.createDefaults',
  avatar: 'AvatarService.generateDefault',
  email: 'EmailService.sendWelcome',
  slack: 'SlackService.notifyTeam',
  analytics: 'AnalyticsService.trackSignup',
} as const

interface StageInfo {
  status: StageStatus
  duration: number
}

/**
 * Derive the status of a pipeline stage from events matching the given label.
 */
function deriveStageStatus(events: VizEvent[], label: string): StageInfo {
  const stageEvents = events.filter(
    e => (e as CoroutineEvent).label === label
  )

  if (stageEvents.length === 0) {
    return { status: 'pending', duration: 0 }
  }

  const hasFailed = stageEvents.some(
    e => e.kind?.includes('failed') || e.kind?.includes('cancelled') ||
         e.kind === 'CoroutineFailed' || e.kind === 'CoroutineCancelled'
  )
  const hasCompleted = stageEvents.some(
    e => e.kind?.includes('completed') ||
         e.kind === 'CoroutineCompleted'
  )
  const hasStarted = stageEvents.some(
    e => e.kind?.includes('started') || e.kind?.includes('created') ||
         e.kind === 'CoroutineStarted' || e.kind === 'CoroutineCreated'
  )

  const timestamps = stageEvents.map(e => e.tsNanos).filter(Boolean)
  const duration = timestamps.length >= 2
    ? Math.max(...timestamps) - Math.min(...timestamps)
    : 0

  if (hasFailed) return { status: 'failed', duration }
  if (hasCompleted) return { status: 'completed', duration }
  if (hasStarted) return { status: 'active', duration }

  return { status: 'pending', duration: 0 }
}

/**
 * Visual pipeline for the User Registration scenario.
 *
 * Shows the flow:
 *   Validate -> DB Check -> Create User -> [Profile | Settings | Avatar] -> Notifications
 *
 * The parallel setup phase is shown as branching lanes. Notifications also
 * fan out visually as parallel branches.
 */
export function RegistrationFlowView({ events }: RegistrationFlowViewProps) {
  const stages = useMemo(() => ({
    root: deriveStageStatus(events, STAGE_LABELS.root),
    validate: deriveStageStatus(events, STAGE_LABELS.validate),
    dbCheck: deriveStageStatus(events, STAGE_LABELS.dbCheck),
    createUser: deriveStageStatus(events, STAGE_LABELS.createUser),
    profile: deriveStageStatus(events, STAGE_LABELS.profile),
    settings: deriveStageStatus(events, STAGE_LABELS.settings),
    avatar: deriveStageStatus(events, STAGE_LABELS.avatar),
    email: deriveStageStatus(events, STAGE_LABELS.email),
    slack: deriveStageStatus(events, STAGE_LABELS.slack),
    analytics: deriveStageStatus(events, STAGE_LABELS.analytics),
  }), [events])

  // Overall progress
  const allStatuses = [
    stages.validate, stages.dbCheck, stages.createUser,
    stages.profile, stages.settings, stages.avatar,
    stages.email, stages.slack, stages.analytics,
  ]
  const completedCount = allStatuses.filter(s => s.status === 'completed').length
  const failedCount = allStatuses.filter(s => s.status === 'failed').length
  const totalStages = allStatuses.length

  return (
    <Card>
      <CardHeader className="flex items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <FiUser className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-bold">User Registration Pipeline</h3>
        </div>
        <div className="flex items-center gap-2">
          {failedCount > 0 ? (
            <Chip color="danger" variant="flat" size="sm">
              {failedCount} failed
            </Chip>
          ) : completedCount === totalStages ? (
            <Chip color="success" variant="flat" size="sm" startContent={<FiCheckCircle className="w-3 h-3" />}>
              All stages complete
            </Chip>
          ) : (
            <Chip color="primary" variant="flat" size="sm">
              {completedCount}/{totalStages} stages
            </Chip>
          )}
        </div>
      </CardHeader>
      <CardBody className="pt-0">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="flex flex-col gap-4"
        >
          {/* Sequential pipeline stages */}
          <div className="flex items-center gap-3 overflow-x-auto pb-2">
            {/* Stage 1: Validate */}
            <motion.div variants={fadeSlideIn} custom={0}>
              <ScenarioPipelineStage
                label="Validate Input"
                status={stages.validate.status}
                duration={stages.validate.duration}
              />
            </motion.div>

            <Arrow />

            {/* Stage 2: DB Check */}
            <motion.div variants={fadeSlideIn} custom={1}>
              <ScenarioPipelineStage
                label="Check DB"
                status={stages.dbCheck.status}
                duration={stages.dbCheck.duration}
              />
            </motion.div>

            <Arrow />

            {/* Stage 3: Create User */}
            <motion.div variants={fadeSlideIn} custom={2}>
              <ScenarioPipelineStage
                label="Create User"
                status={stages.createUser.status}
                duration={stages.createUser.duration}
              />
            </motion.div>
          </div>

          {/* Parallel Setup phase (branching lanes) */}
          <div className="flex items-start gap-3 pl-4">
            <div className="flex flex-col items-center gap-1 pt-4">
              <FiGitBranch className="w-4 h-4 text-secondary" />
              <div className="h-full w-px bg-secondary-300" />
            </div>
            <div className="flex-1">
              <div className="text-xs text-secondary-600 mb-2 font-semibold uppercase tracking-wider">
                Parallel Setup
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <motion.div variants={fadeSlideIn} custom={3}>
                  <ScenarioPipelineStage
                    label="Create Profile"
                    status={stages.profile.status}
                    duration={stages.profile.duration}
                  />
                </motion.div>
                <motion.div variants={fadeSlideIn} custom={4}>
                  <ScenarioPipelineStage
                    label="Default Settings"
                    status={stages.settings.status}
                    duration={stages.settings.duration}
                  />
                </motion.div>
                <motion.div variants={fadeSlideIn} custom={5}>
                  <ScenarioPipelineStage
                    label="Generate Avatar"
                    status={stages.avatar.status}
                    duration={stages.avatar.duration}
                  />
                </motion.div>
              </div>
            </div>
          </div>

          {/* Parallel Notifications fan-out */}
          <div className="flex items-start gap-3 pl-4">
            <div className="flex flex-col items-center gap-1 pt-4">
              <FiBell className="w-4 h-4 text-default-500" />
              <div className="h-full w-px bg-default-300" />
            </div>
            <div className="flex-1">
              <div className="text-xs text-default-500 mb-2 font-semibold uppercase tracking-wider">
                Notifications
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <motion.div variants={fadeSlideIn} custom={6}>
                  <ScenarioPipelineStage
                    label="Welcome Email"
                    status={stages.email.status}
                    duration={stages.email.duration}
                  />
                </motion.div>
                <motion.div variants={fadeSlideIn} custom={7}>
                  <ScenarioPipelineStage
                    label="Notify Slack"
                    status={stages.slack.status}
                    duration={stages.slack.duration}
                  />
                </motion.div>
                <motion.div variants={fadeSlideIn} custom={8}>
                  <ScenarioPipelineStage
                    label="Track Signup"
                    status={stages.analytics.status}
                    duration={stages.analytics.duration}
                  />
                </motion.div>
              </div>
            </div>
          </div>

          {/* Stage legend */}
          <div className="flex items-center gap-4 pt-2 text-xs text-default-500 border-t border-divider mt-2">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-default-300" /> Pending
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-primary" /> Active
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-success" /> Completed
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-danger" /> Failed
            </span>
          </div>
        </motion.div>
      </CardBody>
    </Card>
  )
}

/** Arrow connector between sequential stages */
function Arrow() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      className="shrink-0"
    >
      <FiArrowRight className="w-5 h-5 text-default-400" />
    </motion.div>
  )
}
