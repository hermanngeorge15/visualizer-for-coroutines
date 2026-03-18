# Select Expression & Multiplexing

**Version:** 1.0  
**Date:** December 2025  
**Status:** Design Document

---

## Executive Summary

The **select expression** in Kotlin coroutines allows waiting for multiple suspending operations simultaneously, completing when the first one succeeds. This is powerful for implementing timeouts, racing operations, and multiplexing channels.

**Key Use Cases:**
- Waiting on multiple channels
- Implementing timeouts
- Racing parallel operations
- First-response-wins patterns

---

## 1. Select Expression Fundamentals

### 1.1 Basic Concept

```kotlin
// Select completes when ANY clause succeeds
val result = select<String> {
    channel1.onReceive { value -> "Channel 1: $value" }
    channel2.onReceive { value -> "Channel 2: $value" }
    onTimeout(1000) { "Timeout!" }
}
```

### 1.2 Available Clauses

| Clause | Description |
|--------|-------------|
| `channel.onReceive { }` | Receive from channel |
| `channel.onReceiveCatching { }` | Receive with exception handling |
| `channel.onSend(value) { }` | Send to channel |
| `deferred.onAwait { }` | Await deferred result |
| `job.onJoin { }` | Wait for job completion |
| `onTimeout(time) { }` | Timeout clause |

### 1.3 Examples

```kotlin
// Racing two API calls
suspend fun fetchFastest(): Data = select {
    async { api1.fetch() }.onAwait { it }
    async { api2.fetch() }.onAwait { it }
}

// Timeout with fallback
suspend fun fetchWithFallback(): Data = select {
    async { slowApi.fetch() }.onAwait { it }
    onTimeout(5000) { cachedData }
}

// Multiplexing channels
suspend fun multiplex(ch1: Channel<Int>, ch2: Channel<Int>): Int = select {
    ch1.onReceive { it }
    ch2.onReceive { it }
}
```

---

## 2. Events to Track

### 2.1 Select Lifecycle Events

```kotlin
sealed class SelectEvent : VizEvent() {
    
    data class SelectStarted(
        val selectId: String,
        val label: String?,
        val coroutineId: String,
        val clauseCount: Int,
        val clauses: List<ClauseInfo>
    ) : SelectEvent()
    
    data class ClauseRegistered(
        val selectId: String,
        val clauseId: String,
        val clauseType: String,  // "onReceive", "onAwait", "onTimeout", etc.
        val targetDescription: String  // Channel name, Deferred label, etc.
    ) : SelectEvent()
    
    data class ClauseReady(
        val selectId: String,
        val clauseId: String,
        val readyAtNanos: Long
    ) : SelectEvent()
    
    data class ClauseSelected(
        val selectId: String,
        val clauseId: String,
        val clauseType: String,
        val selectionReason: String,  // "First ready", "Biased", etc.
        val waitDurationNanos: Long
    ) : SelectEvent()
    
    data class ClauseCancelled(
        val selectId: String,
        val clauseId: String,
        val reason: String  // "Another clause selected", "Select cancelled"
    ) : SelectEvent()
    
    data class SelectCompleted(
        val selectId: String,
        val selectedClauseId: String,
        val totalDurationNanos: Long,
        val cancelledClauses: Int
    ) : SelectEvent()
}

data class ClauseInfo(
    val clauseId: String,
    val type: String,
    val target: String
)
```

---

## 3. Visualization Design

### 3.1 Select Expression Overview

```
┌─────────────────────────────────────────────────────────────┐
│           SELECT: "first-response"                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Status: ⏳ WAITING    Duration: 234ms                       │
│                                                              │
│  ═══════════════════════════════════════════════════════════ │
│                      CLAUSES                                 │
│  ═══════════════════════════════════════════════════════════ │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ 1. onReceive(channel-A)                                 ││
│  │    Status: 🟡 WAITING                                    ││
│  │    Channel: "api-responses" (empty)                     ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ 2. onAwait(deferred-B)                                  ││
│  │    Status: 🟢 READY! ← Will be selected                 ││
│  │    Deferred: "backup-api" (completed)                   ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ 3. onTimeout(5000ms)                                    ││
│  │    Status: 🟡 WAITING                                    ││
│  │    Remaining: 4766ms                                    ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  ═══════════════════════════════════════════════════════════ │
│  ⚡ Clause 2 (onAwait) ready - selecting now...             │
│  ═══════════════════════════════════════════════════════════ │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Racing Visualization

```
┌─────────────────────────────────────────────────────────────┐
│           SELECT RACE: "fastest-api"                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ═══════════════════════════════════════════════════════════ │
│                     RACE PROGRESS                            │
│  ═══════════════════════════════════════════════════════════ │
│                                                              │
│                    START                    FINISH           │
│                      │                         │             │
│  api-1: ─────────────┼─────────────────────────┤             │
│         ████████████████████████░░░░░░░░░░░░░░░              │
│                      │              75%        │             │
│                      │                         │             │
│  api-2: ─────────────┼─────────────────────────┤─── 🏆       │
│         ████████████████████████████████████████  WINNER!   │
│                      │             100%        │             │
│                      │                         │             │
│  api-3: ─────────────┼─────────────────────────┤             │
│         ██████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░              │
│                      │    25%                  │             │
│                      │                         │             │
│  timeout: ───────────┼─────────────────────────┤             │
│         ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░              │
│                      │     0% (not needed)     │             │
│                                                              │
│  ═══════════════════════════════════════════════════════════ │
│  Result: api-2 won in 342ms                                  │
│  Cancelled: api-1, api-3 (saved resources!)                  │
│  ═══════════════════════════════════════════════════════════ │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 Channel Multiplexing

```
┌─────────────────────────────────────────────────────────────┐
│           MULTIPLEXER: "event-aggregator"                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ═══════════════════════════════════════════════════════════ │
│                    CHANNEL SOURCES                           │
│  ═══════════════════════════════════════════════════════════ │
│                                                              │
│    ┌──────────┐                                             │
│    │ chan-1   │──📨──┐                                      │
│    │ (clicks) │      │                                      │
│    └──────────┘      │     ┌──────────────┐                 │
│                      ├────▶│              │                 │
│    ┌──────────┐      │     │   SELECT     │────▶ Consumer   │
│    │ chan-2   │──────┤     │              │                 │
│    │ (keys)   │      │     └──────────────┘                 │
│    └──────────┘      │                                      │
│                      │                                      │
│    ┌──────────┐      │                                      │
│    │ chan-3   │──────┘                                      │
│    │ (timers) │                                             │
│    └──────────┘                                             │
│                                                              │
│  ═══════════════════════════════════════════════════════════ │
│                    SELECTION HISTORY                         │
│  ═══════════════════════════════════════════════════════════ │
│                                                              │
│  Time     Selected      Value                                │
│  ─────────────────────────────────────────────────────────── │
│  0ms      chan-2        KeyEvent("A")                        │
│  15ms     chan-1        ClickEvent(x=120, y=340)            │
│  45ms     chan-3        TimerEvent(tick=1)                   │
│  62ms     chan-1        ClickEvent(x=200, y=150)            │
│  ...                                                         │
│                                                              │
│  Stats: chan-1: 45%, chan-2: 30%, chan-3: 25%               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Test Scenarios

### 4.1 Basic Select - First Ready Wins

```kotlin
@Test
fun `select chooses first ready clause`() = runTest {
    val ch1 = Channel<Int>()
    val ch2 = Channel<Int>()
    
    // Send to ch2 first
    vizLaunch("sender") {
        vizDelay(100)
        ch2.send(42)
    }
    
    vizLaunch("selector") {
        val result = vizSelect<Int>("first-ready") {
            ch1.onReceive { it }
            ch2.onReceive { it }
        }
        
        assertEquals(42, result)
    }
    
    advanceTimeBy(200)
}
```

**Expected Events:**
1. `SelectStarted(clauses=2)`
2. `ClauseRegistered(onReceive, ch1)`
3. `ClauseRegistered(onReceive, ch2)`
4. `ClauseReady(ch2)` - when value sent
5. `ClauseSelected(ch2, "First ready")`
6. `ClauseCancelled(ch1, "Another clause selected")`
7. `SelectCompleted(selectedClause=ch2)`

### 4.2 Select with Timeout

```kotlin
@Test
fun `select times out when no clause ready`() = runTest {
    val slowChannel = Channel<String>()
    
    vizLaunch("selector") {
        val result = vizSelect<String>("with-timeout") {
            slowChannel.onReceive { it }
            onTimeout(500) { "timeout" }
        }
        
        assertEquals("timeout", result)
    }
    
    advanceTimeBy(600)
}
```

**Expected Events:**
1. `SelectStarted(clauses=2)`
2. `ClauseRegistered(onReceive, slowChannel)`
3. `ClauseRegistered(onTimeout, 500ms)`
4. `ClauseReady(timeout)` - at 500ms
5. `ClauseSelected(timeout)`
6. `ClauseCancelled(slowChannel)`
7. `SelectCompleted`

### 4.3 Racing Async Operations

```kotlin
@Test
fun `select races async operations`() = runTest {
    vizLaunch("racer") {
        val result = vizSelect<String>("api-race") {
            vizAsync("slow-api") {
                vizDelay(1000)
                "slow"
            }.onAwait { it }
            
            vizAsync("fast-api") {
                vizDelay(100)
                "fast"
            }.onAwait { it }
        }
        
        assertEquals("fast", result)
    }
    
    advanceTimeBy(200)
}
```

**Expected Visualization:**
- Two async operations racing
- Fast API finishes first
- Slow API cancelled (resource saved!)

### 4.4 Biased Select

```kotlin
@Test
fun `biased select prefers earlier clauses`() = runTest {
    val ch1 = Channel<Int>(Channel.UNLIMITED)
    val ch2 = Channel<Int>(Channel.UNLIMITED)
    
    // Both ready simultaneously
    ch1.send(1)
    ch2.send(2)
    
    vizLaunch("biased-selector") {
        val results = mutableListOf<Int>()
        
        repeat(2) {
            val result = vizSelectBiased<Int>("biased") {
                ch1.onReceive { it }
                ch2.onReceive { it }
            }
            results.add(result)
        }
        
        // Biased select always prefers ch1 when both ready
        assertEquals(listOf(1, 2), results)
    }
}
```

### 4.5 Channel Multiplexing Loop

```kotlin
@Test
fun `select multiplexes multiple channels`() = runTest {
    val events = Channel<String>(Channel.UNLIMITED)
    val clicks = Channel<String>()
    val keys = Channel<String>()
    val timers = Channel<String>()
    
    // Aggregator coroutine
    val aggregator = vizLaunch("aggregator") {
        while (isActive) {
            val event = vizSelect<String>("multiplex") {
                clicks.onReceiveCatching { it.getOrNull() ?: return@vizSelect "closed" }
                keys.onReceiveCatching { it.getOrNull() ?: return@vizSelect "closed" }
                timers.onReceiveCatching { it.getOrNull() ?: return@vizSelect "closed" }
            }
            events.send(event)
        }
    }
    
    // Simulate events
    vizLaunch("click-sender") {
        clicks.send("click-1")
        vizDelay(50)
        clicks.send("click-2")
    }
    
    vizLaunch("key-sender") {
        vizDelay(25)
        keys.send("key-A")
    }
    
    advanceTimeBy(100)
}
```

---

## 5. Advanced Patterns

### 5.1 Select with Retry

```kotlin
suspend fun fetchWithRetryAndTimeout(): Data = 
    retryWithBackoff(times = 3) {
        select {
            async { api.fetch() }.onAwait { it }
            onTimeout(5000) { throw TimeoutException() }
        }
    }
```

### 5.2 Fan-Out with Select

```kotlin
suspend fun fanOutToWorkers(
    work: List<Task>,
    workers: List<Channel<Task>>
) {
    for (task in work) {
        // Send to first available worker
        select {
            workers.forEachIndexed { i, worker ->
                worker.onSend(task) { 
                    println("Task sent to worker $i") 
                }
            }
        }
    }
}
```

### 5.3 Priority Select

```kotlin
suspend fun priorityReceive(
    highPriority: Channel<Event>,
    normalPriority: Channel<Event>,
    lowPriority: Channel<Event>
): Event = select {
    // Check high priority first (biased)
    highPriority.onReceive { it }
    normalPriority.onReceive { it }
    lowPriority.onReceive { it }
}
```

---

## 6. Wrapper Implementation

### 6.1 vizSelect

```kotlin
suspend inline fun <R> VizScope.vizSelect(
    label: String? = null,
    crossinline builder: SelectBuilder<R>.() -> Unit
): R {
    val selectId = IdRegistry.nextSelectId()
    val clauses = mutableListOf<ClauseInfo>()
    
    // Wrap the builder to capture clause registrations
    val wrappedBuilder: SelectBuilder<R>.() -> Unit = {
        val originalBuilder = this
        // Proxy to capture clause info
        // ... implementation details
    }
    
    session.send(SelectStarted(
        selectId = selectId,
        label = label,
        coroutineId = currentCoroutineId(),
        clauseCount = clauses.size,
        clauses = clauses
    ))
    
    val startTime = System.nanoTime()
    
    return try {
        select(builder).also { result ->
            session.send(SelectCompleted(
                selectId = selectId,
                selectedClauseId = getSelectedClauseId(),
                totalDurationNanos = System.nanoTime() - startTime,
                cancelledClauses = clauses.size - 1
            ))
        }
    } catch (e: Exception) {
        // Handle cancellation, etc.
        throw e
    }
}
```

### 6.2 Instrumented Clauses

```kotlin
// Extension to track onReceive
fun <E, R> SelectBuilder<R>.vizOnReceive(
    channel: ReceiveChannel<E>,
    session: VizSession,
    selectId: String,
    block: suspend (E) -> R
) {
    val clauseId = IdRegistry.nextClauseId()
    
    session.send(ClauseRegistered(
        selectId = selectId,
        clauseId = clauseId,
        clauseType = "onReceive",
        targetDescription = channel.toString()
    ))
    
    channel.onReceive { value ->
        session.send(ClauseSelected(
            selectId = selectId,
            clauseId = clauseId,
            clauseType = "onReceive",
            selectionReason = "Channel had value",
            waitDurationNanos = 0  // Would need timing
        ))
        block(value)
    }
}

// Extension to track onAwait
fun <T, R> SelectBuilder<R>.vizOnAwait(
    deferred: Deferred<T>,
    session: VizSession,
    selectId: String,
    block: suspend (T) -> R
) {
    val clauseId = IdRegistry.nextClauseId()
    
    session.send(ClauseRegistered(
        selectId = selectId,
        clauseId = clauseId,
        clauseType = "onAwait",
        targetDescription = deferred.toString()
    ))
    
    deferred.onAwait { value ->
        session.send(ClauseSelected(
            selectId = selectId,
            clauseId = clauseId,
            clauseType = "onAwait",
            selectionReason = "Deferred completed",
            waitDurationNanos = 0
        ))
        block(value)
    }
}

// Extension to track onTimeout
fun <R> SelectBuilder<R>.vizOnTimeout(
    timeMillis: Long,
    session: VizSession,
    selectId: String,
    block: suspend () -> R
) {
    val clauseId = IdRegistry.nextClauseId()
    
    session.send(ClauseRegistered(
        selectId = selectId,
        clauseId = clauseId,
        clauseType = "onTimeout",
        targetDescription = "${timeMillis}ms"
    ))
    
    onTimeout(timeMillis) {
        session.send(ClauseSelected(
            selectId = selectId,
            clauseId = clauseId,
            clauseType = "onTimeout",
            selectionReason = "Timeout elapsed",
            waitDurationNanos = timeMillis * 1_000_000
        ))
        block()
    }
}
```

---

## 7. Validation

### 7.1 SelectValidator

```kotlin
class SelectValidator(private val recorder: EventRecorder) {
    
    fun verifyOnlyOneClauseSelected(selectId: String) {
        val selected = recorder.ofKind("ClauseSelected")
            .filter { it.selectId == selectId }
        
        assertEquals(1, selected.size) {
            "Select should have exactly one selected clause, found ${selected.size}"
        }
    }
    
    fun verifyOtherClausesCancelled(selectId: String) {
        val started = recorder.ofKind("SelectStarted")
            .first { it.selectId == selectId }
        
        val cancelled = recorder.ofKind("ClauseCancelled")
            .filter { it.selectId == selectId }
        
        assertEquals(started.clauseCount - 1, cancelled.size) {
            "All non-selected clauses should be cancelled"
        }
    }
    
    fun verifyTimeoutRespected(selectId: String, expectedTimeoutMs: Long, toleranceMs: Long = 50) {
        val started = recorder.ofKind("SelectStarted")
            .first { it.selectId == selectId }
        
        val completed = recorder.ofKind("SelectCompleted")
            .first { it.selectId == selectId }
        
        val durationMs = (completed.totalDurationNanos / 1_000_000)
        
        if (completed.selectedClauseType == "onTimeout") {
            assertTrue(durationMs >= expectedTimeoutMs - toleranceMs) {
                "Timeout should not fire early"
            }
            assertTrue(durationMs <= expectedTimeoutMs + toleranceMs) {
                "Timeout should not fire late"
            }
        }
    }
    
    fun verifyBiasedSelection(selectId: String) {
        // For biased select with multiple ready clauses,
        // verify first clause in order was selected
        val clauses = recorder.ofKind("ClauseRegistered")
            .filter { it.selectId == selectId }
            .sortedBy { it.tsNanos }
        
        val readyClauses = recorder.ofKind("ClauseReady")
            .filter { it.selectId == selectId }
            .map { it.clauseId }
            .toSet()
        
        val selected = recorder.ofKind("ClauseSelected")
            .first { it.selectId == selectId }
        
        if (readyClauses.size > 1) {
            val firstReadyClause = clauses.first { it.clauseId in readyClauses }
            assertEquals(firstReadyClause.clauseId, selected.clauseId) {
                "Biased select should choose first registered ready clause"
            }
        }
    }
}
```

---

## 8. Frontend Components

### 8.1 SelectVisualization

```typescript
interface SelectState {
  selectId: string;
  label: string;
  status: 'waiting' | 'selected' | 'completed' | 'cancelled';
  clauses: ClauseState[];
  selectedClauseId: string | null;
  durationMs: number;
}

interface ClauseState {
  clauseId: string;
  type: 'onReceive' | 'onAwait' | 'onTimeout' | 'onSend';
  target: string;
  status: 'waiting' | 'ready' | 'selected' | 'cancelled';
  waitTimeMs: number;
}

const SelectVisualization: React.FC<{ select: SelectState }> = ({ select }) => {
  return (
    <Card className="select-visualization">
      <CardHeader>
        <SelectIcon />
        <span className="font-bold">{select.label || select.selectId}</span>
        <StatusBadge status={select.status} />
      </CardHeader>
      
      <CardContent>
        <div className="clauses-list">
          {select.clauses.map((clause, index) => (
            <ClauseCard 
              key={clause.clauseId} 
              clause={clause}
              index={index}
              isSelected={clause.clauseId === select.selectedClauseId}
            />
          ))}
        </div>
        
        {select.status === 'completed' && (
          <div className="completion-info">
            <span>Duration: {select.durationMs}ms</span>
            <span>Winner: {select.selectedClauseId}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
```

### 8.2 RaceVisualization

```typescript
const RaceVisualization: React.FC<{ 
  participants: RaceParticipant[];
  winnerId: string | null;
}> = ({ participants, winnerId }) => {
  return (
    <div className="race-visualization">
      {participants.map(participant => (
        <div 
          key={participant.id}
          className={cn(
            "race-lane",
            participant.id === winnerId && "winner"
          )}
        >
          <span className="name">{participant.label}</span>
          <ProgressBar 
            value={participant.progress} 
            color={participant.id === winnerId ? 'green' : 'blue'}
          />
          {participant.id === winnerId && <Trophy className="winner-icon" />}
          {participant.status === 'cancelled' && <XMark className="cancelled-icon" />}
        </div>
      ))}
    </div>
  );
};
```

---

## 9. Summary

### Key Concepts

| Concept | Description |
|---------|-------------|
| **select** | Wait for first clause to succeed |
| **Clauses** | onReceive, onAwait, onTimeout, onSend |
| **Biased** | selectUnbiased vs select (biased) |
| **Racing** | Multiple async operations, first wins |
| **Multiplexing** | Aggregate multiple channels |

### Implementation Checklist

- [ ] `vizSelect` wrapper function
- [ ] `vizOnReceive` clause wrapper
- [ ] `vizOnAwait` clause wrapper
- [ ] `vizOnTimeout` clause wrapper
- [ ] `vizOnSend` clause wrapper
- [ ] `vizSelectUnbiased` variant
- [ ] Select lifecycle events
- [ ] Clause tracking events
- [ ] Race visualization
- [ ] Multiplexer visualization
- [ ] SelectValidator
- [ ] Test scenarios (8+ cases)

### Event Types Summary

| Event | Description |
|-------|-------------|
| `SelectStarted` | Select expression begins |
| `ClauseRegistered` | Clause added to select |
| `ClauseReady` | Clause can proceed |
| `ClauseSelected` | Clause won the race |
| `ClauseCancelled` | Clause lost/cancelled |
| `SelectCompleted` | Select finished |

---

**End of Document**

