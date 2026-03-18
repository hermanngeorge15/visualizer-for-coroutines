import { motion, AnimatePresence } from 'framer-motion'
import { flowValue, staggerFast } from '@/lib/animation-variants'

interface MailboxMessage {
  messageType: string
  messagePreview: string
  timestamp: number
}

interface ActorMailboxProps {
  messages: MailboxMessage[]
  capacity: number
}

export function ActorMailbox({ messages, capacity }: ActorMailboxProps) {
  const visibleMessages = messages.slice(-10) // Show last 10

  return (
    <div className="space-y-1">
      <div className="text-xs text-default-400 mb-1">
        Mailbox ({messages.length}/{capacity})
      </div>
      <motion.div
        variants={staggerFast}
        initial="hidden"
        animate="visible"
        className="space-y-0.5"
      >
        <AnimatePresence mode="popLayout">
          {visibleMessages.map((msg, i) => (
            <motion.div
              key={`${msg.timestamp}-${i}`}
              variants={flowValue}
              initial="enter"
              animate="animate"
              exit="exit"
              layout
              className="flex items-center gap-2 bg-default-50 rounded px-2 py-1"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
              <span className="text-xs font-mono text-default-600 truncate">
                {msg.messageType}
              </span>
              <span className="text-xs text-default-400 truncate">
                {msg.messagePreview}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>

        {messages.length === 0 && (
          <div className="text-xs text-default-300 text-center py-2">
            Empty
          </div>
        )}
      </motion.div>
    </div>
  )
}
