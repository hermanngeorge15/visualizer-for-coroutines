import { useMemo } from 'react'
import { Card, CardBody, CardHeader, Chip } from '@heroui/react'
import { motion } from 'framer-motion'
import { FiArrowRight, FiPackage, FiCheckCircle, FiBell } from 'react-icons/fi'
import { staggerContainer, fadeSlideIn } from '@/lib/animation-variants'
import { ScenarioPipelineStage } from './ScenarioPipelineStage'
import type { StageStatus } from './ScenarioPipelineStage'
import type { VizEvent, CoroutineEvent } from '@/types/api'

interface OrderProcessingViewProps {
  events: VizEvent[]
}

/**
 * Labels emitted by the backend's Order Processing scenario.
 * The backend uses `ServiceName.methodName` as coroutine labels.
 */
const STAGE_LABELS = {
  root: 'OrderService.processOrder',
  validate: 'OrderValidator.validate',
  inventory: 'InventoryService.checkStock',
  payment: 'PaymentService.processPayment',
  database: 'Database.saveOrder',
  emailNotif: 'EmailService.sendConfirmation',
  smsNotif: 'SmsService.sendSms',
  analyticsNotif: 'AnalyticsService.trackPurchase',
} as const

interface StageInfo {
  status: StageStatus
  duration: number
}

/**
 * Derive the status of a pipeline stage from events.
 *
 * Looks at coroutine lifecycle events matching the given label:
 * - created/started -> active
 * - completed -> completed
 * - failed/cancelled -> failed
 * - no events yet -> pending
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

  // Compute duration from first to last event
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
 * Visual pipeline for the Order Processing scenario.
 *
 * Shows the flow: Validation -> Inventory -> Payment -> Database -> Notifications (parallel)
 *
 * Each stage card shows its status (pending/active/completed/failed) with color coding
 * and animations. The notifications fan out visually as parallel branches.
 */
export function OrderProcessingView({ events }: OrderProcessingViewProps) {
  const stages = useMemo(() => ({
    root: deriveStageStatus(events, STAGE_LABELS.root),
    validate: deriveStageStatus(events, STAGE_LABELS.validate),
    inventory: deriveStageStatus(events, STAGE_LABELS.inventory),
    payment: deriveStageStatus(events, STAGE_LABELS.payment),
    database: deriveStageStatus(events, STAGE_LABELS.database),
    emailNotif: deriveStageStatus(events, STAGE_LABELS.emailNotif),
    smsNotif: deriveStageStatus(events, STAGE_LABELS.smsNotif),
    analyticsNotif: deriveStageStatus(events, STAGE_LABELS.analyticsNotif),
  }), [events])

  // Overall progress
  const allStatuses = [stages.validate, stages.inventory, stages.payment, stages.database, stages.emailNotif, stages.smsNotif, stages.analyticsNotif]
  const completedCount = allStatuses.filter(s => s.status === 'completed').length
  const failedCount = allStatuses.filter(s => s.status === 'failed').length
  const totalStages = allStatuses.length

  return (
    <Card>
      <CardHeader className="flex items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <FiPackage className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-bold">Order Processing Pipeline</h3>
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
            {/* Stage 1: Validation */}
            <motion.div variants={fadeSlideIn} custom={0}>
              <ScenarioPipelineStage
                label="Validate Order"
                status={stages.validate.status}
                duration={stages.validate.duration}
              />
            </motion.div>

            <Arrow />

            {/* Stage 2: Inventory */}
            <motion.div variants={fadeSlideIn} custom={1}>
              <ScenarioPipelineStage
                label="Check Inventory"
                status={stages.inventory.status}
                duration={stages.inventory.duration}
              />
            </motion.div>

            <Arrow />

            {/* Stage 3: Payment */}
            <motion.div variants={fadeSlideIn} custom={2}>
              <ScenarioPipelineStage
                label="Process Payment"
                status={stages.payment.status}
                duration={stages.payment.duration}
              />
            </motion.div>

            <Arrow />

            {/* Stage 4: Database */}
            <motion.div variants={fadeSlideIn} custom={3}>
              <ScenarioPipelineStage
                label="Save to Database"
                status={stages.database.status}
                duration={stages.database.duration}
              />
            </motion.div>
          </div>

          {/* Parallel Notifications fan-out */}
          <div className="flex items-start gap-3 pl-4">
            <div className="flex flex-col items-center gap-1 pt-4">
              <FiBell className="w-4 h-4 text-default-500" />
              <div className="h-full w-px bg-default-300" />
            </div>
            <div className="flex-1">
              <div className="text-xs text-default-500 mb-2 font-semibold uppercase tracking-wider">
                Parallel Notifications
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <motion.div variants={fadeSlideIn} custom={4}>
                  <ScenarioPipelineStage
                    label="Send Email"
                    status={stages.emailNotif.status}
                    duration={stages.emailNotif.duration}
                  />
                </motion.div>
                <motion.div variants={fadeSlideIn} custom={5}>
                  <ScenarioPipelineStage
                    label="Send SMS"
                    status={stages.smsNotif.status}
                    duration={stages.smsNotif.duration}
                  />
                </motion.div>
                <motion.div variants={fadeSlideIn} custom={6}>
                  <ScenarioPipelineStage
                    label="Track Analytics"
                    status={stages.analyticsNotif.status}
                    duration={stages.analyticsNotif.duration}
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
