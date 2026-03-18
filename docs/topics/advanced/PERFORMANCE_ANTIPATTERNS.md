# Performance Pitfalls & Anti-Patterns

**Version:** 1.0  
**Date:** December 2025  
**Status:** Design Document

---

## Executive Summary

This document covers common mistakes and anti-patterns in Kotlin coroutines that lead to performance issues, bugs, or crashes. Each anti-pattern includes detection strategies, visualization design, and the correct alternative.

**Goals:**
- Automatically detect anti-patterns during visualization
- Highlight problematic code patterns with warnings
- Show side-by-side comparison of wrong vs right approaches
- Educate developers on best practices

---

## 1. Thread Starvation

### 1.1 The Problem

**Thread starvation** occurs when all threads in a dispatcher are blocked, preventing other coroutines from running.

```kotlin
// ❌ WRONG: Blocking IO on Dispatchers.Default
suspend fun badBlockingCall() = withContext(Dispatchers.Default) {
    // Default has limited threads (CPU cores)
    Thread.sleep(5000)  // BLOCKS THE THREAD!
    readFileBlocking()   // BLOCKS THE THREAD!
}

// ✅ RIGHT: Use Dispatchers.IO for blocking calls
suspend fun goodBlockingCall() = withContext(Dispatchers.IO) {
    // IO has elastic thread pool
    Thread.sleep(5000)  // OK on IO
    readFileBlocking()   // OK on IO
}

// ✅ BEST: Use suspend functions
suspend fun bestNonBlockingCall() {
    delay(5000)  // Suspends, doesn't block
    readFileSuspending()  // Suspends, doesn't block
}
```

### 1.2 Events to Track

```kotlin
sealed class StarvationEvent : VizEvent() {
    
    data class BlockingCallDetected(
        val coroutineId: String,
        val dispatcherName: String,
        val blockingMethod: String,  // "Thread.sleep", "InputStream.read", etc.
        val stackTrace: String,
        val severity: Severity  // WARNING, CRITICAL
    ) : StarvationEvent()
    
    data class DispatcherExhausted(
        val dispatcherName: String,
        val activeThreads: Int,
        val maxThreads: Int,
        val queuedCoroutines: Int,
        val blockedCoroutines: List<String>
    ) : StarvationEvent()
    
    data class StarvationRecovered(
        val dispatcherName: String,
        val starvationDurationMs: Long,
        val affectedCoroutines: Int
    ) : StarvationEvent()
}

enum class Severity { INFO, WARNING, CRITICAL }
```

### 1.3 Visualization Design

```
┌─────────────────────────────────────────────────────────────┐
│  ⚠️  THREAD STARVATION DETECTED: Dispatchers.Default        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Status: 🔴 EXHAUSTED (4/4 threads blocked)                 │
│                                                              │
│  ═══════════════════════════════════════════════════════════ │
│                    THREAD POOL STATUS                        │
│  ═══════════════════════════════════════════════════════════ │
│                                                              │
│  Thread 1: 🔴 BLOCKED by coroutine-3 (Thread.sleep)         │
│            Duration: 4.2s                                    │
│                                                              │
│  Thread 2: 🔴 BLOCKED by coroutine-5 (FileInputStream.read) │
│            Duration: 2.8s                                    │
│                                                              │
│  Thread 3: 🔴 BLOCKED by coroutine-7 (Socket.connect)       │
│            Duration: 1.5s                                    │
│                                                              │
│  Thread 4: 🔴 BLOCKED by coroutine-9 (JDBC call)            │
│            Duration: 0.8s                                    │
│                                                              │
│  ═══════════════════════════════════════════════════════════ │
│                    WAITING COROUTINES (12)                   │
│  ═══════════════════════════════════════════════════════════ │
│                                                              │
│  coroutine-11: waiting 3.5s (compute-task)                  │
│  coroutine-13: waiting 3.2s (data-transform)                │
│  ... 10 more waiting                                         │
│                                                              │
│  ═══════════════════════════════════════════════════════════ │
│  💡 SUGGESTION: Move blocking calls to Dispatchers.IO        │
│  ═══════════════════════════════════════════════════════════ │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 1.4 Test Scenario

```kotlin
@Test
fun `detect thread starvation on Default dispatcher`() = runTest {
    // Exhaust Default dispatcher with blocking calls
    repeat(Runtime.getRuntime().availableProcessors()) {
        vizLaunch("blocking-$it", Dispatchers.Default) {
            Thread.sleep(5000)  // Should trigger warning
        }
    }
    
    // This coroutine should be starved
    val starvedJob = vizLaunch("starved", Dispatchers.Default) {
        // Should not run until blocking calls complete
        computeResult()
    }
    
    advanceTimeBy(1000)
    
    // Verify starvation detected
    val events = recorder.ofKind("DispatcherExhausted")
    assertTrue(events.isNotEmpty())
    assertEquals("Dispatchers.Default", events.first().dispatcherName)
}
```

---

## 2. Blocking the Main Thread

### 2.1 The Problem

**Blocking Main/UI thread** causes UI freezes and ANRs (Application Not Responding) on Android.

```kotlin
// ❌ WRONG: Heavy work on Main
suspend fun badMainThread() = withContext(Dispatchers.Main) {
    val data = loadLargeFile()  // BLOCKS UI!
    parseData(data)              // BLOCKS UI!
    processData(data)            // BLOCKS UI!
}

// ✅ RIGHT: Do work on background, update UI on Main
suspend fun goodMainThread() {
    val data = withContext(Dispatchers.IO) {
        loadLargeFile()
    }
    val parsed = withContext(Dispatchers.Default) {
        parseData(data)
    }
    withContext(Dispatchers.Main) {
        updateUI(parsed)  // Only UI updates on Main
    }
}
```

### 2.2 Events to Track

```kotlin
sealed class MainThreadEvent : VizEvent() {
    
    data class MainThreadBlocked(
        val coroutineId: String,
        val operationDescription: String,
        val durationMs: Long,
        val stackTrace: String,
        val severity: Severity
    ) : MainThreadEvent()
    
    data class LongOperationOnMain(
        val coroutineId: String,
        val operationType: String,  // "computation", "IO", "network"
        val durationMs: Long,
        val recommendation: String
    ) : MainThreadEvent()
    
    data class UIFrameDropped(
        val droppedFrames: Int,
        val causedBy: String,
        val frameDeadlineMs: Long,
        val actualDurationMs: Long
    ) : MainThreadEvent()
}
```

### 2.3 Visualization Design

```
┌─────────────────────────────────────────────────────────────┐
│  🚨 MAIN THREAD BLOCKED                                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ════════════════════════════════════════════════════════   │
│           MAIN THREAD TIMELINE (last 5 seconds)             │
│  ════════════════════════════════════════════════════════   │
│                                                              │
│  Frame:  |16ms|16ms|16ms|         850ms          |16ms|     │
│          ┌───┐┌───┐┌───┐┌─────────────────────────┐┌───┐    │
│  Status: │ ✅ ││ ✅ ││ ✅ ││    🔴 BLOCKED          ││ ✅ │    │
│          └───┘└───┘└───┘└─────────────────────────┘└───┘    │
│                          ▲                                   │
│                          │                                   │
│            loadLargeFile() - 850ms on Main!                 │
│                                                              │
│  ════════════════════════════════════════════════════════   │
│                    IMPACT                                    │
│  ════════════════════════════════════════════════════════   │
│                                                              │
│  ❌ Dropped Frames: 51 (expected 60fps)                      │
│  ❌ UI Freeze Duration: 850ms                                │
│  ❌ User Experience: Severe jank                             │
│                                                              │
│  ════════════════════════════════════════════════════════   │
│  💡 FIX: Move loadLargeFile() to Dispatchers.IO             │
│                                                              │
│  // Before (wrong):                                          │
│  withContext(Dispatchers.Main) { loadLargeFile() }          │
│                                                              │
│  // After (correct):                                         │
│  val data = withContext(Dispatchers.IO) { loadLargeFile() } │
│  withContext(Dispatchers.Main) { updateUI(data) }           │
│  ════════════════════════════════════════════════════════   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Memory Leaks from Unbounded Coroutines

### 3.1 The Problem

**Coroutine leaks** occur when coroutines outlive their intended scope, holding references and consuming resources.

```kotlin
// ❌ WRONG: Coroutine outlives Activity
class LeakyActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        GlobalScope.launch {  // NEVER CANCELLED!
            while (true) {
                updateUI()  // References Activity forever
                delay(1000)
            }
        }
    }
}

// ✅ RIGHT: Use lifecycle-aware scope
class SafeActivity : Activity() {
    private val scope = CoroutineScope(Dispatchers.Main + Job())
    
    override fun onCreate(savedInstanceState: Bundle?) {
        scope.launch {
            while (isActive) {  // Check cancellation
                updateUI()
                delay(1000)
            }
        }
    }
    
    override fun onDestroy() {
        super.onDestroy()
        scope.cancel()  // Cancel all coroutines
    }
}

// ✅ BEST: Use lifecycleScope (Android)
class BestActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        lifecycleScope.launch {
            // Automatically cancelled when Activity destroyed
            while (isActive) {
                updateUI()
                delay(1000)
            }
        }
    }
}
```

### 3.2 Events to Track

```kotlin
sealed class LeakEvent : VizEvent() {
    
    data class GlobalScopeUsage(
        val coroutineId: String,
        val label: String,
        val launchLocation: String,
        val severity: Severity  // Always WARNING or higher
    ) : LeakEvent()
    
    data class LongRunningCoroutine(
        val coroutineId: String,
        val runningTimeMs: Long,
        val parentScope: String,
        val isGlobalScope: Boolean,
        val memoryHeldBytes: Long?
    ) : LeakEvent()
    
    data class OrphanedCoroutine(
        val coroutineId: String,
        val parentScopeDestroyed: Boolean,
        val stillActive: Boolean,
        val recommendation: String
    ) : LeakEvent()
    
    data class CoroutineLeakSummary(
        val leakedCoroutines: Int,
        val totalMemoryHeldBytes: Long,
        val affectedScopes: List<String>
    ) : LeakEvent()
}
```

### 3.3 Visualization Design

```
┌─────────────────────────────────────────────────────────────┐
│  ⚠️  POTENTIAL COROUTINE LEAK                                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ════════════════════════════════════════════════════════   │
│                LEAKED COROUTINES (3)                         │
│  ════════════════════════════════════════════════════════   │
│                                                              │
│  🔴 coroutine-15 "data-sync"                                │
│     Scope: GlobalScope (dangerous!)                          │
│     Running: 15 minutes                                      │
│     Memory: ~2.4 MB held                                     │
│     Location: DataManager.kt:45                              │
│                                                              │
│  🟠 coroutine-23 "location-updates"                         │
│     Scope: Activity (destroyed 5 min ago)                    │
│     Running: 8 minutes                                       │
│     Memory: ~800 KB held                                     │
│     Location: MapFragment.kt:112                             │
│                                                              │
│  🟠 coroutine-31 "websocket-listener"                       │
│     Scope: ViewModel (cleared 2 min ago)                     │
│     Running: 3 minutes                                       │
│     Memory: ~1.2 MB held                                     │
│     Location: ChatViewModel.kt:78                            │
│                                                              │
│  ════════════════════════════════════════════════════════   │
│  TOTAL IMPACT: 4.4 MB leaked, 3 orphaned coroutines         │
│  ════════════════════════════════════════════════════════   │
│                                                              │
│  💡 SUGGESTIONS:                                             │
│  1. Replace GlobalScope with structured scopes               │
│  2. Cancel coroutines in onDestroy()/onCleared()            │
│  3. Use lifecycleScope or viewModelScope                     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Excessive Concurrency

### 4.1 The Problem

**Launching too many coroutines** simultaneously can overwhelm resources and cause OOM errors.

```kotlin
// ❌ WRONG: Unbounded parallelism
suspend fun badParallel(items: List<Item>) {
    items.forEach { item ->
        launch {  // Could be millions of coroutines!
            processItem(item)
        }
    }
}

// ✅ RIGHT: Bounded parallelism with Semaphore
suspend fun goodParallel(items: List<Item>) = coroutineScope {
    val semaphore = Semaphore(10)  // Max 10 concurrent
    items.forEach { item ->
        launch {
            semaphore.withPermit {
                processItem(item)
            }
        }
    }
}

// ✅ BETTER: Use chunked processing
suspend fun betterParallel(items: List<Item>) = coroutineScope {
    items.chunked(100).forEach { chunk ->
        chunk.map { item ->
            async { processItem(item) }
        }.awaitAll()
    }
}
```

### 4.2 Events to Track

```kotlin
sealed class ConcurrencyEvent : VizEvent() {
    
    data class HighCoroutineCount(
        val activeCoroutines: Int,
        val threshold: Int,
        val memoryUsageBytes: Long,
        val topScopes: List<ScopeInfo>
    ) : ConcurrencyEvent()
    
    data class RapidCoroutineCreation(
        val coroutinesPerSecond: Int,
        val threshold: Int,
        val launchLocation: String
    ) : ConcurrencyEvent()
    
    data class CoroutineExplosion(
        val peakCoroutines: Int,
        val durationMs: Long,
        val memoryPeakBytes: Long,
        val affectedDispatcher: String
    ) : ConcurrencyEvent()
    
    data class ConcurrencyStats(
        val currentActive: Int,
        val peakActive: Int,
        val totalCreated: Long,
        val avgLifetimeMs: Double
    ) : ConcurrencyEvent()
}

data class ScopeInfo(
    val scopeName: String,
    val coroutineCount: Int,
    val percentage: Double
)
```

### 4.3 Visualization Design

```
┌─────────────────────────────────────────────────────────────┐
│  🚨 COROUTINE EXPLOSION DETECTED                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Active Coroutines: 15,847 (threshold: 1,000)               │
│  Memory Usage: 847 MB (heap pressure!)                       │
│                                                              │
│  ════════════════════════════════════════════════════════   │
│              COROUTINE COUNT OVER TIME                       │
│  ════════════════════════════════════════════════════════   │
│                                                              │
│  16K │                            ████                       │
│  12K │                       ███████████                     │
│   8K │                  ████████████████                     │
│   4K │             █████████████████████                     │
│   1K │ ─ ─ ─ ─ ─ ─threshold─ ─ ─ ─ ─ ─ ─                    │
│     0│██████████████████████████████████                     │
│      └──────────────────────────────────                     │
│       0s      5s      10s     15s     20s                   │
│                                                              │
│  ════════════════════════════════════════════════════════   │
│                    SOURCE ANALYSIS                           │
│  ════════════════════════════════════════════════════════   │
│                                                              │
│  📍 ItemProcessor.kt:78 - processAll()                       │
│     Creating 100+ coroutines per second                      │
│     Pattern: unbounded forEach { launch { } }               │
│                                                              │
│  ════════════════════════════════════════════════════════   │
│  💡 FIX: Add concurrency limiting                            │
│                                                              │
│  // Add this:                                                │
│  val semaphore = Semaphore(50)                              │
│  items.forEach { launch { semaphore.withPermit { ... } } }  │
│  ════════════════════════════════════════════════════════   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Missing Cooperative Cancellation

### 5.1 The Problem

**Non-cooperative coroutines** don't respond to cancellation, wasting resources and causing delays.

```kotlin
// ❌ WRONG: Long loop without cancellation check
suspend fun badLoop() {
    var i = 0
    while (i < 1_000_000) {
        // No cancellation check!
        heavyComputation(i)
        i++
    }
}

// ✅ RIGHT: Check for cancellation
suspend fun goodLoop() {
    var i = 0
    while (i < 1_000_000) {
        ensureActive()  // Throws if cancelled
        heavyComputation(i)
        i++
    }
}

// ✅ ALSO RIGHT: Use isActive
suspend fun alsoGoodLoop() = coroutineScope {
    var i = 0
    while (isActive && i < 1_000_000) {
        heavyComputation(i)
        i++
    }
}

// ✅ ALSO RIGHT: Yield periodically
suspend fun yieldingLoop() {
    var i = 0
    while (i < 1_000_000) {
        if (i % 1000 == 0) yield()  // Check cancellation every 1000 iterations
        heavyComputation(i)
        i++
    }
}
```

### 5.2 Events to Track

```kotlin
sealed class CancellationEvent : VizEvent() {
    
    data class CancellationIgnored(
        val coroutineId: String,
        val cancellationRequestedAt: Long,
        val stillRunningAfterMs: Long,
        val suspensionPoints: Int,  // 0 = no suspension since cancellation
        val recommendation: String
    ) : CancellationEvent()
    
    data class SlowCancellation(
        val coroutineId: String,
        val cancellationLatencyMs: Long,
        val expectedLatencyMs: Long,
        val blockingOperation: String?
    ) : CancellationEvent()
    
    data class NonCooperativeLoop(
        val coroutineId: String,
        val loopIterations: Long,
        val lastYieldAgo: Long,
        val location: String
    ) : CancellationEvent()
}
```

### 5.3 Visualization Design

```
┌─────────────────────────────────────────────────────────────┐
│  ⚠️  NON-COOPERATIVE COROUTINE                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Coroutine: "data-processor" (coroutine-42)                 │
│                                                              │
│  ════════════════════════════════════════════════════════   │
│                  CANCELLATION TIMELINE                       │
│  ════════════════════════════════════════════════════════   │
│                                                              │
│  Time ──────────────────────────────────────────────────▶   │
│                                                              │
│  0s        │ Started                                        │
│            │                                                │
│  2.5s      │ ⚡ Cancellation requested                       │
│            │                                                │
│            │ ┌──────────────────────────────────────┐       │
│            │ │  Still running... no suspension     │       │
│            │ │  Iterations since cancel: 50,000    │       │
│            │ └──────────────────────────────────────┘       │
│            │                                                │
│  7.8s      │ 🏁 Finally completed (5.3s after cancel!)      │
│                                                              │
│  ════════════════════════════════════════════════════════   │
│  ANALYSIS                                                    │
│  ════════════════════════════════════════════════════════   │
│                                                              │
│  ❌ Cancellation delay: 5.3 seconds (expected: <10ms)       │
│  ❌ Suspension points since cancel: 0                        │
│  ❌ Loop iterations without yield: 50,000+                   │
│                                                              │
│  📍 Location: DataProcessor.kt:156                          │
│     Pattern: while (condition) { /* no ensureActive() */ }  │
│                                                              │
│  ════════════════════════════════════════════════════════   │
│  💡 FIX: Add cancellation check                              │
│                                                              │
│  while (condition) {                                         │
│      ensureActive()  // Add this line                        │
│      processItem()                                           │
│  }                                                           │
│  ════════════════════════════════════════════════════════   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. Improper Exception Handling

### 6.1 The Problem

**Swallowing exceptions** or improper handling leads to silent failures.

```kotlin
// ❌ WRONG: Swallowing all exceptions
launch {
    try {
        riskyOperation()
    } catch (e: Exception) {
        // Silently swallowed!
    }
}

// ❌ WRONG: Catching CancellationException
launch {
    try {
        suspendingOperation()
    } catch (e: Exception) {  // Catches CancellationException too!
        log(e)
    }
}

// ✅ RIGHT: Re-throw CancellationException
launch {
    try {
        suspendingOperation()
    } catch (e: CancellationException) {
        throw e  // Must re-throw!
    } catch (e: Exception) {
        handleError(e)
    }
}

// ✅ BETTER: Use runCatching with care
launch {
    runCatching {
        suspendingOperation()
    }.onFailure { e ->
        if (e is CancellationException) throw e
        handleError(e)
    }
}
```

### 6.2 Events to Track

```kotlin
sealed class ExceptionHandlingEvent : VizEvent() {
    
    data class CancellationExceptionCaught(
        val coroutineId: String,
        val catchLocation: String,
        val wasRethrown: Boolean,
        val severity: Severity
    ) : ExceptionHandlingEvent()
    
    data class SilentExceptionSwallowed(
        val coroutineId: String,
        val exceptionType: String,
        val catchLocation: String,
        val hasLogging: Boolean
    ) : ExceptionHandlingEvent()
    
    data class UnhandledException(
        val coroutineId: String,
        val exceptionType: String,
        val message: String,
        val propagatedTo: String?
    ) : ExceptionHandlingEvent()
}
```

---

## 7. Busy Waiting / Spin Locks

### 7.1 The Problem

**Busy waiting** wastes CPU cycles polling instead of suspending.

```kotlin
// ❌ WRONG: Busy waiting
suspend fun badPolling() {
    while (!dataReady) {
        // Burning CPU cycles!
    }
    processData()
}

// ❌ ALSO WRONG: Short delays still wasteful
suspend fun stillBadPolling() {
    while (!dataReady) {
        delay(1)  // Still polling frequently
    }
    processData()
}

// ✅ RIGHT: Use proper synchronization
suspend fun goodSuspending() {
    dataReadyChannel.receive()  // Suspends until data ready
    processData()
}

// ✅ ALSO RIGHT: Use CompletableDeferred
suspend fun alsoGoodSuspending() {
    val data = dataDeferred.await()  // Suspends until complete
    processData(data)
}
```

### 7.2 Events to Track

```kotlin
sealed class BusyWaitEvent : VizEvent() {
    
    data class BusyWaitDetected(
        val coroutineId: String,
        val loopIterations: Long,
        val cpuTimeMs: Long,
        val condition: String,
        val location: String
    ) : BusyWaitEvent()
    
    data class FrequentPolling(
        val coroutineId: String,
        val pollsPerSecond: Int,
        val avgPollDurationMs: Double,
        val recommendation: String
    ) : BusyWaitEvent()
}
```

---

## 8. runBlocking Misuse

### 8.1 The Problem

**Using runBlocking inappropriately** blocks threads and can cause deadlocks.

```kotlin
// ❌ WRONG: runBlocking in suspend function
suspend fun badRunBlocking() {
    runBlocking {  // Blocks the thread!
        fetchData()
    }
}

// ❌ WRONG: runBlocking on Main thread
fun onButtonClick() {
    runBlocking {  // FREEZES UI!
        fetchData()
    }
}

// ❌ WRONG: runBlocking inside coroutine
launch {
    runBlocking {  // Potential deadlock!
        anotherSuspendFun()
    }
}

// ✅ RIGHT: runBlocking only at top level
fun main() = runBlocking {
    // OK - this is the entry point
    launchApplication()
}

// ✅ RIGHT: Use coroutineScope instead
suspend fun goodCoroutineScope() = coroutineScope {
    fetchData()  // Suspends properly
}
```

### 8.2 Events to Track

```kotlin
sealed class RunBlockingEvent : VizEvent() {
    
    data class RunBlockingInSuspendContext(
        val coroutineId: String,
        val callerDispatcher: String,
        val location: String,
        val severity: Severity
    ) : RunBlockingEvent()
    
    data class RunBlockingOnMainThread(
        val durationMs: Long,
        val location: String,
        val uiImpact: String
    ) : RunBlockingEvent()
    
    data class NestedRunBlocking(
        val outerCoroutineId: String,
        val innerBlockDurationMs: Long,
        val deadlockRisk: Boolean
    ) : RunBlockingEvent()
}
```

---

## 9. Anti-Pattern Detection System

### 9.1 Automatic Detection Rules

```kotlin
class AntiPatternDetector(private val session: VizSession) {
    
    private val rules = listOf(
        // Thread starvation
        Rule("BLOCKING_ON_DEFAULT") {
            detectBlockingCallsOn("Dispatchers.Default")
        },
        
        // Main thread blocking
        Rule("BLOCKING_ON_MAIN") {
            detectBlockingCallsOn("Dispatchers.Main")
        },
        
        // Memory leaks
        Rule("GLOBAL_SCOPE_USAGE") {
            detectGlobalScopeUsage()
        },
        
        // Excessive concurrency
        Rule("COROUTINE_EXPLOSION") {
            coroutineCount > 1000
        },
        
        // Non-cooperative
        Rule("LONG_RUNNING_NO_YIELD") {
            noSuspensionFor > 1000.milliseconds
        },
        
        // Exception handling
        Rule("CANCELLATION_EXCEPTION_CAUGHT") {
            detectCancellationExceptionCaught()
        },
        
        // runBlocking misuse
        Rule("RUN_BLOCKING_IN_COROUTINE") {
            detectRunBlockingInCoroutine()
        }
    )
    
    fun analyze(event: VizEvent): List<Warning> {
        return rules.mapNotNull { rule ->
            if (rule.condition(event)) {
                Warning(rule.name, rule.severity, rule.recommendation)
            } else null
        }
    }
}
```

### 9.2 Warning Levels

| Level | Description | UI Treatment |
|-------|-------------|--------------|
| 🔵 **INFO** | Best practice suggestion | Subtle indicator |
| 🟡 **WARNING** | Potential issue | Yellow highlight |
| 🟠 **ERROR** | Likely bug | Orange badge |
| 🔴 **CRITICAL** | Severe problem | Red alert, modal |

---

## 10. Frontend Components

### 10.1 AntiPatternDashboard

```typescript
interface AntiPatternReport {
  timestamp: number;
  activeWarnings: Warning[];
  historicalPatterns: PatternOccurrence[];
  recommendations: Recommendation[];
}

const AntiPatternDashboard: React.FC<{ report: AntiPatternReport }> = ({ report }) => {
  const criticalCount = report.activeWarnings.filter(w => w.severity === 'CRITICAL').length;
  const warningCount = report.activeWarnings.filter(w => w.severity === 'WARNING').length;
  
  return (
    <Card className="antipattern-dashboard">
      <CardHeader>
        <AlertTriangle className="text-yellow-500" />
        <span>Anti-Pattern Analysis</span>
        <div className="badges">
          {criticalCount > 0 && <Badge variant="destructive">{criticalCount} Critical</Badge>}
          {warningCount > 0 && <Badge variant="warning">{warningCount} Warnings</Badge>}
        </div>
      </CardHeader>
      
      <CardContent>
        {report.activeWarnings.map(warning => (
          <WarningCard key={warning.id} warning={warning} />
        ))}
        
        <Accordion title="Recommendations">
          {report.recommendations.map(rec => (
            <RecommendationItem key={rec.id} recommendation={rec} />
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
};
```

### 10.2 CodeComparison Component

```typescript
interface CodeComparison {
  title: string;
  wrong: CodeSnippet;
  right: CodeSnippet;
  explanation: string;
}

const CodeComparisonView: React.FC<{ comparison: CodeComparison }> = ({ comparison }) => {
  return (
    <div className="code-comparison">
      <h4>{comparison.title}</h4>
      
      <div className="side-by-side">
        <div className="wrong-code">
          <Badge variant="destructive">❌ Wrong</Badge>
          <SyntaxHighlighter language="kotlin">
            {comparison.wrong.code}
          </SyntaxHighlighter>
        </div>
        
        <div className="right-code">
          <Badge variant="success">✅ Right</Badge>
          <SyntaxHighlighter language="kotlin">
            {comparison.right.code}
          </SyntaxHighlighter>
        </div>
      </div>
      
      <p className="explanation">{comparison.explanation}</p>
    </div>
  );
};
```

---

## 11. Summary

### Anti-Patterns Covered

| Anti-Pattern | Risk Level | Detection Method |
|--------------|------------|------------------|
| Thread Starvation | 🔴 Critical | Blocking call detection on limited dispatchers |
| Main Thread Blocking | 🔴 Critical | Long operations on Main |
| Memory Leaks | 🟠 High | GlobalScope usage, orphaned coroutines |
| Excessive Concurrency | 🟠 High | Coroutine count threshold |
| Missing Cancellation | 🟡 Medium | No suspension after cancel request |
| Exception Swallowing | 🟡 Medium | CancellationException not rethrown |
| Busy Waiting | 🟡 Medium | High CPU with no suspension |
| runBlocking Misuse | 🟠 High | runBlocking in suspend context |

### Implementation Checklist

- [ ] Blocking call detector
- [ ] Main thread monitor
- [ ] GlobalScope usage warning
- [ ] Coroutine count tracker
- [ ] Cancellation latency monitor
- [ ] Exception flow analyzer
- [ ] CPU usage correlator
- [ ] runBlocking context checker
- [ ] Warning aggregation system
- [ ] Frontend dashboard
- [ ] Code comparison views

---

**End of Document**

