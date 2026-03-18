# ADR-011: Animation System Design

## Status
Accepted

## Date
2026-03-17

## Context
The visualizer needs consistent, performant animations across tree views, flow diagrams, timeline charts, and state indicators. Currently animations are defined inline in components (e.g., `CoroutineTree.tsx`), leading to duplication and inconsistent timing.

## Decision
Create a centralized animation variants library at `frontend/src/lib/animation-variants.ts` using framer-motion's `Variants` type system.

### Variant Categories
1. **Entrance/Exit** — `fadeSlideIn`, `fadeSlideUp`, `scaleIn` for list items, panels, badges
2. **State indicators** — `pulseActive`, `pulseWaiting`, `shakeError` for coroutine state
3. **Flow/Data** — `flowValue`, `flowValueFiltered`, `rippleEmit` for value particles
4. **Gauges** — `fillGauge`, `gaugeColors` for buffer/permit indicators
5. **Graph** — `pathHighlight`, `deadlockEdge` for SVG paths
6. **Exception** — `exceptionWave` for failure propagation visualization
7. **Stagger** — `staggerContainer`, `staggerFast` for list animations

### Performance Constraints
- Max 50 concurrent framer-motion animations
- Respect `prefers-reduced-motion` media query
- Use `will-change` hints for GPU-accelerated properties only
- Prefer `transform` and `opacity` over `width`/`height` animations

## Rationale
- Centralized variants prevent drift between similar animations
- Named variants make code self-documenting (`animate="active"` vs inline objects)
- framer-motion's variant system handles mount/unmount and orchestration automatically

## Consequences
- All new animations should import from `animation-variants.ts`
- Existing inline animations in `CoroutineTree.tsx` can be migrated incrementally
- Components can compose variants (e.g., combine `fadeSlideIn` entrance with `pulseActive` state)
