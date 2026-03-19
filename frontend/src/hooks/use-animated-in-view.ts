/**
 * Combines `useInView` (Intersection Observer) with `useAnimationSlot`
 * so that offscreen components skip animations entirely, freeing up
 * animation slots for visible content.
 */
import { useRef } from 'react'
import { useInView } from 'framer-motion'
import { useAnimationSlot } from '@/lib/animation-throttle'

interface UseAnimatedInViewOptions {
  /** Margin around the viewport for triggering. Default: "100px" */
  margin?: `${number}${'px' | '%'}`
  /** Keep the component animated once it has entered the viewport. Default: true */
  once?: boolean
}

/**
 * Returns `{ ref, shouldAnimate }`.
 *
 * Attach `ref` to the outermost DOM element. `shouldAnimate` is true only
 * when the element is (or was) in the viewport AND an animation slot is
 * available. Otherwise the component should render its final state.
 */
export function useAnimatedInView(options: UseAnimatedInViewOptions = {}) {
  const { margin = '100px' as const, once = true } = options
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { margin, once })
  // Only claim an animation slot when the element is in view
  const slotAvailable = useAnimationSlot(isInView)

  return {
    ref,
    shouldAnimate: slotAvailable,
  }
}
