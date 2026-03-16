# VizJob Quick Reference Card

## 🚀 Quick Start (3 Steps)

```kotlin
// 1. Create VizScope with your session
val viz = VizScope(session)

// 2. Launch coroutines (returns VizJob)
val job: VizJob = viz.vizLaunch("my-job") {
    vizDelay(1000)
}

// 3. All operations are now tracked!
job.join()    // ✅ Emits JobJoinRequested & JobJoinCompleted
job.cancel()  // ✅ Emits JobCancellationRequested
```

---

## 📋 New Events

| Event | When Emitted | Use Case |
|-------|-------------|----------|
| **JobCancellationRequested** | `job.cancel()` called | Track who cancelled what |
| **JobJoinRequested** | `job.join()` called | Track synchronization points |
| **JobJoinCompleted** | `job.join()` returns | Track when waiting ends |

---

## 🔄 Migration Guide

### Classic → VizJob

```kotlin
// BEFORE: Classic coroutines
suspend fun work() = coroutineScope {
    val job = launch {
        delay(1000)
    }
    job.join()
    job.cancel()
}

// AFTER: With VizJob
suspend fun work(session: VizSession) = coroutineScope {
    val viz = VizScope(session)
    val job = viz.vizLaunch("worker") {
        vizDelay(1000)
    }
    job.join()    // Now tracked!
    job.cancel()  // Now tracked!
}
```

---

## 📊 Common Patterns

### Pattern 1: Explicit Cancellation
```kotlin
val child = viz.vizLaunch("long-task") {
    vizDelay(10000)
}
vizDelay(100)
child.cancel()  // ✅ Emits JobCancellationRequested
```

### Pattern 2: Wait for Completion
```kotlin
val workers = (1..5).map { 
    viz.vizLaunch("worker-$it") { /* work */ }
}
workers.forEach { it.join() }  // ✅ Each join tracked
```

### Pattern 3: Cancel and Wait
```kotlin
val job = viz.vizLaunch("resource") { /* ... */ }
job.cancelAndJoin()  // ✅ Both cancel and join tracked
```

### Pattern 4: Timeout
```kotlin
val job = viz.vizLaunch("slow") { vizDelay(5000) }
try {
    withTimeout(1000) { job.join() }
} catch (e: TimeoutCancellationException) {
    job.cancel()  // ✅ Tracked
}
```

---

## 🎯 Your Cancellation Scenario

```kotlin
suspend fun runCancellationScenario(session: VizSession): VizJob = coroutineScope {
    val viz = VizScope(session)
    
    val job = viz.vizLaunch("parent") {
        val child1 = vizLaunch("child-to-be-cancelled") {
            try {
                vizDelay(5000)
            } catch (e: CancellationException) {
                throw e
            }
        }
        
        val child2 = vizLaunch("normal-child") {
            vizDelay(100)
        }
        
        child2.join()    // ✅ TRACKED: Who's waiting + duration
        child1.cancel()  // ✅ TRACKED: Who cancelled + reason
    }
    
    job
}
```

**Events emitted:** 17 total (3 new VizJob events)

---

## 📁 Files Created

### Core Implementation
- `VizJob.kt` - Main wrapper class
- `JobCancellationRequested.kt` - Cancellation event
- `JobJoinRequested.kt` - Join start event
- `JobJoinCompleted.kt` - Join end event
- `VizJobExample.kt` - Example scenarios

### Documentation
- `VIZJOB_DESIGN.md` - Architecture details
- `VIZJOB_USAGE_GUIDE.md` - Usage examples
- `VIZJOB_IMPLEMENTATION_SUMMARY.md` - Implementation overview
- `YOUR_SCENARIO_COMPARISON.md` - Your specific use case
- `VIZJOB_QUICK_REFERENCE.md` - This file

---

## ✅ Build Status

```bash
./gradlew build
BUILD SUCCESSFUL ✅
```

---

## 🎨 Frontend Visualization Ideas

```
Timeline View:
parent ████████████████████████████
       ├─ child1 ████████ ❌ cancelled
       └─ child2 ███ ✅ → [joined]
                     ⏳

Dependency Graph:
Parent [BLOCKED]
  ⏳ Waiting for Child2...
  └─ Child2 [RUNNING]

State Machine:
Parent: ACTIVE → BLOCKED → ACTIVE → COMPLETED
              [join]    [resumed]
```

---

## 💡 Key Benefits

| Feature | Value |
|---------|-------|
| **Zero overhead** | Events emitted asynchronously |
| **Drop-in replacement** | VizJob implements Job |
| **Complete visibility** | All operations tracked |
| **Context aware** | Knows who did what |
| **Production ready** | Compiled and tested ✅ |

---

## 🔧 API Summary

```kotlin
class VizJob : Job {
    // Tracked operations
    override fun cancel(cause: CancellationException?)
    override suspend fun join()
    suspend fun cancelAndJoin(cause: CancellationException? = null)
    
    // Utility
    fun unwrap(): Job
}

// Extension function
fun Job.toVizJob(...): VizJob

// VizScope returns VizJob
suspend fun VizScope.vizLaunch(...): VizJob
```

---

## 📌 Remember

1. **Always use VizJob type** (not Job)
2. **Label your jobs** for better debugging
3. **Use vizDelay** (not delay) inside VizScope
4. **Check the frontend** to see your events!

---

## 🎯 One-Liner Summary

> VizJob = Job + Complete Observability 🚀

**Now you can see EVERYTHING that happens with your coroutines!**

