/**
 * Dispatcher Utility Functions
 * 
 * Color schemes, icons, and helper functions for dispatcher visualization
 */

import { FiCpu, FiLayers, FiZap, FiAlertCircle, FiBox } from 'react-icons/fi'

export type DispatcherColor = 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'default'

/**
 * Get color for a dispatcher based on its name
 */
export function getDispatcherColor(dispatcherName: string | undefined | null): DispatcherColor {
  if (!dispatcherName) return 'default'
  
  const colorMap: Record<string, DispatcherColor> = {
    'Default': 'primary',
    'IO': 'secondary',
    'Main': 'success',
    'Unconfined': 'warning',
    'Test': 'danger',
  }
  
  return colorMap[dispatcherName] || 'default'
}

/**
 * Get Tailwind CSS color classes for dispatcher
 */
export function getDispatcherColorClasses(dispatcherName: string | undefined | null) {
  const color = getDispatcherColor(dispatcherName)
  
  const classMap: Record<DispatcherColor, { bg: string; text: string; border: string }> = {
    primary: { 
      bg: 'bg-primary/10', 
      text: 'text-primary', 
      border: 'border-primary/20' 
    },
    secondary: { 
      bg: 'bg-secondary/10', 
      text: 'text-secondary', 
      border: 'border-secondary/20' 
    },
    success: { 
      bg: 'bg-success/10', 
      text: 'text-success', 
      border: 'border-success/20' 
    },
    warning: { 
      bg: 'bg-warning/10', 
      text: 'text-warning', 
      border: 'border-warning/20' 
    },
    danger: { 
      bg: 'bg-danger/10', 
      text: 'text-danger', 
      border: 'border-danger/20' 
    },
    default: { 
      bg: 'bg-default-100', 
      text: 'text-default-600', 
      border: 'border-default-200' 
    },
  }
  
  return classMap[color]
}

/**
 * Get icon component for a dispatcher
 */
export function getDispatcherIcon(dispatcherName: string | undefined | null): React.ReactNode {
  if (!dispatcherName) return <FiBox className="w-4 h-4" />
  
  const iconMap: Record<string, React.ReactNode> = {
    'Default': <FiCpu className="w-4 h-4" />,
    'IO': <FiLayers className="w-4 h-4" />,
    'Main': <FiZap className="w-4 h-4" />,
    'Unconfined': <FiAlertCircle className="w-4 h-4" />,
  }
  
  return iconMap[dispatcherName] || <FiBox className="w-4 h-4" />
}

/**
 * Get description for a dispatcher
 */
export function getDispatcherDescription(dispatcherName: string): string {
  const descMap: Record<string, string> = {
    'Default': 'CPU-bound work, computational tasks',
    'IO': 'I/O-bound work, network & file operations',
    'Main': 'UI thread, main application thread',
    'Unconfined': 'Runs in caller thread, no thread switching',
  }
  
  return descMap[dispatcherName] || 'Custom dispatcher'
}

/**
 * Get dispatcher badge props for HeroUI Chip component
 */
export function getDispatcherBadgeProps(dispatcherName: string | undefined | null) {
  return {
    color: getDispatcherColor(dispatcherName),
    variant: 'flat' as const,
    size: 'sm' as const,
  }
}

/**
 * Format thread name for display
 */
export function formatThreadName(threadName: string | undefined | null, threadId: number | undefined | null): string {
  if (threadName) return threadName
  if (threadId !== undefined && threadId !== null) return `Thread ${threadId}`
  return 'Unknown thread'
}

/**
 * Get short dispatcher name (for compact display)
 */
export function getShortDispatcherName(dispatcherName: string): string {
  const shortNames: Record<string, string> = {
    'Default': 'DEF',
    'IO': 'I/O',
    'Main': 'MAIN',
    'Unconfined': 'UNC',
  }
  
  return shortNames[dispatcherName] || dispatcherName.substring(0, 3).toUpperCase()
}

