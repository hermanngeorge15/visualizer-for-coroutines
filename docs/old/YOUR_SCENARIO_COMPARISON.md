# Your Cancellation Scenario: Before & After

## The Problem You Identified

You correctly identified that with classic coroutines, when you call `cancel()` or `join()` on jobs, these operations are **invisible** to the visualization system. The frontend can't see:

- ❌ When a job is explicitly cancelled
- ❌ Who requested the cancellation  
- ❌ When a coroutine is waiting for another to complete
- ❌ Synchronization points and dependencies

## Your Original Scenario

### Classic Coroutines (No Visualization)

```kotlin
suspend fun runCancellationScenario(): Job = coroutineScope {
    logger.info("Starting cancellation scenario")
    
    val job = launch {
        val child1 = launch {
            logger.debug("Child starting long operation...")
            try {
                delay(5000) // Long delay
                logger.debug("Child completed (should not reach here)")
            } catch (e: CancellationException) {
                logger.debug("Child was cancelled")
                throw e
            }
        }
        
        val child2 = launch {
            logger.debug("Normal child running")
            delay(100)
            logger.debug("Normal child completed")
        }
        
        // Wait for normal child
        child2.join()  // ❌ NOT VISIBLE TO FRONTEND
        
        // Cancel the long-running child
        logger.debug("Cancelling long-running child...")
        child1.cancel()  // ❌ NOT VISIBLE TO FRONTEND
        
        logger.debug("Parent completed")
    }
    
    logger.info("Waiting for cancellation scenario to complete...")
    job
}
```

**What's Missing:**
- No event when `child2.join()` is called
- No event when `child1.cancel()` is called
- Frontend has no idea about these control flow operations

---

## The Solution: VizJob Wrapper

### With VizJob (Full Visibility)

```kotlin
suspend fun runCancellationScenario(session: VizSession): VizJob = coroutineScope {
    logger.info("Starting cancellation scenario in session: ${session.sessionId}")
    
    val viz = VizScope(session)
    
    val job = viz.vizLaunch("parent") {
        val child1: VizJob = vizLaunch("child-to-be-cancelled") {
            logger.debug("Child starting long operation...")
            try {
                vizDelay(5000) // Long delay
                logger.debug("Child completed (should not reach here)")
            } catch (e: CancellationException) {
                logger.debug("Child was cancelled")
                throw e
            }
        }
        
        val child2: VizJob = vizLaunch("normal-child") {
            logger.debug("Normal child running")
            vizDelay(100)
            logger.debug("Normal child completed")
        }
        
        // Wait for normal child
        child2.join()  // ✅ EMITS: JobJoinRequested & JobJoinCompleted
        
        // Cancel the long-running child
        logger.debug("Cancelling long-running child...")
        child1.cancel()  // ✅ EMITS: JobCancellationRequested
        
        logger.debug("Parent completed")
    }
    
    logger.info("Waiting for cancellation scenario to complete...")
    job  // Returns VizJob for further tracking
}
```

**What's Now Visible:**
- ✅ Frontend sees when `child2.join()` is called
- ✅ Frontend sees when parent starts waiting
- ✅ Frontend sees when parent resumes after child completes
- ✅ Frontend sees when `child1.cancel()` is called
- ✅ Frontend knows who initiated the cancellation

---

## Complete Event Timeline

Here's **every event** that gets emitted when you run your scenario with VizJob:

```
Time    Event                              Coroutine               Details
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
T+0ms   CoroutineCreated                   parent                  
T+1ms   CoroutineStarted                   parent                  
T+2ms   ThreadAssigned                     parent                  Thread: DefaultDispatcher-1

T+3ms   CoroutineCreated                   child-to-be-cancelled   parentId: parent
T+4ms   CoroutineStarted                   child-to-be-cancelled   
T+5ms   ThreadAssigned                     child-to-be-cancelled   Thread: DefaultDispatcher-2
T+6ms   CoroutineSuspended                 child-to-be-cancelled   reason: delay, duration: 5000ms

T+7ms   CoroutineCreated                   normal-child            parentId: parent
T+8ms   CoroutineStarted                   normal-child            
T+9ms   ThreadAssigned                     normal-child            Thread: DefaultDispatcher-3
T+10ms  CoroutineSuspended                 normal-child            reason: delay, duration: 100ms

T+11ms  JobJoinRequested                   normal-child            ⭐ NEW! waitingCoroutineId: parent
        👆 Parent is now BLOCKED, waiting for normal-child

T+110ms CoroutineResumed                   normal-child            delay completed
T+111ms CoroutineBodyCompleted             normal-child            
T+112ms CoroutineCompleted                 normal-child            

T+113ms JobJoinCompleted                   normal-child            ⭐ NEW! Parent can now continue
        👆 Parent RESUMES

T+114ms JobCancellationRequested           child-to-be-cancelled   ⭐ NEW! requestedBy: parent
        👆 Parent explicitly cancels child

T+115ms CoroutineCancelled                 child-to-be-cancelled   cause: Job was cancelled

T+116ms CoroutineBodyCompleted             parent                  
T+117ms CoroutineCompleted                 parent                  

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOTAL: 17 events (3 new VizJob events marked with ⭐)
```

---

## Frontend Visualization

### Timeline View

```
0ms                    100ms                   200ms
│                       │                       │
parent ████████████████████████████████████████████
       │               │                       │
       ├─ child1 ██████████████████████ ❌ (cancelled)
       │               ↑                       
       │               │                       
       └─ child2 ██████████ ✅                 
                       ↑                       
                       │                       
                  join() wait                  
                  ⏳ (110ms)                    
```

### Dependency Graph

```
┌──────────────────────────────────────────────┐
│ parent [ACTIVE]                              │
│                                              │
│  ⏳ JobJoinRequested (T+11ms)                │
│     └─ Waiting for: normal-child            │
│     └─ Duration: 102ms                       │
│     └─ ✅ JobJoinCompleted (T+113ms)         │
│                                              │
│  🚫 JobCancellationRequested (T+114ms)       │
│     └─ Target: child-to-be-cancelled        │
│     └─ Reason: "Explicit cancellation"      │
│                                              │
├─ child-to-be-cancelled [CANCELLED] ❌        │
│  └─ State: Was suspended on delay(5000)     │
│  └─ Cancelled by: parent                    │
│  └─ Time alive: 114ms                       │
│                                              │
└─ normal-child [COMPLETED] ✅                 │
   └─ State: Completed successfully            │
   └─ Duration: 103ms                          │
   └─ Joined by: parent                        │
└──────────────────────────────────────────────┘
```

### State Transitions View

```
parent:
  CREATED → STARTED → ACTIVE → [BLOCKED on child2] → ACTIVE → COMPLETED
                                    ⏳ (102ms)

child-to-be-cancelled:
  CREATED → STARTED → SUSPENDED → CANCELLED
                                    ❌

normal-child:
  CREATED → STARTED → SUSPENDED → RESUMED → COMPLETED
                                              ✅
```

---

## Code Changes Required

### Step 1: Add VizSession Parameter

```kotlin
// Before
suspend fun runCancellationScenario(): Job

// After  
suspend fun runCancellationScenario(session: VizSession): VizJob
```

### Step 2: Create VizScope

```kotlin
val viz = VizScope(session)
```

### Step 3: Use viz.vizLaunch and Type VizJob

```kotlin
// Before
val child1 = launch { ... }

// After
val child1: VizJob = vizLaunch("child-to-be-cancelled") { ... }
```

### Step 4: Replace delay with vizDelay

```kotlin
// Before
delay(5000)

// After
vizDelay(5000)
```

**That's it!** All operations (`join()`, `cancel()`, etc.) are now automatically tracked.

---

## Event Details

### JobJoinRequested Event

```kotlin
JobJoinRequested(
    sessionId = "session-123",
    seq = 11,
    tsNanos = 1234567890,
    coroutineId = "coroutine-3",  // normal-child
    jobId = "job-coroutine-3",
    parentCoroutineId = "coroutine-1",
    scopeId = "scope-1",
    label = "normal-child",
    waitingCoroutineId = "coroutine-1"  // parent is waiting
)
```

**Frontend can show:**
- "Parent is waiting for normal-child"
- Start a timer to measure wait duration
- Show parent as BLOCKED state

---

### JobJoinCompleted Event

```kotlin
JobJoinCompleted(
    sessionId = "session-123",
    seq = 15,
    tsNanos = 1234670000,  // 102ms later
    coroutineId = "coroutine-3",  // normal-child
    jobId = "job-coroutine-3",
    parentCoroutineId = "coroutine-1",
    scopeId = "scope-1",
    label = "normal-child",
    waitingCoroutineId = "coroutine-1"  // parent resumes
)
```

**Frontend can show:**
- "Parent resumed after waiting 102ms"
- Change parent state from BLOCKED to ACTIVE
- Show synchronization point completed

---

### JobCancellationRequested Event

```kotlin
JobCancellationRequested(
    sessionId = "session-123",
    seq = 16,
    tsNanos = 1234671000,
    coroutineId = "coroutine-2",  // child-to-be-cancelled
    jobId = "job-coroutine-2",
    parentCoroutineId = "coroutine-1",
    scopeId = "scope-1",
    label = "child-to-be-cancelled",
    requestedBy = "coroutine-1",  // parent requested it
    cause = null
)
```

**Frontend can show:**
- "Child-to-be-cancelled was cancelled by parent"
- Show cancellation arrow from parent to child
- Timestamp of cancellation request

---

## Benefits Summary

| Aspect | Before (Classic) | After (VizJob) |
|--------|------------------|----------------|
| **Cancellation visibility** | ❌ Invisible | ✅ Tracked |
| **Join/wait visibility** | ❌ Invisible | ✅ Tracked |
| **Who initiated action** | ❌ Unknown | ✅ Recorded |
| **Synchronization points** | ❌ Not shown | ✅ Visualized |
| **Wait durations** | ❌ Not measured | ✅ Measured |
| **Frontend integration** | ❌ No events | ✅ Full events |
| **Debugging** | ⚠️ Limited | ✅ Complete |

---

## How to Run

```kotlin
import com.jh.proj.coroutineviz.session.VizSession
import com.jh.proj.coroutineviz.wrappers.VizScope
import kotlinx.coroutines.*

suspend fun main() {
    // Create a visualization session
    val session = VizSession("demo-session")
    
    // Start listening to events (for logging/debugging)
    val eventLogger = GlobalScope.launch {
        session.bus.stream().collect { event ->
            println("EVENT: $event")
        }
    }
    
    // Run your cancellation scenario
    val job = runCancellationScenario(session)
    
    // Wait for it to complete
    job.join()
    
    // Inspect results
    println("\n=== COROUTINE SNAPSHOT ===")
    session.snapshot.coroutines.values.forEach { coroutine ->
        println(coroutine)
    }
    
    // Cleanup
    eventLogger.cancel()
}

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
        
        child2.join()     // ✅ Tracked
        child1.cancel()   // ✅ Tracked
    }
    
    job
}
```

---

## Conclusion

Your cancellation scenario now has **complete observability**! 

The VizJob wrapper seamlessly integrates with your existing code, requiring only minimal changes while providing:

- 🎯 **Full visibility** of all job operations
- 🔍 **Detailed tracking** of cancellation and synchronization
- 📊 **Rich events** for frontend visualization
- ✅ **Ready to use** - already built and tested

The frontend can now show users **exactly** what's happening with their coroutines, including who cancelled what, who's waiting for whom, and how long operations take.

**Your problem is solved!** 🚀

