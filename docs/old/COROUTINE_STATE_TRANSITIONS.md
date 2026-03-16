# Coroutine State Transitions in VizScope

This document explains the enhanced coroutine state model that properly visualizes structured concurrency behavior.

## State Diagram

```
CREATED → ACTIVE → [SUSPENDED ⇄ ACTIVE]* → WAITING_FOR_CHILDREN → COMPLETED
                                          ↘ CANCELLED
                                          ↘ FAILED
```

## States Explained

### 1. **CREATED**
- **When**: Immediately when `vizLaunch()` is called
- **Event**: `CoroutineCreated`
- **Meaning**: The coroutine has been created but not yet started execution

### 2. **ACTIVE**
- **When**: When the coroutine begins executing its body
- **Event**: `CoroutineStarted`
- **Meaning**: The coroutine is actively running code
- **Visual**: Primary color with rotating animation

### 3. **SUSPENDED**
- **When**: When the coroutine suspends (e.g., `vizDelay()`)
- **Event**: `CoroutineSuspended`
- **Meaning**: The coroutine is paused, waiting for something (delay, I/O, etc.)
- **Visual**: Secondary color, paused state
- **Note**: Can transition back to ACTIVE when resumed

### 4. **WAITING_FOR_CHILDREN** ⭐ NEW
- **When**: When the coroutine's own code finishes, but it has child coroutines still running
- **Event**: `CoroutineBodyCompleted`
- **Meaning**: The coroutine's body has completed, but due to **structured concurrency**, it must wait for all children to complete before it can truly finish
- **Visual**: Primary color with slower pulsing animation
- **Key Insight**: This state visualizes the "hidden" waiting period in structured concurrency

### 5. **COMPLETED**
- **When**: When the coroutine AND all its children have successfully finished
- **Event**: `CoroutineCompleted`
- **Meaning**: Complete success - everything is done
- **Visual**: Success/green color

### 6. **CANCELLED**
- **When**: When the coroutine is cancelled (by parent, explicitly, or due to child failure)
- **Event**: `CoroutineCancelled`
- **Meaning**: The coroutine was stopped before normal completion
- **Visual**: Warning/yellow color

### 7. **FAILED**
- **When**: When the coroutine throws an uncaught exception
- **Event**: `CoroutineFailed`
- **Meaning**: The coroutine encountered an error
- **Visual**: Danger/red color

## Structured Concurrency Behavior

### Scenario 1: Normal Completion
```
Parent: CREATED → ACTIVE → WAITING_FOR_CHILDREN → COMPLETED
  Child1: CREATED → ACTIVE → COMPLETED
  Child2: CREATED → ACTIVE → COMPLETED
```

The parent enters `WAITING_FOR_CHILDREN` after its body finishes but before Child1 and Child2 complete.

### Scenario 2: Child Failure Propagation
```
Parent: CREATED → ACTIVE → WAITING_FOR_CHILDREN → CANCELLED
  Child1: CREATED → ACTIVE → COMPLETED
  Child2: CREATED → ACTIVE → FAILED → propagates to parent
```

When Child2 fails:
1. Child2 enters `FAILED` state
2. The exception propagates to Parent (structured concurrency)
3. Parent transitions from `WAITING_FOR_CHILDREN` to `CANCELLED`
4. Child1 (if still running) also gets `CANCELLED`

This demonstrates how **one child failure cancels the entire coroutine family** (when using regular `Job`, not `SupervisorJob`).

### Scenario 3: Parent Body Failure
```
Parent: CREATED → ACTIVE → FAILED
  Child1: (never created or immediately cancelled)
  Child2: (never created or immediately cancelled)
```

If the parent's own code throws an exception, it goes directly from `ACTIVE` to `FAILED`, and children are cancelled immediately.

## Technical Implementation

### Two Events for Completion

We distinguish between:

1. **`CoroutineBodyCompleted`**: Body code finished (but children may still be running)
   - Emitted right after the `block()` completes
   - Transitions to `WAITING_FOR_CHILDREN` state

2. **`CoroutineCompleted`**: Job completed (including all children)
   - Emitted in `job.invokeOnCompletion { }` when `cause == null`
   - Transitions to `COMPLETED` state

### Cancellation Detection

The implementation uses `invokeOnCompletion` to detect when a child failure causes parent cancellation:

```kotlin
job.invokeOnCompletion { cause ->
    when {
        cause == null -> emit(CoroutineCompleted)
        cause is CancellationException && !bodyTerminalEventEmitted ->
            emit(CoroutineCancelled) // Child caused cancellation!
    }
}
```

## Configuration: Job vs SupervisorJob

By default, `VizScope` uses a regular `Job()`:

```kotlin
VizScope(session, context = Dispatchers.Default + Job())
```

**With regular Job**: Child failures cancel parent and siblings (demonstrated above)

**With SupervisorJob**: Each child is independent:
```kotlin
VizScope(session, context = Dispatchers.Default + SupervisorJob())
```

With `SupervisorJob`, children can fail without affecting siblings or parent.

## Frontend Visualization

The frontend visualizes these states with:

- **ACTIVE**: Fast rotating spinner, bright primary color
- **WAITING_FOR_CHILDREN**: Slower pulsing clock icon, slightly dimmed primary color
- **SUSPENDED**: Pause icon, secondary color
- **COMPLETED**: Checkmark, green
- **CANCELLED**: X icon, yellow
- **FAILED**: Alert icon, red

## Why This Matters

Without the `WAITING_FOR_CHILDREN` state, the visualization would show:
- ❌ Parent appears "done" while children are still running
- ❌ Confusing when parent suddenly becomes "cancelled" after appearing done
- ❌ Doesn't show the power of structured concurrency

With `WAITING_FOR_CHILDREN`:
- ✅ Clearly shows parent is still active, waiting for children
- ✅ Makes cancellation propagation obvious
- ✅ Demonstrates structured concurrency visually
- ✅ Educational - shows the "hidden" waiting period

## Example Sequence

```kotlin
viz.vizLaunch("parent") {
    println("Parent starts")
    
    vizLaunch("child-1") {
        vizDelay(1000)
        println("Child 1 done")
    }
    
    vizLaunch("child-2") {
        vizDelay(2000)
        println("Child 2 done")
    }
    
    println("Parent body done - but still waiting!")
    // Parent is now in WAITING_FOR_CHILDREN
}
// Parent becomes COMPLETED only after both children finish
```

**Events emitted**:
1. Parent: `CoroutineCreated` → CREATED
2. Parent: `CoroutineStarted` → ACTIVE
3. Child-1: `CoroutineCreated` → CREATED
4. Child-1: `CoroutineStarted` → ACTIVE
5. Child-2: `CoroutineCreated` → CREATED
6. Child-2: `CoroutineStarted` → ACTIVE
7. Child-1: `CoroutineCompleted` → COMPLETED
8. Parent: `CoroutineBodyCompleted` → WAITING_FOR_CHILDREN ⭐
9. Child-2: `CoroutineCompleted` → COMPLETED
10. Parent: `CoroutineCompleted` → COMPLETED ✅

Note how event #8 shows the parent entering the waiting state!

