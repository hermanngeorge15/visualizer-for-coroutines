/**
 * Shared framer-motion animation variants for the Coroutine Visualizer.
 *
 * These variants provide consistent animations across all visualization panels.
 * Pattern reference: CoroutineTree.tsx pulse and shake animations.
 */
import type { Variants, Transition } from 'framer-motion'

// ---------------------------------------------------------------------------
// Entrance / Exit
// ---------------------------------------------------------------------------

/** Fade in with a slight slide from the left. Good for list items and cards. */
export const fadeSlideIn: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: (depth: number = 0) => ({
    opacity: 1,
    x: 0,
    transition: { delay: depth * 0.05, duration: 0.3, ease: 'easeOut' },
  }),
  exit: { opacity: 0, x: -10, transition: { duration: 0.2 } },
}

/** Fade in with a slight slide from below. Good for panels and modals. */
export const fadeSlideUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: 'easeOut' },
  },
  exit: { opacity: 0, y: 8, transition: { duration: 0.2 } },
}

/** Scale-in from nothing. Good for badges, chips, and indicators. */
export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { type: 'spring', stiffness: 300, damping: 20 },
  },
  exit: { opacity: 0, scale: 0.8, transition: { duration: 0.15 } },
}

// ---------------------------------------------------------------------------
// State indicators
// ---------------------------------------------------------------------------

/** Pulsing glow for active/running states (e.g. ACTIVE coroutines). */
export const pulseActive: Variants = {
  idle: {},
  active: {
    boxShadow: [
      '0 0 0 0 rgba(99, 102, 241, 0)',
      '0 0 0 4px rgba(99, 102, 241, 0.15)',
      '0 0 0 0 rgba(99, 102, 241, 0)',
    ],
    transition: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' },
  },
}

/** Slow amber pulse for SUSPENDED coroutines (waiting on external). */
export const pulseSuspended: Variants = {
  idle: {},
  suspended: {
    boxShadow: [
      '0 0 0 0 rgba(245, 158, 11, 0)',
      '0 0 0 4px rgba(245, 158, 11, 0.1)',
      '0 0 0 0 rgba(245, 158, 11, 0)',
    ],
    transition: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
  },
}

/** Medium purple pulse for WAITING_FOR_CHILDREN (structured concurrency). */
export const pulseWaitingForChildren: Variants = {
  idle: {},
  waiting: {
    boxShadow: [
      '0 0 0 0 rgba(168, 85, 247, 0)',
      '0 0 0 4px rgba(168, 85, 247, 0.12)',
      '0 0 0 0 rgba(168, 85, 247, 0)',
    ],
    transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
  },
}

/** One-shot fade-to-rest for COMPLETED coroutines. */
export const fadeCompleted: Variants = {
  idle: { opacity: 1 },
  completed: {
    opacity: [1, 0.7, 1],
    transition: { duration: 0.8, ease: 'easeOut' },
  },
}

/** Quick shake for FAILED states — red flash attention. */
export const shakeError: Variants = {
  idle: { scale: 1 },
  error: {
    scale: [1, 1.02, 0.98, 1],
    transition: { duration: 0.5, repeat: 2, ease: 'easeInOut' },
  },
}

/** Dim + strikethrough effect for CANCELLED coroutines. */
export const dimCancelled: Variants = {
  idle: { opacity: 1 },
  cancelled: {
    opacity: 0.5,
    transition: { duration: 0.4, ease: 'easeOut' },
  },
}

/**
 * Returns the appropriate framer-motion variant + animate key for a given
 * coroutine state. Returns null for states with no animation (CREATED).
 */
export function getStateVariant(
  state: string
): { variants: Variants; initial: string; animate: string } | null {
  switch (state) {
    case 'ACTIVE':
      return { variants: pulseActive, initial: 'idle', animate: 'active' }
    case 'SUSPENDED':
      return { variants: pulseSuspended, initial: 'idle', animate: 'suspended' }
    case 'WAITING_FOR_CHILDREN':
      return { variants: pulseWaitingForChildren, initial: 'idle', animate: 'waiting' }
    case 'COMPLETED':
      return { variants: fadeCompleted, initial: 'idle', animate: 'completed' }
    case 'CANCELLED':
      return { variants: dimCancelled, initial: 'idle', animate: 'cancelled' }
    case 'FAILED':
      return { variants: shakeError, initial: 'idle', animate: 'error' }
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// Flow / Data animations
// ---------------------------------------------------------------------------

/** Animate a value "particle" flowing through an operator chain. */
export const flowValue: Variants = {
  enter: { opacity: 0, x: -24, scale: 0.6 },
  animate: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 200, damping: 18 },
  },
  exit: { opacity: 0, x: 24, scale: 0.6, transition: { duration: 0.2 } },
}

/** Filtered-out value: shrinks and turns red before disappearing. */
export const flowValueFiltered: Variants = {
  enter: { opacity: 1, scale: 1 },
  filtered: {
    opacity: 0,
    scale: 0.4,
    y: 8,
    transition: { duration: 0.3, ease: 'easeIn' },
  },
}

/** Ripple effect for SharedFlow emissions. */
export const rippleEmit: Variants = {
  idle: { scale: 1, opacity: 1 },
  emit: {
    scale: [1, 1.15, 1],
    opacity: [1, 0.7, 1],
    transition: { duration: 0.4, ease: 'easeOut' },
  },
}

// ---------------------------------------------------------------------------
// Gauges & Bars
// ---------------------------------------------------------------------------

/** Fill-gauge animation for buffer/permit indicators (0→100%). */
export const fillGauge = {
  /** Returns a motion style for a gauge at the given percentage (0-1). */
  style: (percent: number) => ({
    width: `${Math.min(percent * 100, 100)}%`,
    transition: { duration: 0.5, ease: 'easeOut' } as Transition,
  }),
}

/** Color interpolation stops for gauge severity. */
export const gaugeColors = {
  /** Returns a Tailwind background class based on fill percentage. */
  bg: (percent: number): string => {
    if (percent < 0.5) return 'bg-success'
    if (percent < 0.8) return 'bg-warning'
    return 'bg-danger'
  },
}

// ---------------------------------------------------------------------------
// Graph / Path animations
// ---------------------------------------------------------------------------

/** SVG path highlight — draws a stroke along the path. */
export const pathHighlight: Variants = {
  hidden: { pathLength: 0, opacity: 0 },
  visible: {
    pathLength: 1,
    opacity: 1,
    transition: { duration: 0.8, ease: 'easeInOut' },
  },
}

/** Red pulsing path for deadlock cycle edges. */
export const deadlockEdge: Variants = {
  idle: { stroke: '#ef4444', strokeOpacity: 0.3 },
  alert: {
    strokeOpacity: [0.3, 1, 0.3],
    strokeWidth: [2, 3.5, 2],
    transition: { duration: 1.2, repeat: Infinity, ease: 'easeInOut' },
  },
}

// ---------------------------------------------------------------------------
// Exception propagation
// ---------------------------------------------------------------------------

/** Red wave traveling up the coroutine hierarchy. */
export const exceptionWave: Variants = {
  idle: { backgroundColor: 'transparent' },
  propagate: (delay: number = 0) => ({
    backgroundColor: [
      'rgba(239, 68, 68, 0)',
      'rgba(239, 68, 68, 0.15)',
      'rgba(239, 68, 68, 0)',
    ],
    transition: { delay, duration: 0.6, ease: 'easeOut' },
  }),
}

// ---------------------------------------------------------------------------
// Stagger containers
// ---------------------------------------------------------------------------

/** Stagger children with a configurable delay between each. */
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
}

/** Faster stagger for event lists. */
export const staggerFast: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.02 },
  },
}

// ---------------------------------------------------------------------------
// Utility transitions
// ---------------------------------------------------------------------------

export const springTransition: Transition = {
  type: 'spring',
  stiffness: 300,
  damping: 25,
}

export const smoothTransition: Transition = {
  duration: 0.3,
  ease: 'easeInOut',
}
