# Mutex, Semaphore & Synchronization

**Version:** 1.0  
**Date:** December 2025  
**Status:** Design Document

---

## Executive Summary

This document outlines the visualization design for Kotlin coroutine synchronization primitives: **Mutex**, **Semaphore**, and related patterns. These are essential for thread-safe operations in concurrent code.

**Key Goals:**
- Visualize lock acquisition and release
- Show waiting queues for blocked coroutines
- Detect and highlight potential deadlocks
- Demonstrate safe vs unsafe concurrent access

---

## 1. Mutex (Mutual Exclusion)

### 1.1 Concept Overview

A **Mutex** ensures that only one coroutine can access a critical section at a time. Unlike traditional locks, Mutex is **suspending** - waiting coroutines don't block threads.

```kotlin
val mutex = Mutex()

suspend fun criticalSection() {
    mutex.lock()
    try {
        // Only one coroutine here at a time
        updateSharedState()
    } finally {
        mutex.unlock()
    }
}

// Or using withLock extension:
suspend fun criticalSectionSafe() {
    mutex.withLock {
        updateSharedState()
    }
}
```

### 1.2 Events to Track

```kotlin
// Event types for Mutex visualization
sealed class MutexEvent : VizEvent() {
    data class MutexCreated(
        val mutexId: String,
        val label: String?,
        val ownerCoroutineId: String?
    ) : MutexEvent()
    
    data class MutexLockRequested(
        val mutexId: String,
        val requesterId: String,
        val requesterLabel: String,
        val isLocked: Boolean,          // Current state when requested
        val queuePosition: Int          // Position in wait queue (0 if acquired immediately)
    ) : MutexEvent()
    
    data class MutexLockAcquired(
        val mutexId: String,
        val acquirerId: String,
        val acquirerLabel: String,
        val waitDurationNanos: Long     // How long waited for lock
    ) : MutexEvent()
    
    data class MutexUnlocked(
        val mutexId: String,
        val releaserId: String,
        val nextWaiterId: String?,      // Who gets the lock next
        val holdDurationNanos: Long     // How long lock was held
    ) : MutexEvent()
    
    data class MutexQueueChanged(
        val mutexId: String,
        val waitingCoroutineIds: List<String>,
        val waitingLabels: List<String>
    ) : MutexEvent()
}
```

### 1.3 Visualization Design

#### Visual Elements

```
┌─────────────────────────────────────────────────────────────┐
│                    MUTEX: "database-lock"                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│    ┌──────────┐                                             │
│    │  🔒 LOCK │  Owner: coroutine-3 (writer)                │
│    │  HELD    │  Hold time: 45ms                            │
│    └──────────┘                                             │
│                                                              │
│    ═══════════════════════════════════════════════════════  │
│                     WAITING QUEUE (3)                        │
│    ═══════════════════════════════════════════════════════  │
│                                                              │
│    [1] 🟡 coroutine-5 (reader-1)     waiting: 32ms          │
│    [2] 🟡 coroutine-7 (reader-2)     waiting: 28ms          │
│    [3] 🟡 coroutine-9 (writer-2)     waiting: 15ms          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### State Colors
- 🟢 **Green**: Lock available (unlocked)
- 🔴 **Red**: Lock held (locked)
- 🟡 **Yellow**: Coroutine waiting for lock
- 🟠 **Orange**: Long wait detected (potential issue)

#### Timeline View

```
Time ─────────────────────────────────────────────────────────→

coroutine-3:  ════[LOCK ACQUIRED]═══════════════════[UNLOCK]═══
                   ↑                                    ↓
coroutine-5:  ────[REQUEST]─────[WAITING...]─────[ACQUIRED]════
                                                       ↓
coroutine-7:  ──────────[REQUEST]───────[WAITING...]─[ACQUIRED]
```

### 1.4 Test Scenarios

#### Scenario 1: Basic Lock/Unlock

```kotlin
@Test
fun `mutex basic acquisition`() = runTest {
    val mutex = vizMutex("counter-lock")
    var counter = 0
    
    vizLaunch("worker") {
        mutex.withLock {
            counter++
            vizDelay(100)
        }
    }
}
```

**Expected Events:**
1. `MutexCreated(mutexId, "counter-lock")`
2. `MutexLockRequested(mutexId, workerId, queuePosition=0)`
3. `MutexLockAcquired(mutexId, workerId, waitDuration=~0)`
4. `MutexUnlocked(mutexId, workerId, holdDuration=~100ms)`

#### Scenario 2: Contention - Multiple Waiters

```kotlin
@Test
fun `mutex with contention`() = runTest {
    val mutex = vizMutex("shared-resource")
    
    // First acquires lock
    vizLaunch("holder") {
        mutex.withLock {
            vizDelay(500)  // Hold for a while
        }
    }
    
    vizDelay(50)  // Ensure holder has lock
    
    // These will wait
    vizLaunch("waiter-1") {
        mutex.withLock {
            vizDelay(100)
        }
    }
    
    vizLaunch("waiter-2") {
        mutex.withLock {
            vizDelay(100)
        }
    }
}
```

**Expected Events:**
1. Holder acquires immediately (queuePosition=0)
2. Waiter-1 requests, enters queue (queuePosition=1)
3. Waiter-2 requests, enters queue (queuePosition=2)
4. Holder unlocks → Waiter-1 acquires
5. Waiter-1 unlocks → Waiter-2 acquires

#### Scenario 3: tryLock (Non-Blocking)

```kotlin
@Test
fun `mutex tryLock behavior`() = runTest {
    val mutex = vizMutex("optional-lock")
    
    vizLaunch("holder") {
        mutex.withLock {
            vizDelay(500)
        }
    }
    
    vizDelay(50)
    
    vizLaunch("eager") {
        val acquired = mutex.tryLock()
        if (!acquired) {
            // Handle lock unavailable
            println("Could not acquire lock, proceeding without")
        }
    }
}
```

**Expected Events:**
1. Holder acquires lock
2. `MutexTryLockFailed(mutexId, eagerId)` - new event type

---

## 2. Semaphore

### 2.1 Concept Overview

A **Semaphore** limits the number of coroutines that can access a resource simultaneously. Think of it as a pool of permits.

```kotlin
val semaphore = Semaphore(permits = 3)

suspend fun accessLimitedResource() {
    semaphore.acquire()  // Take a permit (suspends if none available)
    try {
        // At most 3 coroutines here simultaneously
        useResource()
    } finally {
        semaphore.release()  // Return permit
    }
}

// Or using withPermit extension:
suspend fun accessLimitedResourceSafe() {
    semaphore.withPermit {
        useResource()
    }
}
```

### 2.2 Events to Track

```kotlin
sealed class SemaphoreEvent : VizEvent() {
    data class SemaphoreCreated(
        val semaphoreId: String,
        val label: String?,
        val totalPermits: Int
    ) : SemaphoreEvent()
    
    data class SemaphoreAcquireRequested(
        val semaphoreId: String,
        val requesterId: String,
        val requesterLabel: String,
        val availablePermits: Int,
        val permitsRequested: Int        // Usually 1, but can be more
    ) : SemaphoreEvent()
    
    data class SemaphorePermitAcquired(
        val semaphoreId: String,
        val acquirerId: String,
        val remainingPermits: Int,
        val waitDurationNanos: Long
    ) : SemaphoreEvent()
    
    data class SemaphorePermitReleased(
        val semaphoreId: String,
        val releaserId: String,
        val newAvailablePermits: Int,
        val holdDurationNanos: Long
    ) : SemaphoreEvent()
    
    data class SemaphoreStateChanged(
        val semaphoreId: String,
        val availablePermits: Int,
        val totalPermits: Int,
        val activeHolders: List<String>,
        val waitingCoroutines: List<String>
    ) : SemaphoreEvent()
}
```

### 2.3 Visualization Design

#### Visual Elements - Permit Pool

```
┌─────────────────────────────────────────────────────────────┐
│              SEMAPHORE: "connection-pool" (3 permits)        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│    PERMITS:  [🟢] [🔴] [🔴]                                  │
│              avail  held  held                               │
│                                                              │
│    Available: 1/3                                            │
│                                                              │
│    ═══════════════════════════════════════════════════════  │
│                     ACTIVE HOLDERS                           │
│    ═══════════════════════════════════════════════════════  │
│                                                              │
│    🔴 coroutine-3 (db-query-1)     holding: 120ms           │
│    🔴 coroutine-5 (db-query-2)     holding: 85ms            │
│                                                              │
│    ═══════════════════════════════════════════════════════  │
│                     WAITING QUEUE (2)                        │
│    ═══════════════════════════════════════════════════════  │
│                                                              │
│    [1] 🟡 coroutine-7 (db-query-3)     waiting: 50ms        │
│    [2] 🟡 coroutine-9 (db-query-4)     waiting: 30ms        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### Utilization Chart

```
Permits Used Over Time
────────────────────────────────────────────
3 │      ██████████████           ██████
2 │ ████                ████████
1 │           
0 │──────────────────────────────────────────
  0s      1s      2s      3s      4s      5s
```

### 2.4 Test Scenarios

#### Scenario 1: Rate Limiting with Semaphore

```kotlin
@Test
fun `semaphore rate limiting`() = runTest {
    val rateLimiter = vizSemaphore("api-calls", permits = 2)
    
    // Launch 5 API calls, only 2 can run at once
    repeat(5) { i ->
        vizLaunch("api-call-$i") {
            rateLimiter.withPermit {
                vizDelay(100)  // Simulate API call
            }
        }
    }
}
```

**Expected Visualization:**
- First 2 calls acquire immediately
- Calls 3-5 queue up
- As calls complete, permits released to waiting calls
- Total time: ~300ms (3 batches of 2)

#### Scenario 2: Connection Pool

```kotlin
@Test
fun `semaphore as connection pool`() = runTest {
    val connectionPool = vizSemaphore("db-connections", permits = 3)
    
    repeat(10) { i ->
        vizLaunch("query-$i") {
            connectionPool.withPermit {
                // Simulate database query with variable time
                vizDelay((50..200).random().toLong())
            }
        }
    }
}
```

**Expected Visualization:**
- Never more than 3 active connections
- Queue fluctuates based on query completion times
- Show throughput metrics

---

## 3. Deadlock Detection

### 3.1 Concept Overview

A **deadlock** occurs when two or more coroutines are waiting for each other to release locks, creating a circular wait.

```kotlin
// DEADLOCK SCENARIO - DON'T DO THIS!
val mutexA = Mutex()
val mutexB = Mutex()

// Coroutine 1
launch {
    mutexA.lock()
    delay(100)
    mutexB.lock()  // Waits forever if coroutine 2 holds mutexB
    // ...
}

// Coroutine 2
launch {
    mutexB.lock()
    delay(100)
    mutexA.lock()  // Waits forever if coroutine 1 holds mutexA
    // ...
}
```

### 3.2 Events to Track

```kotlin
data class DeadlockDetected(
    val involvedCoroutines: List<String>,
    val involvedMutexes: List<String>,
    val waitGraph: Map<String, String>,  // coroutineId -> waitingForMutexId
    val holdGraph: Map<String, String>   // mutexId -> heldByCoroutineId
) : VizEvent()

data class PotentialDeadlockWarning(
    val coroutineId: String,
    val holdingMutex: String,
    val requestingMutex: String,
    val recommendation: String
) : VizEvent()
```

### 3.3 Visualization Design

#### Deadlock Graph

```
┌─────────────────────────────────────────────────────────────┐
│           ⚠️  DEADLOCK DETECTED  ⚠️                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│         ┌──────────────┐        ┌──────────────┐            │
│         │ coroutine-1  │        │ coroutine-2  │            │
│         │   (writer)   │        │   (reader)   │            │
│         └──────┬───────┘        └───────┬──────┘            │
│                │                        │                    │
│           HOLDS│                        │HOLDS               │
│                ▼                        ▼                    │
│         ┌──────────────┐        ┌──────────────┐            │
│         │   mutex-A    │◄───────│   mutex-B    │            │
│         │  (db-lock)   │ WAITS  │ (cache-lock) │            │
│         └──────────────┘  FOR   └──────────────┘            │
│                │                        ▲                    │
│                └────────WAITS FOR───────┘                    │
│                                                              │
│    ═══════════════════════════════════════════════════════  │
│    CIRCULAR WAIT CHAIN:                                      │
│    coroutine-1 → holds mutex-A → waits mutex-B              │
│    coroutine-2 → holds mutex-B → waits mutex-A              │
│    ═══════════════════════════════════════════════════════  │
│                                                              │
│    💡 SUGGESTION: Always acquire locks in consistent order   │
│       (e.g., alphabetically: mutex-A before mutex-B)        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 3.4 Test Scenarios

#### Scenario 1: Classic Deadlock

```kotlin
@Test
fun `detect classic deadlock`() = runTest {
    val mutexA = vizMutex("resource-A")
    val mutexB = vizMutex("resource-B")
    
    vizLaunch("worker-1") {
        mutexA.withLock {
            vizDelay(100)
            mutexB.withLock {  // Will deadlock
                // Never reached
            }
        }
    }
    
    vizLaunch("worker-2") {
        mutexB.withLock {
            vizDelay(100)
            mutexA.withLock {  // Will deadlock
                // Never reached
            }
        }
    }
    
    // Should detect deadlock after both are waiting
    advanceTimeBy(500)
}
```

**Expected Visualization:**
- Both coroutines shown in circular wait
- Red warning indicator
- Recommendation: "Lock ordering violation detected"

#### Scenario 2: Safe Lock Ordering

```kotlin
@Test
fun `safe lock ordering prevents deadlock`() = runTest {
    val mutexA = vizMutex("resource-A")
    val mutexB = vizMutex("resource-B")
    
    // Helper to acquire in consistent order
    suspend fun withBothLocks(block: suspend () -> Unit) {
        mutexA.withLock {
            mutexB.withLock {
                block()
            }
        }
    }
    
    vizLaunch("worker-1") {
        withBothLocks {
            vizDelay(100)
        }
    }
    
    vizLaunch("worker-2") {
        withBothLocks {
            vizDelay(100)
        }
    }
}
```

**Expected Visualization:**
- Sequential acquisition, no deadlock
- Green "Safe Pattern" indicator

---

## 4. Advanced Patterns

### 4.1 Read-Write Lock Pattern

```kotlin
class ReadWriteLock {
    private val mutex = Mutex()
    private val readSemaphore = Semaphore(Int.MAX_VALUE)
    private var readers = 0
    
    suspend fun readLock() {
        mutex.withLock {
            readers++
            if (readers == 1) {
                // First reader blocks writers
            }
        }
        readSemaphore.acquire()
    }
    
    suspend fun readUnlock() {
        readSemaphore.release()
        mutex.withLock {
            readers--
        }
    }
    
    suspend fun writeLock() {
        mutex.lock()
        // Wait for all readers to finish
        repeat(readers) {
            readSemaphore.acquire()
        }
    }
    
    suspend fun writeUnlock() {
        repeat(readers) {
            readSemaphore.release()
        }
        mutex.unlock()
    }
}
```

### 4.2 Double-Checked Locking

```kotlin
class LazyInitializer<T>(private val initializer: suspend () -> T) {
    private val mutex = Mutex()
    
    @Volatile
    private var instance: T? = null
    
    suspend fun get(): T {
        // First check (without lock)
        instance?.let { return it }
        
        return mutex.withLock {
            // Second check (with lock)
            instance?.let { return it }
            
            // Initialize
            initializer().also { instance = it }
        }
    }
}
```

---

## 5. Wrapper Implementation

### 5.1 VizMutex

```kotlin
class VizMutex(
    private val session: VizSession,
    val label: String? = null
) : Mutex {
    
    private val mutexId = IdRegistry.nextMutexId()
    private val delegate = Mutex()
    private val waitQueue = mutableListOf<String>()
    
    init {
        session.send(MutexCreated(mutexId, label, null))
    }
    
    override suspend fun lock(owner: Any?) {
        val coroutineId = currentCoroutineId()
        val wasLocked = delegate.isLocked
        val position = if (wasLocked) waitQueue.size + 1 else 0
        
        session.send(MutexLockRequested(
            mutexId = mutexId,
            requesterId = coroutineId,
            requesterLabel = currentLabel(),
            isLocked = wasLocked,
            queuePosition = position
        ))
        
        if (wasLocked) {
            waitQueue.add(coroutineId)
            emitQueueChanged()
        }
        
        val startWait = System.nanoTime()
        delegate.lock(owner)
        val waitDuration = System.nanoTime() - startWait
        
        waitQueue.remove(coroutineId)
        
        session.send(MutexLockAcquired(
            mutexId = mutexId,
            acquirerId = coroutineId,
            acquirerLabel = currentLabel(),
            waitDurationNanos = waitDuration
        ))
    }
    
    override fun unlock(owner: Any?) {
        val coroutineId = currentCoroutineId()
        val nextWaiter = waitQueue.firstOrNull()
        
        delegate.unlock(owner)
        
        session.send(MutexUnlocked(
            mutexId = mutexId,
            releaserId = coroutineId,
            nextWaiterId = nextWaiter,
            holdDurationNanos = calculateHoldDuration()
        ))
    }
    
    // ... other methods
}
```

### 5.2 VizSemaphore

```kotlin
class VizSemaphore(
    private val session: VizSession,
    permits: Int,
    val label: String? = null
) : Semaphore {
    
    private val semaphoreId = IdRegistry.nextSemaphoreId()
    private val delegate = Semaphore(permits)
    private val totalPermits = permits
    private val activeHolders = mutableListOf<String>()
    private val waitQueue = mutableListOf<String>()
    
    init {
        session.send(SemaphoreCreated(semaphoreId, label, permits))
    }
    
    override suspend fun acquire() {
        val coroutineId = currentCoroutineId()
        val available = delegate.availablePermits
        
        session.send(SemaphoreAcquireRequested(
            semaphoreId = semaphoreId,
            requesterId = coroutineId,
            requesterLabel = currentLabel(),
            availablePermits = available,
            permitsRequested = 1
        ))
        
        if (available == 0) {
            waitQueue.add(coroutineId)
            emitStateChanged()
        }
        
        val startWait = System.nanoTime()
        delegate.acquire()
        val waitDuration = System.nanoTime() - startWait
        
        waitQueue.remove(coroutineId)
        activeHolders.add(coroutineId)
        
        session.send(SemaphorePermitAcquired(
            semaphoreId = semaphoreId,
            acquirerId = coroutineId,
            remainingPermits = delegate.availablePermits,
            waitDurationNanos = waitDuration
        ))
        
        emitStateChanged()
    }
    
    override fun release() {
        val coroutineId = currentCoroutineId()
        activeHolders.remove(coroutineId)
        
        delegate.release()
        
        session.send(SemaphorePermitReleased(
            semaphoreId = semaphoreId,
            releaserId = coroutineId,
            newAvailablePermits = delegate.availablePermits,
            holdDurationNanos = calculateHoldDuration(coroutineId)
        ))
        
        emitStateChanged()
    }
    
    private fun emitStateChanged() {
        session.send(SemaphoreStateChanged(
            semaphoreId = semaphoreId,
            availablePermits = delegate.availablePermits,
            totalPermits = totalPermits,
            activeHolders = activeHolders.toList(),
            waitingCoroutines = waitQueue.toList()
        ))
    }
}
```

---

## 6. Validation

### 6.1 MutexValidator

```kotlin
class MutexValidator(private val recorder: EventRecorder) {
    
    fun verifyNoDeadlock() {
        val deadlocks = recorder.ofKind("DeadlockDetected")
        assertTrue(deadlocks.isEmpty()) { 
            "Deadlock detected: ${deadlocks.first()}" 
        }
    }
    
    fun verifyMutualExclusion(mutexId: String) {
        val events = recorder.forMutex(mutexId)
        var currentHolder: String? = null
        
        events.forEach { event ->
            when (event) {
                is MutexLockAcquired -> {
                    assertNull(currentHolder) { 
                        "Mutex held by $currentHolder when ${event.acquirerId} acquired" 
                    }
                    currentHolder = event.acquirerId
                }
                is MutexUnlocked -> {
                    assertEquals(currentHolder, event.releaserId) {
                        "Wrong releaser: expected $currentHolder, got ${event.releaserId}"
                    }
                    currentHolder = null
                }
            }
        }
    }
    
    fun verifyFairness(mutexId: String) {
        // Verify FIFO ordering in queue
        val requests = recorder.ofKind("MutexLockRequested")
            .filter { it.mutexId == mutexId }
        val acquisitions = recorder.ofKind("MutexLockAcquired")
            .filter { it.mutexId == mutexId }
        
        // Check that acquisition order matches request order for queued requests
        // (immediate acquisitions excluded)
        val queuedRequests = requests.filter { it.queuePosition > 0 }
        // ... validation logic
    }
}
```

### 6.2 SemaphoreValidator

```kotlin
class SemaphoreValidator(private val recorder: EventRecorder) {
    
    fun verifyPermitBounds(semaphoreId: String, maxPermits: Int) {
        val stateChanges = recorder.ofKind("SemaphoreStateChanged")
            .filter { it.semaphoreId == semaphoreId }
        
        stateChanges.forEach { state ->
            assertTrue(state.activeHolders.size <= maxPermits) {
                "Permit limit exceeded: ${state.activeHolders.size} > $maxPermits"
            }
            assertTrue(state.availablePermits >= 0) {
                "Negative permits: ${state.availablePermits}"
            }
        }
    }
    
    fun verifyNoLeaks(semaphoreId: String, totalPermits: Int) {
        val finalState = recorder.ofKind("SemaphoreStateChanged")
            .filter { it.semaphoreId == semaphoreId }
            .lastOrNull()
        
        assertNotNull(finalState)
        assertEquals(totalPermits, finalState.availablePermits) {
            "Permit leak: only ${finalState.availablePermits}/$totalPermits available"
        }
    }
}
```

---

## 7. Frontend Visualization Components

### 7.1 MutexVisualization Component

```typescript
interface MutexState {
  mutexId: string;
  label: string;
  isLocked: boolean;
  owner: CoroutineInfo | null;
  holdDuration: number;
  waitQueue: CoroutineInfo[];
}

const MutexVisualization: React.FC<{ mutex: MutexState }> = ({ mutex }) => {
  return (
    <Card className={mutex.isLocked ? 'border-red-500' : 'border-green-500'}>
      <CardHeader>
        <LockIcon className={mutex.isLocked ? 'text-red-500' : 'text-green-500'} />
        <span>{mutex.label || mutex.mutexId}</span>
      </CardHeader>
      <CardContent>
        {mutex.isLocked && (
          <div className="owner-info">
            <Badge variant="destructive">Locked</Badge>
            <span>Owner: {mutex.owner?.label}</span>
            <span>Hold time: {formatDuration(mutex.holdDuration)}</span>
          </div>
        )}
        {mutex.waitQueue.length > 0 && (
          <WaitQueue coroutines={mutex.waitQueue} />
        )}
      </CardContent>
    </Card>
  );
};
```

### 7.2 SemaphoreVisualization Component

```typescript
interface SemaphoreState {
  semaphoreId: string;
  label: string;
  totalPermits: number;
  availablePermits: number;
  activeHolders: CoroutineInfo[];
  waitQueue: CoroutineInfo[];
}

const SemaphoreVisualization: React.FC<{ semaphore: SemaphoreState }> = ({ semaphore }) => {
  const utilizationPercent = 
    ((semaphore.totalPermits - semaphore.availablePermits) / semaphore.totalPermits) * 100;
    
  return (
    <Card>
      <CardHeader>
        <span>{semaphore.label || semaphore.semaphoreId}</span>
        <Badge>{semaphore.availablePermits}/{semaphore.totalPermits}</Badge>
      </CardHeader>
      <CardContent>
        <PermitPool 
          total={semaphore.totalPermits} 
          available={semaphore.availablePermits} 
        />
        <ProgressBar value={utilizationPercent} />
        <HoldersList holders={semaphore.activeHolders} />
        {semaphore.waitQueue.length > 0 && (
          <WaitQueue coroutines={semaphore.waitQueue} />
        )}
      </CardContent>
    </Card>
  );
};
```

---

## 8. Summary

### Key Takeaways

1. **Mutex** = Single-access lock, suspending (not blocking)
2. **Semaphore** = Multi-permit resource limiter
3. **Deadlock detection** = Circular wait analysis
4. **Fair queuing** = FIFO order preservation

### Implementation Checklist

- [ ] `VizMutex` wrapper class
- [ ] `VizSemaphore` wrapper class
- [ ] Deadlock detection algorithm
- [ ] Lock/unlock event emission
- [ ] Wait queue tracking
- [ ] Frontend visualizations
- [ ] Test scenarios (10+ cases)
- [ ] Validator classes

### Event Types Summary

| Event | Description |
|-------|-------------|
| `MutexCreated` | New mutex instantiated |
| `MutexLockRequested` | Coroutine attempting to acquire |
| `MutexLockAcquired` | Lock successfully acquired |
| `MutexUnlocked` | Lock released |
| `MutexQueueChanged` | Wait queue updated |
| `SemaphoreCreated` | New semaphore instantiated |
| `SemaphoreAcquireRequested` | Permit requested |
| `SemaphorePermitAcquired` | Permit granted |
| `SemaphorePermitReleased` | Permit returned |
| `SemaphoreStateChanged` | Overall state update |
| `DeadlockDetected` | Circular wait found |
| `PotentialDeadlockWarning` | Risky pattern detected |

---

**End of Document**

