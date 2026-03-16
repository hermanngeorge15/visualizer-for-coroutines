# VizJob Design Documentation

## Overview

`VizJob` is a wrapper around Kotlin's `Job` that tracks and visualizes job lifecycle operations. It enables the frontend to see when jobs are cancelled, joined, or undergo other state transitions, providing complete visibility into coroutine control flow.

## Architecture

### Core Components

```
┌─────────────────────────────────────────────────────────────┐
│                         VizScope                              │
│  - Creates coroutines with visualization                     │
│  - Returns VizJob instead of Job                             │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           │ returns
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                          VizJob                              │
│  - Wraps underlying Job                                      │
│  - Intercepts operations (cancel, join, etc.)               │
│  - Emits events to VizSession                               │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           │ emits to
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                       VizSession                             │
│  - Receives all events                                       │
│  - Streams to frontend via SSE                              │
│  - Maintains snapshot of state                              │
└─────────────────────────────────────────────────────────────┘
```

## New Events

### 1. JobCancellationRequested

Emitted when `job.cancel()` is explicitly called.

```kotlin
data class JobCancellationRequested(
    val sessionId: String,
    val seq: Long,
    val tsNanos: Long,
    val coroutineId: String,
    val jobId: String,
    val parentCoroutineId: String?,
    val scopeId: String,
    val label: String?,
    val requestedBy: String?,  // Which coroutine requested cancellation
    val cause: String?         // Optional cancellation cause
)
```

**When emitted**: Before the actual cancellation is performed
**Use case**: Track who initiates cancellation and why

### 2. JobJoinRequested

Emitted when `job.join()` is called.

```kotlin
data class JobJoinRequested(
    val sessionId: String,
    val seq: Long,
    val tsNanos: Long,
    val coroutineId: String,
    val jobId: String,
    val parentCoroutineId: String?,
    val scopeId: String,
    val label: String?,
    val waitingCoroutineId: String?  // Which coroutine is waiting
)
```

**When emitted**: Before blocking to wait for job completion
**Use case**: Track synchronization points and waiting patterns

### 3. JobJoinCompleted

Emitted when `job.join()` returns.

```kotlin
data class JobJoinCompleted(
    val sessionId: String,
    val seq: Long,
    val tsNanos: Long,
    val coroutineId: String,
    val jobId: String,
    val parentCoroutineId: String?,
    val scopeId: String,
    val label: String?,
    val waitingCoroutineId: String?
)
```

**When emitted**: After the job completes and join() returns
**Use case**: Track when synchronization completes

## Event Flow Examples

### Scenario 1: Explicit Cancellation

```kotlin
suspend fun example(viz: VizScope) {
    val child = viz.vizLaunch("worker") {
        delay(10000)
    }
    
    delay(100)
    child.cancel()  // Triggers JobCancellationRequested
}
```

**Event sequence:**
1. `CoroutineCreated` - worker created
2. `CoroutineStarted` - worker starts
3. `CoroutineSuspended` - worker suspends on delay
4. `JobCancellationRequested` - parent requests cancellation
5. `CoroutineCancelled` - worker actually cancelled

### Scenario 2: Waiting for Completion

```kotlin
suspend fun example(viz: VizScope) {
    val child = viz.vizLaunch("worker") {
        delay(100)
    }
    
    child.join()  // Triggers JobJoinRequested and JobJoinCompleted
}
```

**Event sequence:**
1. `CoroutineCreated` - worker created
2. `CoroutineStarted` - worker starts
3. `CoroutineSuspended` - worker suspends on delay
4. `JobJoinRequested` - parent starts waiting
5. `CoroutineResumed` - worker resumes
6. `CoroutineBodyCompleted` - worker body finishes
7. `CoroutineCompleted` - worker fully completed
8. `JobJoinCompleted` - parent resumes

### Scenario 3: Child Failure Propagation

```kotlin
suspend fun example(viz: VizScope) {
    val parent = viz.vizLaunch("parent") {
        val child = vizLaunch("child") {
            throw Exception("Boom!")
        }
        // Parent implicitly waits (structured concurrency)
    }
}
```

**Event sequence:**
1. `CoroutineCreated` - parent
2. `CoroutineStarted` - parent
3. `CoroutineCreated` - child
4. `CoroutineStarted` - child
5. `CoroutineFailed` - child throws exception
6. `CoroutineCancelled` - parent cancelled due to child failure
7. Both complete

## VizJob API

### Methods

```kotlin
class VizJob(
    private val job: Job,
    private val session: VizSession,
    private val coroutineId: String,
    private val jobId: String,
    private val parentCoroutineId: String?,
    private val scopeId: String,
    private val label: String?
) : Job by job {
    
    // Intercepted methods (emit events)
    override fun cancel(cause: CancellationException?)
    override suspend fun join()
    suspend fun cancelAndJoin(cause: CancellationException? = null)
    
    // Helper methods
    fun unwrap(): Job  // Get underlying Job
}
```

### Usage Patterns

#### 1. Explicit Cancellation

```kotlin
val viz = VizScope(session)
val job = viz.vizLaunch("worker") {
    // long running work
}

// Later...
job.cancel()  // Emits JobCancellationRequested
```

#### 2. Waiting for Completion

```kotlin
val job1 = viz.vizLaunch("first") { /* ... */ }
val job2 = viz.vizLaunch("second") { /* ... */ }

job1.join()  // Emits JobJoinRequested/Completed
job2.join()  // Emits JobJoinRequested/Completed
```

#### 3. Cancel and Wait

```kotlin
val job = viz.vizLaunch("worker") { /* ... */ }

// Cancel and wait for cleanup
job.cancelAndJoin()  // Emits both cancellation and join events
```

#### 4. Accessing Underlying Job

```kotlin
val vizJob = viz.vizLaunch("worker") { /* ... */ }

// For advanced operations
val rawJob: Job = vizJob.unwrap()
rawJob.invokeOnCompletion { /* ... */ }
```

## Implementation Details

### Delegation Pattern

`VizJob` uses Kotlin's delegation (`Job by job`) to automatically delegate all `Job` interface methods to the underlying job, only overriding the methods we want to track:

```kotlin
class VizJob(...) : Job by job {
    override fun cancel(cause: CancellationException?) {
        // Emit event
        emitCancellationRequested()
        // Delegate to underlying job
        job.cancel(cause)
    }
}
```

### Event Emission Challenges

Some operations like `cancel()` are not suspend functions, but `session.sent()` is. Solution:

```kotlin
override fun cancel(cause: CancellationException?) {
    // Launch in GlobalScope to emit event
    GlobalScope.launch {
        session.sent(JobCancellationRequested(...))
    }
    
    // Perform cancellation immediately
    job.cancel(cause)
}
```

**Note**: The event emission happens asynchronously, but the actual cancellation is immediate. Events might arrive slightly out of order, but this is acceptable for visualization purposes.

### Context Propagation

VizJob tracks which coroutine performs operations:

```kotlin
override suspend fun join() {
    // Get the calling coroutine's context
    val callerElement = currentCoroutineContext()[VizCoroutineElement]
    
    session.sent(
        JobJoinRequested(
            waitingCoroutineId = callerElement?.coroutineId  // Track waiter
        )
    )
    
    job.join()
}
```

## Frontend Integration

### Event Handling

The frontend receives these events via SSE and can:

1. **Visualize cancellation requests**
   - Show who cancelled whom
   - Display cancellation causes
   - Highlight cancellation propagation

2. **Track synchronization points**
   - Show which coroutines are waiting
   - Display wait durations
   - Visualize dependency graphs

3. **Analyze timing**
   - Measure time between join requested and completed
   - Track cancellation response times
   - Identify blocking patterns

### Example Visualization

```
Parent Coroutine
├─ Child-1 [RUNNING]
│  └─ [JobJoinRequested by Parent] ⏳ waiting...
├─ Child-2 [CANCELLED]
│  └─ [JobCancellationRequested by Parent] ❌
└─ [BLOCKED on Child-1]
```

## Comparison: Classic vs VizJob

### Classic Coroutines (No Visualization)

```kotlin
suspend fun classic() = coroutineScope {
    val child = launch {
        delay(1000)
    }
    child.join()
    child.cancel()
}
```

**Limitations:**
- ❌ No visibility into when cancel() is called
- ❌ No tracking of who calls join()
- ❌ Can't see synchronization points
- ❌ No event stream for debugging

### With VizJob

```kotlin
suspend fun withViz(session: VizSession) = coroutineScope {
    val viz = VizScope(session)
    val child: VizJob = viz.vizLaunch("child") {
        vizDelay(1000)
    }
    child.join()    // Tracked
    child.cancel()  // Tracked
}
```

**Benefits:**
- ✅ Full visibility of all operations
- ✅ Track caller context
- ✅ Event stream for frontend
- ✅ Timing information
- ✅ Synchronization analysis

## Best Practices

### 1. Always Use VizJob Return Type

```kotlin
// Good
suspend fun myFunction(viz: VizScope): VizJob {
    return viz.vizLaunch("work") { /* ... */ }
}

// Bad - loses tracking
suspend fun myFunction(viz: VizScope): Job {
    return viz.vizLaunch("work") { /* ... */ }
}
```

### 2. Label Your Jobs

```kotlin
// Good - clear labels for debugging
val fetcher = viz.vizLaunch("api-fetcher") { /* ... */ }
val processor = viz.vizLaunch("data-processor") { /* ... */ }

// Bad - anonymous jobs are hard to track
val job1 = viz.vizLaunch { /* ... */ }
val job2 = viz.vizLaunch { /* ... */ }
```

### 3. Use cancelAndJoin for Cleanup

```kotlin
// Good - clean cancellation and wait
resources.forEach { it.cancelAndJoin() }

// Less ideal - manual coordination
resources.forEach { it.cancel() }
resources.forEach { it.join() }
```

### 4. Track Important Operations

```kotlin
// Good - explicit tracking of important sync points
logger.info("Waiting for workers...")
workers.forEach { it.join() }
logger.info("All workers completed")

// The VizJob will emit events showing this coordination
```

## Future Enhancements

### Potential Additions

1. **JobStateChanged Event**
   - Track Job state transitions (New → Active → Completing → Completed)
   
2. **JobChildAttached Event**
   - Track when new children are added to a job
   
3. **JobExceptionHandled Event**
   - Track exception handler invocations

4. **Async/Await Support**
   - Wrap `Deferred<T>` similar to how we wrap Job
   - Track `await()` operations

5. **Flow Integration**
   - Track Flow collection and cancellation
   - Visualize backpressure

## Testing

### Unit Tests

```kotlin
@Test
fun `VizJob emits cancellation event`() = runTest {
    val session = VizSession("test")
    val events = mutableListOf<VizEvent>()
    
    launch {
        session.bus.stream().collect { events.add(it) }
    }
    
    val viz = VizScope(session)
    val job = viz.vizLaunch("test") {
        delay(1000)
    }
    
    job.cancel()
    delay(100)
    
    assertTrue(events.any { it is JobCancellationRequested })
}
```

## Conclusion

`VizJob` provides essential visibility into job lifecycle operations, enabling:

- 🎯 **Complete observability** of coroutine control flow
- 🔍 **Debugging support** through detailed event tracking
- 📊 **Performance analysis** via timing information
- 🎨 **Rich visualization** on the frontend

By wrapping Job operations, we maintain the familiar coroutine API while adding powerful tracking capabilities for development and debugging.

