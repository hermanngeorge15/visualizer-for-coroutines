import { Chip } from '@heroui/react'

interface DispatcherBadgeProps {
  dispatcherName: string
  size?: 'sm' | 'md' | 'lg'
}

export function DispatcherBadge({ dispatcherName, size = 'sm' }: DispatcherBadgeProps) {
  const getDispatcherColor = (name: string) => {
    if (name.includes('Default')) return 'primary'
    if (name.includes('IO')) return 'success'
    if (name.includes('Main')) return 'warning'
    if (name.includes('Unconfined')) return 'danger'
    return 'default'
  }

  const getShortName = (name: string) => {
    // Shorten common dispatcher names
    if (name === 'Dispatchers.Default') return 'Default'
    if (name === 'Dispatchers.IO') return 'IO'
    if (name === 'Dispatchers.Main') return 'Main'
    if (name === 'Dispatchers.Unconfined') return 'Unconfined'
    return name
  }

  return (
    <Chip 
      size={size}
      color={getDispatcherColor(dispatcherName)}
      variant="flat"
      className="font-mono"
    >
      {getShortName(dispatcherName)}
    </Chip>
  )
}

