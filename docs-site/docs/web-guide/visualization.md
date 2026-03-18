---
sidebar_position: 3
---

# Visualization

The visualization dashboard is the core of the Coroutine Visualizer. It provides multiple synchronized views of coroutine execution.

## Tree View

The tree view displays coroutine hierarchy as a collapsible tree structure.

- **Nodes** represent individual coroutines
- **Colors** indicate state: green (active), blue (suspended), gray (completed), red (cancelled/failed)
- **Click** a node to select it and highlight it across all views
- **Expand/collapse** to focus on specific subtrees

## Graph View

An alternative layout showing coroutines as a directed graph with edges representing parent-child and dependency relationships.

- **Zoom** and **pan** to navigate large graphs
- **Edge labels** show relationship type (child, dependency, channel)
- **Animated edges** indicate active communication

## Timeline

A horizontal timeline showing events as they occurred.

- **Events** are plotted chronologically on the x-axis
- **Coroutines** are grouped on the y-axis
- **Hover** over an event to see its details
- **Zoom** into specific time ranges

## Thread Lanes

Thread lanes show which dispatcher threads are executing which coroutines over time.

- **Each lane** represents a thread (e.g., `DefaultDispatcher-worker-1`)
- **Colored bars** show when a coroutine is executing on that thread
- **Gaps** indicate suspension points
- **Overlapping bars** across lanes show parallel execution

## Flow Panel

Visible when flow operators are used in the scenario.

- **Operator chain** shown as a vertical pipeline
- **Emissions** animate through the chain
- **Counts** show how many items passed through each operator
- **Backpressure** indicators when applicable

## Channel Panel

Visible when channels are used.

- **Buffer state** shown as a gauge (current size / capacity)
- **Send/receive** operations shown as animated arrows
- **Closed** state clearly indicated

## Sync Panel

Visible when Mutex, Semaphore, or Select are used.

- **Mutex** — Shows lock holder and waiting queue
- **Semaphore** — Shows available permits and waiters
- **Select** — Shows competing clauses and which one won
