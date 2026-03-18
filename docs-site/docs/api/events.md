---
sidebar_position: 1
---

# Event Types

The visualizer captures 50+ event types organized by category. All events share a common base structure and are streamed via SSE.

## Common Event Fields

Every event includes:

| Field | Type | Description |
|---|---|---|
| `id` | `String` | Unique event ID |
| `sessionId` | `String` | Session this event belongs to |
| `timestamp` | `Long` | Epoch milliseconds |
| `type` | `String` | Discriminator for event type |

## Coroutine Events

| Event | Description |
|---|---|
| `CoroutineCreated` | A new coroutine was launched |
| `CoroutineStarted` | Coroutine began execution |
| `CoroutineSuspended` | Coroutine suspended (e.g., `delay`, `await`) |
| `CoroutineResumed` | Coroutine resumed after suspension |
| `CoroutineCompleted` | Coroutine finished successfully |
| `CoroutineFailed` | Coroutine completed with an exception |
| `CoroutineCancelled` | Coroutine was cancelled |
| `CoroutineCancelling` | Cancellation in progress |

## Job Events

| Event | Description |
|---|---|
| `JobCreated` | Job instance created |
| `JobStarted` | Job transitioned to active |
| `JobCompleted` | Job finished normally |
| `JobCancelled` | Job was cancelled |
| `JobFailed` | Job failed with exception |
| `ChildJobAttached` | Child job registered with parent |
| `ChildJobDetached` | Child job removed from parent |

## Flow Events

| Event | Description |
|---|---|
| `FlowCreated` | Flow builder invoked |
| `FlowCollectStarted` | `collect` called on a flow |
| `FlowEmission` | Value emitted from flow |
| `FlowOperatorApplied` | Operator (map, filter, etc.) applied |
| `FlowCompleted` | Flow collection finished |
| `FlowError` | Error during flow collection |
| `StateFlowUpdated` | StateFlow value changed |
| `SharedFlowEmission` | SharedFlow emitted to subscribers |

## Dispatcher Events

| Event | Description |
|---|---|
| `DispatcherSwitch` | Coroutine moved to a different dispatcher |
| `ThreadAssigned` | Coroutine assigned to a specific thread |
| `ThreadReleased` | Thread released after suspension |
| `DispatcherSaturated` | All dispatcher threads are busy |

## Deferred Events

| Event | Description |
|---|---|
| `DeferredCreated` | `async` block created a Deferred |
| `DeferredAwaited` | `await()` called on a Deferred |
| `DeferredResolved` | Deferred completed with a value |
| `DeferredFailed` | Deferred completed with an exception |

## Channel Events

| Event | Description |
|---|---|
| `ChannelCreated` | Channel instance created |
| `ChannelSend` | Value sent to channel |
| `ChannelReceive` | Value received from channel |
| `ChannelClosed` | Channel was closed |
| `ChannelBufferFull` | Send suspended due to full buffer |

## Synchronization Events

| Event | Description |
|---|---|
| `MutexLockAcquired` | Mutex lock obtained |
| `MutexLockReleased` | Mutex lock released |
| `MutexLockQueued` | Coroutine waiting for mutex |
| `SemaphoreAcquired` | Semaphore permit obtained |
| `SemaphoreReleased` | Semaphore permit released |
| `SemaphoreQueued` | Coroutine waiting for permit |
| `SelectStarted` | Select expression began evaluation |
| `SelectClauseRegistered` | Clause registered in select |
| `SelectClauseSelected` | Winning clause resolved |

## Scope Events

| Event | Description |
|---|---|
| `ScopeCreated` | CoroutineScope created |
| `ScopeCompleted` | All children of scope completed |
| `ScopeCancelled` | Scope was cancelled |
| `SupervisorScopeCreated` | SupervisorScope created |
