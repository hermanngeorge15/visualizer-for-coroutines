---
sidebar_position: 1
slug: /
---

# Kotlin Coroutine Visualizer

Real-time visualization of Kotlin coroutine execution, flow operators, synchronization primitives, and structured concurrency.

## What is it?

The Kotlin Coroutine Visualizer is a developer tool that instruments your coroutine code and renders interactive visualizations of what happens at runtime. It helps you understand coroutine lifecycles, dispatcher scheduling, flow emissions, and concurrency patterns.

## Key Features

- **Coroutine Tree** — Hierarchical view of parent-child coroutine relationships with real-time state updates
- **Thread Lane Timeline** — See which coroutines run on which threads, when they suspend, and when they resume
- **Flow & Channel Panels** — Visualize flow operator chains, emissions, and channel send/receive operations
- **Synchronization Primitives** — Monitor Mutex locks, Semaphore permits, and Select clauses
- **Validation Engine** — 20+ built-in rules that detect anti-patterns like leaked coroutines or mutex deadlocks
- **Event Sourcing** — Every coroutine event is captured, stored, and replayable
- **IntelliJ Plugin** — View visualizations directly in your IDE

## How it works

1. Wrap your coroutine code with instrumentation wrappers (`VizScope`, `InstrumentedFlow`, etc.)
2. The backend captures 50+ event types via an `EventBus`
3. Events stream to the frontend (or IntelliJ plugin) over SSE
4. The UI renders interactive tree, graph, timeline, and panel visualizations

<!-- TODO: Add screenshot of the main visualization dashboard -->

## Quick Links

- [Installation](getting-started/installation) — Get up and running
- [Quick Start](getting-started/quick-start) — Run your first visualization
- [Architecture](advanced/architecture) — Understand the system design
