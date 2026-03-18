import { Card, CardBody, CardHeader, Divider } from '@heroui/react'
import { motion } from 'framer-motion'
import { FiUsers } from 'react-icons/fi'
import { staggerContainer, fadeSlideIn } from '@/lib/animation-variants'
import { ActorCard } from './ActorCard'
import type { ActorState } from '@/hooks/use-actor-events'

interface ActorPoolViewProps {
  actors: ActorState[]
  onSelectActor?: (actorId: string) => void
}

export function ActorPoolView({ actors, onSelectActor }: ActorPoolViewProps) {
  const activeActors = actors.filter(a => !a.isClosed)
  const closedActors = actors.filter(a => a.isClosed)

  if (actors.length === 0) {
    return (
      <div className="text-center text-default-400 py-8">
        No actors detected in this session.
      </div>
    )
  }

  return (
    <Card>
      <CardHeader className="flex items-center gap-2">
        <FiUsers size={16} />
        <span className="font-semibold">
          Actors ({activeActors.length} active, {closedActors.length} closed)
        </span>
      </CardHeader>
      <Divider />
      <CardBody>
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
        >
          {activeActors.map(actor => (
            <motion.div key={actor.actorId} variants={fadeSlideIn}>
              <ActorCard
                actor={actor}
                onClick={() => onSelectActor?.(actor.actorId)}
              />
            </motion.div>
          ))}
          {closedActors.map(actor => (
            <motion.div key={actor.actorId} variants={fadeSlideIn}>
              <ActorCard actor={actor} />
            </motion.div>
          ))}
        </motion.div>
      </CardBody>
    </Card>
  )
}
