import { Chip } from '@heroui/react'
import type { CoroutineState } from '@/types/api'

interface StateIndicatorProps {
  state: CoroutineState | string
  size?: 'sm' | 'md' | 'lg'
}

export function StateIndicator({ state, size = 'sm' }: StateIndicatorProps) {
  const config = getStateConfig(state)

  return (
    <Chip
      color={config.color}
      size={size}
      variant="flat"
      startContent={
        <span className="relative flex h-2 w-2">
          {config.animated && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-75" />
          )}
          <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
        </span>
      }
    >
      {state}
    </Chip>
  )
}

function getStateConfig(state: string) {
  switch (state) {
    case 'CREATED':
      return { color: 'default' as const, animated: false }
    case 'ACTIVE':
      return { color: 'primary' as const, animated: true }
    case 'SUSPENDED':
      return { color: 'secondary' as const, animated: false }
    case 'WAITING_FOR_CHILDREN':
      return { color: 'primary' as const, animated: true }
    case 'COMPLETED':
      return { color: 'success' as const, animated: false }
    case 'CANCELLED':
      return { color: 'warning' as const, animated: false }
    case 'FAILED':
      return { color: 'danger' as const, animated: false }
    default:
      return { color: 'default' as const, animated: false }
  }
}

