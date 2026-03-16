# VizJob Usage Guide

## Quick Start

The `VizJob` wrapper automatically tracks job operations when you use `VizScope`. Here's how to use it:

## Basic Usage

### 1. Create a VizScope and Launch Coroutines

```kotlin
suspend fun example(session: VizSession) = coroutineScope {
    val viz = VizScope(session)
    
    // vizLaunch now returns VizJob instead of Job
    val job: VizJob = viz.vizLaunch("my-worker") {
        vizDelay(1000)
        println("Work done!")
    }
    
    // All job operations are automatically tracked
    job.join()  // Emits JobJoinRequested and JobJoinCompleted
}
```

### 2. Cancellation Scenario (Your Original Example)

Here's your cancellation scenario with VizJob tracking:

```kotlin
suspend fun runCancellationScenario(session: VizSession): VizJob = coroutineScope {
    val viz = VizScope(session)
    
    val parentJob = viz.vizLaunch("parent") {
        val child1 = vizLaunch("child-to-be-cancelled") {
            try {
                vizDelay(5000) // Long delay
            } catch (e: CancellationException) {
                // This block will execute when cancelled
                throw e
            }
        }
        
        val child2 = vizLaunch("normal-child") {
            vizDelay(100)
        }
        
        // Wait for normal child - TRACKED!
        // Emits: JobJoinRequested, then JobJoinCompleted
        child2.join()
        
        // Cancel the long-running child - TRACKED!
        // Emits: JobCancellationRequested
        child1.cancel()
    }
    
    parentJob  // Return VizJob for further tracking
}
```

### 3. Classic vs VizJob Comparison

**Classic Coroutines (No Tracking):**
```kotlin
suspend fun classicExample() = coroutineScope {
    val job = launch {
        delay(1000)
    }
    job.join()
    job.cancel()
}
// ❌ No visibility into operations
// ❌ No event stream
// ❌ No frontend visualization
```

**With VizJob (Full Tracking):**
```kotlin
suspend fun vizExample(session: VizSession) = coroutineScope {
    val viz = VizScope(session)
    val job = viz.vizLaunch("worker") {
        vizDelay(1000)
    }
    job.join()    // ✅ Tracked
    job.cancel()  // ✅ Tracked
}
// ✅ Complete visibility
// ✅ Event stream for debugging
// ✅ Frontend can visualize everything
```

## Event Flow Examples

### Scenario 1: Cancelling a Child

```kotlin
val viz = VizScope(session)
val parent = viz.vizLaunch("parent") {
    val child = vizLaunch("child") {
        vizDelay(10000)
    }
    
    vizDelay(100)
    child.cancel()  // 🔔 JobCancellationRequested emitted
}
```

**Events Emitted:**
1. `CoroutineCreated` - parent created
2. `CoroutineStarted` - parent starts
3. `CoroutineCreated` - child created
4. `CoroutineStarted` - child starts
5. `CoroutineSuspended` - child suspends on delay
6. `CoroutineSuspended` - parent suspends on delay
7. `CoroutineResumed` - parent resumes after 100ms
8. **`JobCancellationRequested`** - parent requests child cancellation
9. `CoroutineCancelled` - child is cancelled
10. `CoroutineBodyCompleted` - parent body finishes
11. `CoroutineCompleted` - parent completes

### Scenario 2: Waiting for Completion

```kotlin
val viz = VizScope(session)
val parent = viz.vizLaunch("parent") {
    val child = vizLaunch("worker") {
        vizDelay(100)
    }
    
    child.join()  // 🔔 JobJoinRequested → JobJoinCompleted
}
```

**Events Emitted:**
1. `CoroutineCreated` - parent
2. `CoroutineStarted` - parent
3. `CoroutineCreated` - child
4. `CoroutineStarted` - child
5. `CoroutineSuspended` - child suspends
6. **`JobJoinRequested`** - parent starts waiting for child
7. `CoroutineResumed` - child resumes
8. `CoroutineBodyCompleted` - child body done
9. `CoroutineCompleted` - child fully done
10. **`JobJoinCompleted`** - parent resumes from join
11. `CoroutineBodyCompleted` - parent body done
12. `CoroutineCompleted` - parent fully done

### Scenario 3: Exception Propagation

```kotlin
val viz = VizScope(session)
val parent = viz.vizLaunch("parent") {
    val child = vizLaunch("failing-child") {
        throw Exception("Boom!")  // 🔔 CoroutineFailed
    }
    // Parent implicitly waits due to structured concurrency
}
```

**Events Emitted:**
1. `CoroutineCreated` - parent
2. `CoroutineStarted` - parent
3. `CoroutineCreated` - child
4. `CoroutineStarted` - child
5. **`CoroutineFailed`** - child throws exception
6. **`CoroutineCancelled`** - parent cancelled due to child failure

## Advanced Patterns

### Pattern 1: Cancel and Wait

```kotlin
val job = viz.vizLaunch("worker") {
    vizDelay(10000)
}

// Cancel and wait for cleanup to complete
job.cancelAndJoin()  
// Emits: JobCancellationRequested, JobJoinRequested, JobJoinCompleted
```

### Pattern 2: Coordinating Multiple Jobs

```kotlin
val viz = VizScope(session)
val orchestrator = viz.vizLaunch("orchestrator") {
    val jobs = (1..5).map { i ->
        vizLaunch("worker-$i") {
            vizDelay(i * 100L)
        }
    }
    
    // Wait for specific jobs
    jobs[0].join()  // Tracked
    jobs[1].join()  // Tracked
    
    // Cancel remaining
    jobs.drop(2).forEach { it.cancel() }  // Each cancellation tracked
}
```

### Pattern 3: Timeout Handling

```kotlin
val viz = VizScope(session)
val parent = viz.vizLaunch("parent") {
    val slowJob = vizLaunch("slow") {
        vizDelay(5000)
    }
    
    try {
        withTimeout(1000) {
            slowJob.join()
        }
    } catch (e: TimeoutCancellationException) {
        // Timeout occurred
        slowJob.cancel()  // Tracked
    }
}
```

### Pattern 4: Resource Cleanup

```kotlin
val viz = VizScope(session)
val manager = viz.vizLaunch("resource-manager") {
    val resources = (1..3).map { i ->
        vizLaunch("resource-$i") {
            try {
                // Use resource
                vizDelay(Long.MAX_VALUE)
            } finally {
                // Cleanup
                println("Cleaning up resource $i")
            }
        }
    }
    
    // On shutdown
    resources.forEach { it.cancelAndJoin() }  // All tracked
}
```

## API Reference

### VizJob Class

```kotlin
class VizJob : Job {
    // Tracked operations
    fun cancel(cause: CancellationException? = null)
    suspend fun join()
    suspend fun cancelAndJoin(cause: CancellationException? = null)
    
    // Helper
    fun unwrap(): Job
}
```

### New Events

#### 1. JobCancellationRequested
```kotlin
data class JobCancellationRequested(
    val coroutineId: String,
    val jobId: String,
    val requestedBy: String?,  // Who requested cancellation
    val cause: String?
)
```

#### 2. JobJoinRequested
```kotlin
data class JobJoinRequested(
    val coroutineId: String,
    val jobId: String,
    val waitingCoroutineId: String?  // Who is waiting
)
```

#### 3. JobJoinCompleted
```kotlin
data class JobJoinCompleted(
    val coroutineId: String,
    val jobId: String,
    val waitingCoroutineId: String?
)
```

## Frontend Integration

The frontend can visualize these events:

### 1. Cancellation Flow
```
Parent [ACTIVE]
  └─ Child [RUNNING] 
     └─ 🚫 JobCancellationRequested by Parent
        └─ ❌ CoroutineCancelled
```

### 2. Synchronization Points
```
Parent [BLOCKED on Child]
  ├─ ⏳ JobJoinRequested (waiting for Child)
  └─ Child [RUNNING]
        └─ ✅ CoroutineCompleted
           └─ ✅ JobJoinCompleted (Parent resumes)
```

### 3. Exception Propagation
```
Parent [ACTIVE]
  └─ Child [FAILED]
     └─ 💥 CoroutineFailed (Exception)
        └─ 🌊 Parent cancelled (propagation)
```

## Best Practices

### ✅ Do

1. **Always use the VizJob type**
   ```kotlin
   val job: VizJob = viz.vizLaunch("worker") { ... }
   ```

2. **Label your jobs meaningfully**
   ```kotlin
   val fetcher = viz.vizLaunch("api-fetcher") { ... }
   val processor = viz.vizLaunch("data-processor") { ... }
   ```

3. **Use cancelAndJoin for cleanup**
   ```kotlin
   resources.forEach { it.cancelAndJoin() }
   ```

### ❌ Don't

1. **Don't lose the VizJob type**
   ```kotlin
   // Bad - loses tracking
   val job: Job = viz.vizLaunch("worker") { ... }
   ```

2. **Don't use anonymous jobs**
   ```kotlin
   // Bad - hard to track
   viz.vizLaunch { ... }
   ```

3. **Don't unwrap unless necessary**
   ```kotlin
   // Only unwrap for advanced operations
   val rawJob = vizJob.unwrap()
   ```

## Migration Guide

### From Classic to VizJob

**Before:**
```kotlin
suspend fun work() = coroutineScope {
    val job = launch {
        delay(1000)
    }
    job.join()
    job.cancel()
}
```

**After:**
```kotlin
suspend fun work(session: VizSession) = coroutineScope {
    val viz = VizScope(session)
    val job = viz.vizLaunch("worker") {
        vizDelay(1000)
    }
    job.join()    // Now tracked!
    job.cancel()  // Now tracked!
}
```

## Troubleshooting

### Q: Events not appearing on frontend?
**A:** Make sure you're using `VizJob` type (not `Job`) and the session is properly connected.

### Q: Cancellation doesn't emit event?
**A:** Check that you're calling `cancel()` on the `VizJob`, not an unwrapped `Job`.

### Q: Performance impact?
**A:** VizJob adds minimal overhead (one event emission per operation). Events are sent asynchronously.

## Summary

The `VizJob` wrapper provides:

- 🎯 **Automatic tracking** of all job operations
- 🔍 **Complete visibility** into cancellation and synchronization
- 📊 **Event stream** for frontend visualization
- 🎨 **Rich debugging** information
- ✅ **Drop-in replacement** for standard coroutines

Just replace `coroutineScope` with `VizScope` and you get full observability!

