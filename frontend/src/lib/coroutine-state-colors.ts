/**
 * Centralized color configuration for the 7 coroutine states.
 *
 * Color assignments:
 *   CREATED              → slate    (neutral, not yet started)
 *   ACTIVE               → indigo   (energetic, running)
 *   SUSPENDED            → amber    (paused, waiting for external)
 *   WAITING_FOR_CHILDREN → purple   (semi-active, structured concurrency)
 *   COMPLETED            → emerald  (success, finished)
 *   CANCELLED            → gray     (dimmed, stopped)
 *   FAILED               → rose     (error, attention needed)
 *
 * Every component that needs state-dependent visuals should import from here
 * instead of maintaining its own switch/case mapping.
 */
import type { ComponentType } from 'react'
import {
  FiCircle,
  FiPlay,
  FiPause,
  FiClock,
  FiCheckCircle,
  FiXCircle,
  FiAlertCircle,
} from 'react-icons/fi'

// ---- Types ----------------------------------------------------------------

export type StateAnimation =
  | 'none'
  | 'pulse-fast'
  | 'pulse-slow'
  | 'pulse-medium'
  | 'fade-once'
  | 'dim'
  | 'shake'

export interface StateColorConfig {
  /** HeroUI semantic chip color */
  chipColor: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger'
  /** Tailwind text-* class */
  text: string
  /** Tailwind bg-* class for icon circle backgrounds */
  iconBg: string
  /** Tailwind border-* class for card outlines */
  border: string
  /** Tailwind bg-* class for tree connector lines */
  line: string
  /** Tailwind bg-* class for junction/arrow dots */
  arrow: string
  /** Tailwind bg-* class for branch connectors */
  branch: string
  /** rgba color used for boxShadow pulse glow */
  glow: string
  /** Background tint overlay class (e.g. bg-primary/5) */
  bgTint: string
  /** Which animation style to apply */
  animation: StateAnimation
  /** Default icon component for this state */
  Icon: ComponentType<{ className?: string }>
}

// ---- Color map ------------------------------------------------------------

const stateColorMap: Record<string, StateColorConfig> = {
  CREATED: {
    chipColor: 'default',
    text: 'text-default-400',
    iconBg: 'bg-default-100',
    border: 'border-default-300',
    line: 'bg-default-300',
    arrow: 'bg-default-200',
    branch: 'bg-default-300',
    glow: 'rgba(100, 116, 139, 0)',
    bgTint: 'bg-default-50',
    animation: 'none',
    Icon: FiCircle,
  },
  ACTIVE: {
    chipColor: 'primary',
    text: 'text-primary',
    iconBg: 'bg-primary/10',
    border: 'border-primary',
    line: 'bg-primary/40',
    arrow: 'bg-primary/20',
    branch: 'bg-primary/40',
    glow: 'rgba(99, 102, 241, 0.15)',
    bgTint: 'bg-primary/5',
    animation: 'pulse-fast',
    Icon: FiPlay,
  },
  SUSPENDED: {
    chipColor: 'warning',
    text: 'text-warning',
    iconBg: 'bg-warning/10',
    border: 'border-warning',
    line: 'bg-warning/40',
    arrow: 'bg-warning/20',
    branch: 'bg-warning/40',
    glow: 'rgba(245, 158, 11, 0.1)',
    bgTint: 'bg-warning/5',
    animation: 'pulse-slow',
    Icon: FiPause,
  },
  WAITING_FOR_CHILDREN: {
    chipColor: 'secondary',
    text: 'text-secondary',
    iconBg: 'bg-secondary/10',
    border: 'border-secondary/60',
    line: 'bg-secondary/30',
    arrow: 'bg-secondary/15',
    branch: 'bg-secondary/30',
    glow: 'rgba(168, 85, 247, 0.12)',
    bgTint: 'bg-secondary/5',
    animation: 'pulse-medium',
    Icon: FiClock,
  },
  COMPLETED: {
    chipColor: 'success',
    text: 'text-success',
    iconBg: 'bg-success/10',
    border: 'border-success',
    line: 'bg-success/40',
    arrow: 'bg-success/20',
    branch: 'bg-success/40',
    glow: 'rgba(16, 185, 129, 0.1)',
    bgTint: 'bg-success/5',
    animation: 'fade-once',
    Icon: FiCheckCircle,
  },
  CANCELLED: {
    chipColor: 'default',
    text: 'text-default-400',
    iconBg: 'bg-default-100',
    border: 'border-default-300',
    line: 'bg-default-300',
    arrow: 'bg-default-200',
    branch: 'bg-default-300',
    glow: 'rgba(100, 116, 139, 0)',
    bgTint: 'bg-default-50',
    animation: 'dim',
    Icon: FiXCircle,
  },
  FAILED: {
    chipColor: 'danger',
    text: 'text-danger',
    iconBg: 'bg-danger/10',
    border: 'border-danger',
    line: 'bg-danger/40',
    arrow: 'bg-danger/20',
    branch: 'bg-danger/40',
    glow: 'rgba(244, 63, 94, 0.15)',
    bgTint: 'bg-danger/5',
    animation: 'shake',
    Icon: FiAlertCircle,
  },
}

const defaultColors: StateColorConfig = stateColorMap.CREATED!

// ---- Public API -----------------------------------------------------------

/** Get the full color config for a coroutine state string. */
export function getStateColors(state: string): StateColorConfig {
  return stateColorMap[state] ?? defaultColors
}

/** True for states where the coroutine's Job is still active. */
export function isActiveState(state: string): boolean {
  return state === 'ACTIVE' || state === 'WAITING_FOR_CHILDREN'
}

/** True for terminal states (COMPLETED, CANCELLED, FAILED). */
export function isTerminalState(state: string): boolean {
  return state === 'COMPLETED' || state === 'CANCELLED' || state === 'FAILED'
}
