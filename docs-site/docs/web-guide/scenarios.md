---
sidebar_position: 2
---

# Scenarios

Scenarios are pre-built coroutine programs that demonstrate specific concurrency patterns. They are instrumented with visualization wrappers so every coroutine event is captured.

## Built-in Scenarios

The visualizer ships with scenarios organized by category:

### Coroutine Basics
- **Structured Concurrency** — Parent-child relationships, cancellation propagation
- **Launch vs Async** — Fire-and-forget vs deferred results
- **Coroutine Context** — Dispatcher switching, context elements

### Flow Operators
- **Cold Flow** — Basic flow builder with collect
- **Flow Operators Chain** — map, filter, transform, take, zip
- **StateFlow & SharedFlow** — Hot flows with subscribers

### Synchronization
- **Mutex** — Mutual exclusion for shared mutable state
- **Semaphore** — Limiting concurrent access
- **Select Expression** — First-wins selection from multiple suspending operations

### Channels
- **Producer-Consumer** — Channel-based communication
- **Fan-out / Fan-in** — Multiple producers and consumers
- **Actor Pattern** — Message-passing concurrency

### Patterns
- **Supervisor Scope** — Failure isolation
- **Retry with Backoff** — Error handling patterns
- **Timeout** — withTimeout and withTimeoutOrNull

## Running a Scenario

1. Open a session dashboard
2. Select a scenario from the dropdown
3. Click **Run**
4. Watch the visualization update in real time

## Scenario Configuration

Some scenarios accept parameters:

| Parameter | Description |
|---|---|
| `delayMs` | Artificial delay between operations |
| `coroutineCount` | Number of coroutines to launch |
| `failureRate` | Probability of simulated failures |

## Custom Scenarios

You can create your own scenarios using the ScenarioDSL. See [Custom Scenarios](../advanced/custom-scenarios) for details.
