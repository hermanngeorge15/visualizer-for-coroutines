import { Chip } from '@heroui/react'

interface WaitQueueEntry {
  id: string
  label: string | null
}

interface WaitQueueListProps {
  queue: WaitQueueEntry[]
  title?: string
}

export function WaitQueueList({ queue, title = 'Wait Queue' }: WaitQueueListProps) {
  if (queue.length === 0) {
    return (
      <div className="text-xs text-default-400" data-testid="wait-queue-empty">
        No coroutines waiting
      </div>
    )
  }

  return (
    <div className="space-y-1" data-testid="wait-queue-list">
      <div className="text-xs text-default-500 font-semibold">{title} ({queue.length})</div>
      <div className="space-y-1 max-h-32 overflow-y-auto">
        {queue.map((entry, idx) => (
          <div
            key={`${entry.id}-${idx}`}
            className="flex items-center gap-2 rounded bg-default-50 px-2 py-1 text-xs"
            data-testid="wait-queue-entry"
          >
            <Chip size="sm" variant="flat" color="warning">#{idx + 1}</Chip>
            <span className="font-mono truncate">{entry.label || entry.id}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
