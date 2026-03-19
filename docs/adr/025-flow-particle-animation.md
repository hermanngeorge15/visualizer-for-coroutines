# ADR-025: Flow Particle Path Animation

**Status:** Accepted
**Date:** 2026-03-19

## Context

The flow visualization only showed operators as static chip lists. There was no visual representation of values moving through the operator chain, making it hard to see how data flows through map, filter, and collect stages.

## Decision

Introduce an SVG-based particle animation view (`FlowParticlePath`) as an alternative to the chip view:

- **SVG layout**: Horizontal path connecting source → operators → collect as circle nodes
- **Particles**: `motion.circle` elements animate along the path for each value trace
- **Filtered values**: Particles shrink and drop below the path (amber color)
- **Transformed values**: Particles change color mid-path (indigo → emerald)
- **Regular values**: Particles flow start-to-end (indigo)

`FlowOperatorChain` gains a `visualMode` prop (`'chips' | 'svg'`). `FlowPanel` provides a toggle button to switch between views.

Three new animation variants added to `animation-variants.ts`: `flowParticle`, `flowParticleFiltered`, `flowParticleTransform` — all using custom props for dynamic positioning.

## Consequences

- Users can visually trace value flow through operators
- Filter operations are immediately visible (particles dropping off)
- Transform operations show the value mutation (color change)
- The chip view remains the default for quick scanning
- SVG view may be heavier for flows with many operators — bounded by showing only the last 8 traces
