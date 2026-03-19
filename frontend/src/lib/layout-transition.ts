/**
 * Shared spring configuration for tree/graph layout animations.
 *
 * Used with framer-motion's `layout` prop so that node cards and
 * connectors slide smoothly when the tree structure changes
 * (new coroutines added, removed, or reordered).
 */
import type { Transition } from 'framer-motion'

/** Default spring for node position changes. */
export const layoutSpring: Transition = {
  type: 'spring',
  stiffness: 200,
  damping: 25,
  mass: 0.8,
}

/** Faster spring for connector lines that should follow nodes closely. */
export const connectorSpring: Transition = {
  type: 'spring',
  stiffness: 300,
  damping: 30,
  mass: 0.5,
}
