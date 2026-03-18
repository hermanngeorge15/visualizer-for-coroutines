import { Card, CardBody, Chip, Progress } from '@heroui/react'
import { motion } from 'framer-motion'
import { FiUser, FiMail, FiX } from 'react-icons/fi'
import { fadeSlideIn } from '@/lib/animation-variants'
import type { ActorState } from '@/hooks/use-actor-events'

interface ActorCardProps {
  actor: ActorState
  onClick?: () => void
}

export function ActorCard({ actor, onClick }: ActorCardProps) {
  const mailboxPercent = actor.mailboxCapacity > 0
    ? actor.currentMailboxSize / actor.mailboxCapacity
    : 0

  return (
    <motion.div
      variants={fadeSlideIn}
      initial="hidden"
      animate="visible"
      whileHover={{ scale: 1.01 }}
      className="cursor-pointer"
      onClick={onClick}
    >
      <Card shadow="sm" className={actor.isClosed ? 'opacity-60' : ''}>
        <CardBody className="py-3 px-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <FiUser size={16} />
              <span className="font-medium text-sm">
                {actor.name ?? actor.actorId.slice(-8)}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {actor.isClosed ? (
                <Chip size="sm" variant="flat" color="default" startContent={<FiX size={10} />}>
                  Closed
                </Chip>
              ) : (
                <Chip size="sm" variant="flat" color="success">
                  Active
                </Chip>
              )}
            </div>
          </div>

          {/* Mailbox gauge */}
          <div className="mb-2">
            <div className="flex items-center justify-between text-xs text-default-400 mb-1">
              <span className="flex items-center gap-1">
                <FiMail size={10} />
                Mailbox
              </span>
              <span>{actor.currentMailboxSize}/{actor.mailboxCapacity}</span>
            </div>
            <Progress
              size="sm"
              value={mailboxPercent * 100}
              color={mailboxPercent < 0.5 ? 'success' : mailboxPercent < 0.8 ? 'warning' : 'danger'}
            />
          </div>

          {/* Stats */}
          <div className="flex gap-3 text-xs text-default-500">
            <span>Processed: {actor.totalMessagesProcessed}</span>
            {actor.pendingSenders > 0 && (
              <span className="text-warning">Pending: {actor.pendingSenders}</span>
            )}
          </div>

          {/* State preview */}
          {actor.statePreview && (
            <div className="mt-1 text-xs text-default-400 font-mono truncate">
              State: {actor.statePreview}
            </div>
          )}
        </CardBody>
      </Card>
    </motion.div>
  )
}
