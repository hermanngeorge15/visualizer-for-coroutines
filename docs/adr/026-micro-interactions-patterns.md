# ADR-026: Micro-interactions, Pattern Animations, Thread Lanes

**Status:** Accepted
**Date:** 2026-03-19

## Context

The visualizer had only 5 `whileHover` instances across 46 components. Pattern views (Retry, ProducerConsumer, FanOutFanIn) had minimal animation. ThreadLanesView used only CSS transitions with no smooth entrance animations.

## Decision

### Micro-interactions

Add `whileHover` and `whileTap` to interactive elements:
- **Gallery cards**: lift + shadow on hover, press on tap
- **CoroutineTree nodes**: subtle scale 1.01 on hover
- **EventsList cards**: background highlight on hover
- **ChannelTimeline events**: background highlight on hover

New presets in `animation-variants.ts`:
- `hoverLift` — lift + shadow
- `tapPress` — press scale 0.97
- `hoverGlow` — subtle scale 1.01

### Pattern animations

- **RetryVisualization**: failed attempt cards shake via `shakeError` variant
- ProducerConsumerView and FanOutFanInView already have sufficient animation via existing variants

### Thread Lanes

- Convert utilization bar from CSS `transition-all` to `motion.div` with animated width
- Convert segment bars from static divs to `motion.div` with width entrance animation
- Active segments pulse opacity; suspended segments render dimmed

### Stagger presets

New stagger variants for specific contexts:
- `staggerSpawnChildren` (0.03s) — fast for child spawning
- `staggerErrorPropagation` (0.15s) — slower for visual error cascade
- `staggerFlowValues` (0.06s) — medium for flow value traces
- `staggerAdaptive(count)` — reduces delay proportionally to list size

## Consequences

- More responsive feel across all interactive elements
- Failed retry attempts have clear visual feedback (shake)
- Thread lanes animate smoothly on data change
- Stagger presets prevent future duplication of magic numbers
