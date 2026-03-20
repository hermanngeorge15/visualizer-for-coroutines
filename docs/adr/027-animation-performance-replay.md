# ADR-027: Animation Performance and Replay Integration

**Status:** Accepted
**Date:** 2026-03-19

## Context

All 366 motion.div instances animate regardless of viewport visibility. The animation throttle uses a fixed `MAX_CONCURRENT = 50` limit with no runtime adaptation. Replay scrubbing jumps between discrete states with no visual interpolation.

## Decision

### Performance: Viewport-aware animations

New `useAnimatedInView` hook combines `useInView` (Intersection Observer) with `useAnimationSlot` so that offscreen components never claim animation slots. Applied to `EventsList` event items, which can number in the hundreds.

### Performance: Adaptive frame-rate throttle

Enhance `animation-throttle.ts` with a `requestAnimationFrame`-based monitor that:
- Measures average FPS every ~60 frames
- Below 30fps: reduces `maxConcurrent` by 5 (floor: 10)
- Above 50fps: increases `maxConcurrent` by 5 (ceiling: 50)

This automatically scales back animations on slower devices.

### Replay: Smooth motion interpolation

New `useReplayMotion` hook wraps the discrete `currentIndex` from the replay system into a framer-motion `MotionValue` with spring interpolation:
- `motionIndex` — smoothly animated index value
- `progress` — 0→1 normalized progress derived from motionIndex
- `futureOpacity` — function returning 0.3 for events past the scrub position

`ReplayController` uses the smooth `progress` motion value for the progress bar, providing fluid scrubbing rather than discrete jumps.

## Consequences

- Events outside the viewport don't consume animation slots
- Animation budget adapts to device performance automatically
- Replay scrubbing feels smooth rather than choppy
- The monitor loop runs via rAF (no timers) and is lightweight
- `useAnimatedInView` can be applied to any list-heavy component
