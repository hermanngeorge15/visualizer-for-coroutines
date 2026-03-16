# Real-World Coroutine Patterns

**Version:** 1.0  
**Date:** December 2025  
**Status:** Design Document

---

## Executive Summary

This document covers production-ready coroutine patterns that solve common problems in real applications. Each pattern includes visualization design, events to track, and test scenarios.

**Patterns Covered:**
1. Retry with Exponential Backoff
2. Rate Limiting & Throttling
3. Debouncing
4. Circuit Breaker
5. Parallel Decomposition
6. Repository Pattern with Caching
7. Timeout Handling
8. Resource Management (use/withContext)

---

## 1. Retry with Exponential Backoff

### 1.1 Concept

Automatically retry failed operations with increasing delays between attempts. Essential for handling transient failures in distributed systems.

```kotlin
suspend fun <T> retryWithBackoff(
    times: Int = 3,
    initialDelayMs: Long = 100,
    maxDelayMs: Long = 10000,
    factor: Double = 2.0,
    block: suspend () -> T
): T {
    var currentDelay = initialDelayMs
    repeat(times - 1) { attempt ->
        try {
            return block()
        } catch (e: Exception) {
            // Log and wait
            delay(currentDelay)
            currentDelay = (currentDelay * factor).toLong().coerceAtMost(maxDelayMs)
        }
    }
    return block() // Last attempt, let exception propagate
}
```

### 1.2 Events to Track

```kotlin
sealed class RetryEvent : VizEvent() {
    
    data class RetryStarted(
        val retryId: String,
        val operationLabel: String,
        val maxAttempts: Int,
        val initialDelayMs: Long,
        val factor: Double
    ) : RetryEvent()
    
    data class AttemptStarted(
        val retryId: String,
        val attemptNumber: Int,
        val delayBeforeMs: Long  // 0 for first attempt
    ) : RetryEvent()
    
    data class AttemptSucceeded(
        val retryId: String,
        val attemptNumber: Int,
        val durationMs: Long
    ) : RetryEvent()
    
    data class AttemptFailed(
        val retryId: String,
        val attemptNumber: Int,
        val errorMessage: String,
        val nextDelayMs: Long,
        val willRetry: Boolean
    ) : RetryEvent()
    
    data class RetryExhausted(
        val retryId: String,
        val totalAttempts: Int,
        val finalError: String
    ) : RetryEvent()
}
```

### 1.3 Visualization Design

```
┌─────────────────────────────────────────────────────────────┐
│           RETRY: "fetch-user-data"                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Config: max=3, initial=100ms, factor=2.0, max=10s          │
│                                                              │
│  ═══════════════════════════════════════════════════════════ │
│                    ATTEMPT TIMELINE                          │
│  ═══════════════════════════════════════════════════════════ │
│                                                              │
│  Attempt 1 ──[FAIL]──┬──[DELAY 100ms]──┐                    │
│                      │                  │                    │
│  Attempt 2 ──────────┴──[FAIL]──┬──[DELAY 200ms]──┐        │
│                                 │                  │         │
│  Attempt 3 ─────────────────────┴──[SUCCESS]──────┘         │
│                                                              │
│  ═══════════════════════════════════════════════════════════ │
│  Total Time: 487ms    Attempts: 3    Status: ✅ SUCCESS     │
│  ═══════════════════════════════════════════════════════════ │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 1.4 Test Scenario

```kotlin
@Test
fun `retry with exponential backoff`() = runTest {
    var attempts = 0
    
    vizLaunch("api-caller") {
        val result = vizRetry(
            label = "fetch-data",
            times = 3,
            initialDelayMs = 100,
            factor = 2.0
        ) {
            attempts++
            if (attempts < 3) {
                throw IOException("Connection failed")
            }
            "Success!"
        }
        
        assertEquals("Success!", result)
    }
    
    assertEquals(3, attempts)
}
```

**Expected Events:**
1. `RetryStarted(maxAttempts=3)`
2. `AttemptStarted(attempt=1, delayBefore=0)`
3. `AttemptFailed(attempt=1, nextDelay=100ms)`
4. `AttemptStarted(attempt=2, delayBefore=100ms)`
5. `AttemptFailed(attempt=2, nextDelay=200ms)`
6. `AttemptStarted(attempt=3, delayBefore=200ms)`
7. `AttemptSucceeded(attempt=3)`

---

## 2. Rate Limiting & Throttling

### 2.1 Concept

Control the rate of operations to avoid overwhelming resources or hitting API limits.

```kotlin
class RateLimiter(
    private val permits: Int,
    private val periodMs: Long
) {
    private val semaphore = Semaphore(permits)
    private val replenishJob: Job
    
    init {
        replenishJob = CoroutineScope(Dispatchers.Default).launch {
            while (isActive) {
                delay(periodMs)
                repeat(permits - semaphore.availablePermits) {
                    semaphore.release()
                }
            }
        }
    }
    
    suspend fun <T> withLimit(block: suspend () -> T): T {
        semaphore.acquire()
        return block()
    }
}
```

### 2.2 Events to Track

```kotlin
sealed class RateLimitEvent : VizEvent() {
    
    data class RateLimiterCreated(
        val limiterId: String,
        val label: String,
        val permitsPerPeriod: Int,
        val periodMs: Long
    ) : RateLimitEvent()
    
    data class PermitRequested(
        val limiterId: String,
        val requesterId: String,
        val availablePermits: Int
    ) : RateLimitEvent()
    
    data class PermitGranted(
        val limiterId: String,
        val requesterId: String,
        val waitTimeMs: Long
    ) : RateLimitEvent()
    
    data class PermitDenied(
        val limiterId: String,
        val requesterId: String,
        val reason: String  // e.g., "Rate limit exceeded"
    ) : RateLimitEvent()
    
    data class PermitsReplenished(
        val limiterId: String,
        val newAvailable: Int,
        val totalPermits: Int
    ) : RateLimitEvent()
    
    data class RateLimitStats(
        val limiterId: String,
        val requestsInPeriod: Int,
        val deniedInPeriod: Int,
        val avgWaitTimeMs: Double
    ) : RateLimitEvent()
}
```

### 2.3 Visualization Design

```
┌─────────────────────────────────────────────────────────────┐
│           RATE LIMITER: "api-calls"                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Config: 10 requests per 1000ms                             │
│                                                              │
│  Current Period:                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ ████████░░ │  8/10 permits used                       │   │
│  └──────────────────────────────────────────────────────┘   │
│  Next refill in: 342ms                                       │
│                                                              │
│  ═══════════════════════════════════════════════════════════ │
│                    REQUEST TIMELINE                          │
│  ═══════════════════════════════════════════════════════════ │
│                                                              │
│  Time    Request          Status      Wait                   │
│  0ms     worker-1         ✅ Granted  0ms                    │
│  5ms     worker-2         ✅ Granted  0ms                    │
│  10ms    worker-3         ✅ Granted  0ms                    │
│  ...                                                         │
│  50ms    worker-9         🟡 Waiting  150ms                  │
│  60ms    worker-10        🟡 Waiting  290ms                  │
│                                                              │
│  ═══════════════════════════════════════════════════════════ │
│  Period Stats: 10 requests, 2 delayed, avg wait: 44ms       │
│  ═══════════════════════════════════════════════════════════ │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 2.4 Test Scenario

```kotlin
@Test
fun `rate limiter throttles requests`() = runTest {
    val limiter = vizRateLimiter(
        label = "api-calls",
        permits = 5,
        periodMs = 1000
    )
    
    // Launch 10 requests simultaneously
    val times = (1..10).map { i ->
        vizAsync("request-$i") {
            val start = currentTime
            limiter.withLimit {
                vizDelay(10)  // Simulate API call
            }
            currentTime - start  // Return total wait + execution time
        }
    }.awaitAll()
    
    // First 5 should be fast, next 5 should wait
    val fastRequests = times.take(5)
    val slowRequests = times.drop(5)
    
    assertTrue(fastRequests.all { it < 50 })
    assertTrue(slowRequests.all { it >= 1000 })  // Had to wait for refill
}
```

---

## 3. Debouncing

### 3.1 Concept

Delay execution until a pause in events. Common for search-as-you-type, window resize, etc.

```kotlin
class Debouncer<T>(
    private val delayMs: Long,
    private val scope: CoroutineScope,
    private val action: suspend (T) -> Unit
) {
    private var job: Job? = null
    
    fun debounce(value: T) {
        job?.cancel()
        job = scope.launch {
            delay(delayMs)
            action(value)
        }
    }
}
```

### 3.2 Events to Track

```kotlin
sealed class DebounceEvent : VizEvent() {
    
    data class DebounceStarted(
        val debouncerId: String,
        val label: String,
        val delayMs: Long
    ) : DebounceEvent()
    
    data class InputReceived(
        val debouncerId: String,
        val inputId: String,
        val value: String,  // String representation
        val previousPending: Boolean
    ) : DebounceEvent()
    
    data class InputCancelled(
        val debouncerId: String,
        val inputId: String,
        val reason: String  // "Superseded by newer input"
    ) : DebounceEvent()
    
    data class DelayStarted(
        val debouncerId: String,
        val inputId: String,
        val delayMs: Long
    ) : DebounceEvent()
    
    data class ActionExecuted(
        val debouncerId: String,
        val inputId: String,
        val totalDelayMs: Long
    ) : DebounceEvent()
}
```

### 3.3 Visualization Design

```
┌─────────────────────────────────────────────────────────────┐
│           DEBOUNCER: "search-input"                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Delay: 300ms                                                │
│                                                              │
│  ═══════════════════════════════════════════════════════════ │
│                    INPUT TIMELINE                            │
│  ═══════════════════════════════════════════════════════════ │
│                                                              │
│  Time  Input              Status                             │
│  ────────────────────────────────────────────────────────── │
│  0ms   "k"                ❌ Cancelled (superseded)          │
│  50ms  "ko"               ❌ Cancelled (superseded)          │
│  120ms "kot"              ❌ Cancelled (superseded)          │
│  200ms "kotl"             ❌ Cancelled (superseded)          │
│  350ms "kotlin"           ⏳ Waiting... (150ms remaining)    │
│                                                              │
│  ═══════════════════════════════════════════════════════════ │
│  Execution History:                                          │
│  ═══════════════════════════════════════════════════════════ │
│                                                              │
│  450ms → search("java")     [300ms after last input]        │
│  1200ms → search("kotlin")  [will execute if no more input] │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 3.4 Test Scenario

```kotlin
@Test
fun `debouncer waits for pause in input`() = runTest {
    val searchResults = mutableListOf<String>()
    
    val debouncer = vizDebouncer<String>(
        label = "search",
        delayMs = 300
    ) { query ->
        searchResults.add(query)
    }
    
    vizLaunch("typing-user") {
        debouncer.debounce("k")
        vizDelay(50)
        debouncer.debounce("ko")
        vizDelay(70)
        debouncer.debounce("kot")
        vizDelay(60)
        debouncer.debounce("kotl")
        vizDelay(80)
        debouncer.debounce("kotlin")
        // Now pause - action should execute after 300ms
    }
    
    advanceTimeBy(500)
    
    assertEquals(listOf("kotlin"), searchResults)
}
```

---

## 4. Circuit Breaker

### 4.1 Concept

Prevent cascading failures by "breaking" the circuit when too many failures occur.

```
State Machine:
                    
  ┌──────────┐  failure threshold  ┌──────────┐
  │  CLOSED  │ ─────────────────▶  │   OPEN   │
  │ (normal) │                     │ (failing)│
  └────┬─────┘                     └────┬─────┘
       │                                │
       │ success                        │ timeout
       │                                ▼
       │                          ┌──────────┐
       └────────────────────────  │HALF-OPEN │
                 success          │ (testing)│
                                  └──────────┘
```

```kotlin
class CircuitBreaker(
    private val failureThreshold: Int = 5,
    private val resetTimeoutMs: Long = 30000,
    private val halfOpenRequests: Int = 1
) {
    private var state: State = State.Closed
    private var failures = 0
    private var lastFailureTime = 0L
    
    suspend fun <T> execute(block: suspend () -> T): T {
        return when (state) {
            State.Open -> {
                if (System.currentTimeMillis() - lastFailureTime > resetTimeoutMs) {
                    state = State.HalfOpen
                    tryExecute(block)
                } else {
                    throw CircuitBreakerOpenException()
                }
            }
            State.HalfOpen -> tryExecute(block)
            State.Closed -> tryExecute(block)
        }
    }
    
    private suspend fun <T> tryExecute(block: suspend () -> T): T {
        return try {
            val result = block()
            onSuccess()
            result
        } catch (e: Exception) {
            onFailure()
            throw e
        }
    }
    
    private fun onSuccess() {
        failures = 0
        state = State.Closed
    }
    
    private fun onFailure() {
        failures++
        lastFailureTime = System.currentTimeMillis()
        if (failures >= failureThreshold) {
            state = State.Open
        }
    }
    
    enum class State { Closed, Open, HalfOpen }
}
```

### 4.2 Events to Track

```kotlin
sealed class CircuitBreakerEvent : VizEvent() {
    
    data class CircuitBreakerCreated(
        val breakerId: String,
        val label: String,
        val failureThreshold: Int,
        val resetTimeoutMs: Long
    ) : CircuitBreakerEvent()
    
    data class RequestAttempted(
        val breakerId: String,
        val requestId: String,
        val currentState: String,  // CLOSED, OPEN, HALF_OPEN
        val failureCount: Int
    ) : CircuitBreakerEvent()
    
    data class RequestSucceeded(
        val breakerId: String,
        val requestId: String,
        val durationMs: Long
    ) : CircuitBreakerEvent()
    
    data class RequestFailed(
        val breakerId: String,
        val requestId: String,
        val error: String,
        val failureCount: Int
    ) : CircuitBreakerEvent()
    
    data class RequestRejected(
        val breakerId: String,
        val requestId: String,
        val reason: String  // "Circuit is OPEN"
    ) : CircuitBreakerEvent()
    
    data class StateChanged(
        val breakerId: String,
        val fromState: String,
        val toState: String,
        val reason: String
    ) : CircuitBreakerEvent()
}
```

### 4.3 Visualization Design

```
┌─────────────────────────────────────────────────────────────┐
│           CIRCUIT BREAKER: "payment-service"                 │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│           ┌─────────────────────────────────────┐           │
│           │                                      │           │
│           │    🔴  CIRCUIT OPEN                  │           │
│           │                                      │           │
│           │    Failures: 5/5                     │           │
│           │    Reset in: 24s                     │           │
│           │                                      │           │
│           └─────────────────────────────────────┘           │
│                                                              │
│  ═══════════════════════════════════════════════════════════ │
│                    STATE HISTORY                             │
│  ═══════════════════════════════════════════════════════════ │
│                                                              │
│  Time      State       Reason                                │
│  ──────────────────────────────────────────────────────────  │
│  0s        🟢 CLOSED   Initial state                         │
│  5s        🟢 CLOSED   Request succeeded                     │
│  10s       🟢 CLOSED   Failure 1/5 (timeout)                 │
│  12s       🟢 CLOSED   Failure 2/5 (connection refused)      │
│  14s       🟢 CLOSED   Failure 3/5 (timeout)                 │
│  16s       🟢 CLOSED   Failure 4/5 (500 error)               │
│  18s       🔴 OPEN     Failure 5/5 - threshold reached       │
│                                                              │
│  ═══════════════════════════════════════════════════════════ │
│  Next State: 🟡 HALF_OPEN at 48s (to test recovery)         │
│  ═══════════════════════════════════════════════════════════ │
│                                                              │
│  Stats (last hour): 145 success, 12 failures, 8 rejected    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 4.4 Test Scenario

```kotlin
@Test
fun `circuit breaker opens after threshold`() = runTest {
    val breaker = vizCircuitBreaker(
        label = "flaky-service",
        failureThreshold = 3,
        resetTimeoutMs = 1000
    )
    
    // Simulate failures
    repeat(3) {
        assertFailsWith<IOException> {
            breaker.execute {
                throw IOException("Service unavailable")
            }
        }
    }
    
    // Next request should be rejected without attempting
    assertFailsWith<CircuitBreakerOpenException> {
        breaker.execute {
            "This should not run"
        }
    }
    
    // Wait for reset timeout
    advanceTimeBy(1100)
    
    // Circuit should be half-open, allowing test request
    val result = breaker.execute { "Success!" }
    assertEquals("Success!", result)
}
```

---

## 5. Parallel Decomposition

### 5.1 Concept

Break a large task into parallel subtasks and combine results.

```kotlin
suspend fun <T, R> List<T>.parallelMap(
    concurrency: Int = 10,
    transform: suspend (T) -> R
): List<R> = coroutineScope {
    val semaphore = Semaphore(concurrency)
    map { item ->
        async {
            semaphore.withPermit {
                transform(item)
            }
        }
    }.awaitAll()
}
```

### 5.2 Events to Track

```kotlin
sealed class ParallelEvent : VizEvent() {
    
    data class ParallelOperationStarted(
        val operationId: String,
        val label: String,
        val totalTasks: Int,
        val maxConcurrency: Int
    ) : ParallelEvent()
    
    data class TaskStarted(
        val operationId: String,
        val taskIndex: Int,
        val taskLabel: String,
        val coroutineId: String
    ) : ParallelEvent()
    
    data class TaskCompleted(
        val operationId: String,
        val taskIndex: Int,
        val durationMs: Long,
        val success: Boolean
    ) : ParallelEvent()
    
    data class ParallelProgress(
        val operationId: String,
        val completedTasks: Int,
        val totalTasks: Int,
        val runningTasks: Int,
        val pendingTasks: Int
    ) : ParallelEvent()
    
    data class ParallelOperationCompleted(
        val operationId: String,
        val totalDurationMs: Long,
        val successCount: Int,
        val failureCount: Int
    ) : ParallelEvent()
}
```

### 5.3 Visualization Design

```
┌─────────────────────────────────────────────────────────────┐
│           PARALLEL: "batch-image-resize"                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Progress: ████████████████░░░░░░░░░░░░  45/100 (45%)       │
│                                                              │
│  ═══════════════════════════════════════════════════════════ │
│                    WORKER LANES                              │
│  ═══════════════════════════════════════════════════════════ │
│                                                              │
│  Lane 1: ████[42]████                                       │
│  Lane 2: ██████[43]██████                                   │
│  Lane 3: ██[44]██                                           │
│  Lane 4: ████████[45]████████                               │
│  Lane 5: ████[46]████                                       │
│                                                              │
│  ═══════════════════════════════════════════════════════════ │
│                    QUEUE                                     │
│  ═══════════════════════════════════════════════════════════ │
│                                                              │
│  Pending: [47] [48] [49] [50] ... (+45 more)                │
│                                                              │
│  ═══════════════════════════════════════════════════════════ │
│  Stats: Running: 5  Complete: 45  Failed: 0  Pending: 50    │
│  Throughput: 15 tasks/sec    ETA: 3.3 seconds               │
│  ═══════════════════════════════════════════════════════════ │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 5.4 Test Scenario

```kotlin
@Test
fun `parallel decomposition with concurrency limit`() = runTest {
    val items = (1..20).toList()
    var maxConcurrent = 0
    var currentConcurrent = AtomicInteger(0)
    
    val results = vizParallelMap(
        label = "process-items",
        items = items,
        concurrency = 5
    ) { item ->
        val concurrent = currentConcurrent.incrementAndGet()
        maxConcurrent = maxOf(maxConcurrent, concurrent)
        
        vizDelay(100)  // Simulate work
        
        currentConcurrent.decrementAndGet()
        item * 2
    }
    
    assertEquals(items.map { it * 2 }, results)
    assertEquals(5, maxConcurrent)  // Never exceeded limit
}
```

---

## 6. Repository Pattern with Caching

### 6.1 Concept

Combine local cache with remote data source, with coroutine-friendly refresh.

```kotlin
class CachedRepository<K, V>(
    private val cache: MutableMap<K, CacheEntry<V>> = mutableMapOf(),
    private val cacheDurationMs: Long = 60_000,
    private val fetchFromNetwork: suspend (K) -> V
) {
    private val mutex = Mutex()
    
    suspend fun get(key: K): V {
        // Check cache first
        cache[key]?.let { entry ->
            if (!entry.isExpired()) {
                return entry.value
            }
        }
        
        // Fetch and cache
        return mutex.withLock {
            // Double-check after acquiring lock
            cache[key]?.let { entry ->
                if (!entry.isExpired()) {
                    return entry.value
                }
            }
            
            val value = fetchFromNetwork(key)
            cache[key] = CacheEntry(value, System.currentTimeMillis())
            value
        }
    }
    
    data class CacheEntry<V>(
        val value: V,
        val timestamp: Long
    ) {
        fun isExpired(durationMs: Long = 60_000): Boolean =
            System.currentTimeMillis() - timestamp > durationMs
    }
}
```

### 6.2 Events to Track

```kotlin
sealed class CacheEvent : VizEvent() {
    
    data class CacheCreated(
        val cacheId: String,
        val label: String,
        val maxSize: Int?,
        val ttlMs: Long
    ) : CacheEvent()
    
    data class CacheHit(
        val cacheId: String,
        val key: String,
        val age: Long,
        val remainingTtlMs: Long
    ) : CacheEvent()
    
    data class CacheMiss(
        val cacheId: String,
        val key: String,
        val reason: String  // "Not found" or "Expired"
    ) : CacheEvent()
    
    data class CacheFetch(
        val cacheId: String,
        val key: String,
        val fetchId: String,
        val source: String  // "network", "database"
    ) : CacheEvent()
    
    data class CacheUpdate(
        val cacheId: String,
        val key: String,
        val fetchDurationMs: Long,
        val newTtlMs: Long
    ) : CacheEvent()
    
    data class CacheEviction(
        val cacheId: String,
        val key: String,
        val reason: String  // "TTL expired", "LRU", "Manual"
    ) : CacheEvent()
    
    data class CacheStats(
        val cacheId: String,
        val size: Int,
        val hitRate: Double,
        val avgFetchTimeMs: Double
    ) : CacheEvent()
}
```

### 6.3 Visualization Design

```
┌─────────────────────────────────────────────────────────────┐
│           CACHED REPOSITORY: "user-profiles"                 │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  TTL: 60s    Size: 150/500    Hit Rate: 87.3%               │
│                                                              │
│  ═══════════════════════════════════════════════════════════ │
│                    RECENT OPERATIONS                         │
│  ═══════════════════════════════════════════════════════════ │
│                                                              │
│  Time    Key           Result     Details                    │
│  ──────────────────────────────────────────────────────────  │
│  14:32   user:alice    ✅ HIT     age: 5s, ttl: 55s         │
│  14:32   user:bob      ❌ MISS    expired (72s old)         │
│                        ⬇️ FETCH   from network (142ms)       │
│                        ✅ UPDATE  new ttl: 60s               │
│  14:33   user:charlie  ❌ MISS    not found                  │
│                        ⬇️ FETCH   from network (98ms)        │
│                        ✅ UPDATE  new ttl: 60s               │
│                                                              │
│  ═══════════════════════════════════════════════════════════ │
│                    CACHE CONTENTS (showing 5 of 150)         │
│  ═══════════════════════════════════════════════════════════ │
│                                                              │
│  Key           Value Preview           Age      TTL          │
│  ──────────────────────────────────────────────────────────  │
│  user:alice    {name: "Alice"...}     5s       55s  [███░]  │
│  user:bob      {name: "Bob"...}       2s       58s  [████]  │
│  user:charlie  {name: "Charlie"...}   1s       59s  [████]  │
│  ...                                                         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Timeout Handling

### 7.1 Concept

Bound operation duration with graceful timeout handling.

```kotlin
// Option 1: Throw exception on timeout
suspend fun fetchWithTimeout(): Data = withTimeout(5000) {
    fetchFromNetwork()
}

// Option 2: Return null on timeout
suspend fun fetchWithTimeoutOrNull(): Data? = withTimeoutOrNull(5000) {
    fetchFromNetwork()
}

// Option 3: Custom timeout handling
suspend fun fetchWithFallback(): Data {
    return try {
        withTimeout(5000) {
            fetchFromNetwork()
        }
    } catch (e: TimeoutCancellationException) {
        fetchFromCache() // Fallback
    }
}
```

### 7.2 Events to Track

```kotlin
sealed class TimeoutEvent : VizEvent() {
    
    data class TimeoutStarted(
        val timeoutId: String,
        val label: String,
        val timeoutMs: Long,
        val coroutineId: String
    ) : TimeoutEvent()
    
    data class TimeoutProgress(
        val timeoutId: String,
        val elapsedMs: Long,
        val remainingMs: Long,
        val percentComplete: Int
    ) : TimeoutEvent()
    
    data class TimeoutSucceeded(
        val timeoutId: String,
        val durationMs: Long,
        val marginMs: Long  // Time remaining
    ) : TimeoutEvent()
    
    data class TimeoutExceeded(
        val timeoutId: String,
        val timeoutMs: Long,
        val actualDurationMs: Long,
        val wasCancelled: Boolean
    ) : TimeoutEvent()
}
```

### 7.3 Visualization Design

```
┌─────────────────────────────────────────────────────────────┐
│           TIMEOUT: "api-request"                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Timeout: 5000ms                                             │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  ████████████████████████████████░░░░░░░░░░░░░░░░░░░░│ │
│  │  3200ms elapsed                      1800ms remaining  │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  Status: ⏳ IN PROGRESS                                      │
│                                                              │
│  ═══════════════════════════════════════════════════════════ │
│  History:                                                    │
│  ═══════════════════════════════════════════════════════════ │
│                                                              │
│  14:30:05  Started (timeout: 5000ms)                        │
│  14:30:08  Progress: 64% (3200ms / 5000ms)                  │
│                                                              │
│  ⚠️ Warning: Operation slow, 36% time remaining             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. Resource Management

### 8.1 Concept

Safely manage resources with automatic cleanup using `use` or custom patterns.

```kotlin
// Using Closeable.use
suspend fun readFile(path: String): String {
    return withContext(Dispatchers.IO) {
        File(path).inputStream().use { stream ->
            stream.bufferedReader().readText()
        }
    }
}

// Custom resource management
suspend fun <T : Closeable, R> T.useSuspending(block: suspend (T) -> R): R {
    var exception: Throwable? = null
    try {
        return block(this)
    } catch (e: Throwable) {
        exception = e
        throw e
    } finally {
        withContext(NonCancellable) {
            try {
                close()
            } catch (closeException: Throwable) {
                exception?.addSuppressed(closeException)
            }
        }
    }
}
```

### 8.2 Events to Track

```kotlin
sealed class ResourceEvent : VizEvent() {
    
    data class ResourceAcquired(
        val resourceId: String,
        val resourceType: String,
        val label: String,
        val coroutineId: String
    ) : ResourceEvent()
    
    data class ResourceInUse(
        val resourceId: String,
        val durationMs: Long,
        val operationsCount: Int
    ) : ResourceEvent()
    
    data class ResourceReleased(
        val resourceId: String,
        val holdDurationMs: Long,
        val releasedBy: String  // "normal", "exception", "cancellation"
    ) : ResourceEvent()
    
    data class ResourceLeak(
        val resourceId: String,
        val resourceType: String,
        val acquiredAt: Long,
        val coroutineId: String,
        val stackTrace: String
    ) : ResourceEvent()
}
```

---

## 9. Wrapper Implementations

### 9.1 vizRetry

```kotlin
suspend fun <T> VizScope.vizRetry(
    label: String,
    times: Int = 3,
    initialDelayMs: Long = 100,
    maxDelayMs: Long = 10000,
    factor: Double = 2.0,
    block: suspend () -> T
): T {
    val retryId = IdRegistry.nextRetryId()
    
    session.send(RetryStarted(
        retryId = retryId,
        operationLabel = label,
        maxAttempts = times,
        initialDelayMs = initialDelayMs,
        factor = factor
    ))
    
    var currentDelay = initialDelayMs
    var lastException: Exception? = null
    
    repeat(times) { attempt ->
        session.send(AttemptStarted(
            retryId = retryId,
            attemptNumber = attempt + 1,
            delayBeforeMs = if (attempt == 0) 0 else currentDelay
        ))
        
        try {
            val result = block()
            session.send(AttemptSucceeded(
                retryId = retryId,
                attemptNumber = attempt + 1,
                durationMs = measureTimeMillis { }
            ))
            return result
        } catch (e: Exception) {
            lastException = e
            val willRetry = attempt < times - 1
            
            session.send(AttemptFailed(
                retryId = retryId,
                attemptNumber = attempt + 1,
                errorMessage = e.message ?: "Unknown error",
                nextDelayMs = if (willRetry) currentDelay else 0,
                willRetry = willRetry
            ))
            
            if (willRetry) {
                delay(currentDelay)
                currentDelay = (currentDelay * factor).toLong().coerceAtMost(maxDelayMs)
            }
        }
    }
    
    session.send(RetryExhausted(
        retryId = retryId,
        totalAttempts = times,
        finalError = lastException?.message ?: "Unknown error"
    ))
    
    throw lastException!!
}
```

### 9.2 vizCircuitBreaker

```kotlin
class VizCircuitBreaker(
    private val session: VizSession,
    val label: String,
    private val failureThreshold: Int = 5,
    private val resetTimeoutMs: Long = 30000
) {
    private val breakerId = IdRegistry.nextCircuitBreakerId()
    private var state: State = State.Closed
    private var failures = 0
    private var lastFailureTime = 0L
    
    init {
        session.send(CircuitBreakerCreated(
            breakerId = breakerId,
            label = label,
            failureThreshold = failureThreshold,
            resetTimeoutMs = resetTimeoutMs
        ))
    }
    
    suspend fun <T> execute(block: suspend () -> T): T {
        val requestId = IdRegistry.nextRequestId()
        
        session.send(RequestAttempted(
            breakerId = breakerId,
            requestId = requestId,
            currentState = state.name,
            failureCount = failures
        ))
        
        when (state) {
            State.Open -> {
                if (System.currentTimeMillis() - lastFailureTime > resetTimeoutMs) {
                    transitionTo(State.HalfOpen, "Reset timeout elapsed")
                    return tryExecute(requestId, block)
                } else {
                    session.send(RequestRejected(
                        breakerId = breakerId,
                        requestId = requestId,
                        reason = "Circuit is OPEN"
                    ))
                    throw CircuitBreakerOpenException()
                }
            }
            State.HalfOpen, State.Closed -> return tryExecute(requestId, block)
        }
    }
    
    private suspend fun <T> tryExecute(requestId: String, block: suspend () -> T): T {
        val startTime = System.currentTimeMillis()
        return try {
            val result = block()
            onSuccess(requestId, System.currentTimeMillis() - startTime)
            result
        } catch (e: Exception) {
            onFailure(requestId, e.message ?: "Unknown")
            throw e
        }
    }
    
    private fun onSuccess(requestId: String, durationMs: Long) {
        session.send(RequestSucceeded(breakerId, requestId, durationMs))
        
        if (state != State.Closed) {
            transitionTo(State.Closed, "Successful request")
        }
        failures = 0
    }
    
    private fun onFailure(requestId: String, error: String) {
        failures++
        lastFailureTime = System.currentTimeMillis()
        
        session.send(RequestFailed(breakerId, requestId, error, failures))
        
        if (failures >= failureThreshold && state == State.Closed) {
            transitionTo(State.Open, "Failure threshold reached ($failures/$failureThreshold)")
        }
    }
    
    private fun transitionTo(newState: State, reason: String) {
        val oldState = state
        state = newState
        session.send(StateChanged(breakerId, oldState.name, newState.name, reason))
    }
    
    enum class State { Closed, Open, HalfOpen }
}
```

---

## 10. Summary

### Patterns Covered

| Pattern | Use Case | Key Benefit |
|---------|----------|-------------|
| **Retry** | Transient failures | Automatic recovery |
| **Rate Limiter** | API limits | Prevent throttling |
| **Debouncer** | User input | Reduce calls |
| **Circuit Breaker** | Service failures | Prevent cascading |
| **Parallel Map** | Batch processing | Throughput |
| **Cached Repository** | Data fetching | Performance |
| **Timeout** | Slow operations | Bounded latency |
| **Resource Management** | Cleanup | Prevent leaks |

### Implementation Checklist

- [ ] `vizRetry()` wrapper
- [ ] `vizRateLimiter` class
- [ ] `vizDebouncer` class
- [ ] `vizCircuitBreaker` class
- [ ] `vizParallelMap()` function
- [ ] `vizCachedRepository` class
- [ ] `vizTimeout()` wrapper
- [ ] Resource tracking events
- [ ] Frontend visualizations
- [ ] Test scenarios (15+ cases)

---

**End of Document**

