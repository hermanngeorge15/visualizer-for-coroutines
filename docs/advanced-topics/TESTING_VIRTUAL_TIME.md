# Testing Coroutines with Virtual Time

**Version:** 1.0  
**Date:** December 2025  
**Status:** Design Document

---

## Executive Summary

Testing coroutines with real delays would make tests **slow and flaky**. Kotlin provides **virtual time** through `TestDispatcher` that lets you control time precisely. This document covers how to visualize and understand virtual time testing.

**Key Concepts:**
- TestDispatcher & TestScope
- Virtual time advancement
- Eager vs lazy execution
- Time control visualization

---

## 1. The Problem with Real Time

### 1.1 Why Real Time is Bad for Tests

```kotlin
// ❌ BAD: This test takes 5 seconds!
@Test
fun `test with real delay`() = runBlocking {
    launch {
        delay(5000)  // Actually waits 5 seconds!
        doSomething()
    }
}

// ❌ BAD: Flaky due to timing
@Test
fun `flaky race condition test`() = runBlocking {
    var result = 0
    launch { delay(100); result = 1 }
    launch { delay(100); result = 2 }
    delay(150)
    // Which one wins? Depends on system load!
    assertEquals(???, result)
}
```

### 1.2 Virtual Time Solution

```kotlin
// ✅ GOOD: Instant and deterministic!
@Test
fun `test with virtual time`() = runTest {
    var completed = false
    launch {
        delay(5000)  // Virtual - doesn't actually wait!
        completed = true
    }
    
    advanceTimeBy(5000)  // Jump forward in virtual time
    assertTrue(completed)
}
// Test completes in milliseconds!
```

---

## 2. How Virtual Time Works

### 2.1 The TestDispatcher

```
┌─────────────────────────────────────────────────────────────┐
│                 TEST DISPATCHER                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              VIRTUAL CLOCK                               ││
│  │                                                          ││
│  │  currentTime: 5000ms                                     ││
│  │                                                          ││
│  │  ░░░░░░░░░░░░░░░░░░░░████████████████                   ││
│  │  0ms                 5000ms                              ││
│  │                         ▲                                ││
│  │                    You are here                          ││
│  │                                                          ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              SCHEDULED TASKS                             ││
│  │                                                          ││
│  │  Time      Task                        Status           ││
│  │  ─────────────────────────────────────────────────────  ││
│  │  1000ms    task-1: "fetch data"       ✅ Executed       ││
│  │  3000ms    task-2: "timeout check"    ✅ Executed       ││
│  │  5000ms    task-3: "retry"            ⏳ Ready          ││
│  │  10000ms   task-4: "cleanup"          📅 Scheduled      ││
│  │  15000ms   task-5: "periodic check"   📅 Scheduled      ││
│  │                                                          ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  Controls:                                                   │
│  [advanceTimeBy(1000)] [runCurrent] [advanceUntilIdle]     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Time Control Methods

| Method | What It Does |
|--------|-------------|
| `advanceTimeBy(ms)` | Move clock forward, execute due tasks |
| `advanceUntilIdle()` | Move clock until no more tasks |
| `runCurrent()` | Execute tasks at current time only |
| `currentTime` | Get current virtual time |
| `testScheduler.advanceTimeBy(ms)` | Direct scheduler control |

### 2.3 StandardTestDispatcher vs UnconfinedTestDispatcher

```kotlin
// StandardTestDispatcher - You control when tasks run
@Test
fun `explicit time control`() = runTest(StandardTestDispatcher()) {
    var executed = false
    launch {
        delay(1000)
        executed = true
    }
    
    // Task is scheduled but NOT executed yet
    assertFalse(executed)
    
    advanceTimeBy(1000)  // NOW it executes
    assertTrue(executed)
}

// UnconfinedTestDispatcher - Tasks run eagerly
@Test
fun `eager execution`() = runTest(UnconfinedTestDispatcher()) {
    var executed = false
    launch {
        executed = true  // Runs immediately!
    }
    assertTrue(executed)  // Already true!
}
```

---

## 3. Events to Track

### 3.1 Virtual Time Events

```kotlin
sealed class VirtualTimeEvent : VizEvent() {
    
    data class VirtualTimeAdvanced(
        val fromMs: Long,
        val toMs: Long,
        val advanceType: String,  // "advanceTimeBy", "advanceUntilIdle", "runCurrent"
        val tasksExecuted: Int
    ) : VirtualTimeEvent()
    
    data class TaskScheduled(
        val taskId: String,
        val scheduledForMs: Long,
        val currentTimeMs: Long,
        val delayMs: Long,
        val coroutineId: String,
        val description: String
    ) : VirtualTimeEvent()
    
    data class TaskExecuted(
        val taskId: String,
        val scheduledForMs: Long,
        val executedAtMs: Long,
        val coroutineId: String,
        val durationNanos: Long
    ) : VirtualTimeEvent()
    
    data class TaskCancelled(
        val taskId: String,
        val scheduledForMs: Long,
        val cancelledAtMs: Long,
        val reason: String
    ) : VirtualTimeEvent()
    
    data class IdleStateReached(
        val currentTimeMs: Long,
        val totalTasksExecuted: Int,
        val totalTimeAdvanced: Long
    ) : VirtualTimeEvent()
}
```

### 3.2 Test Progress Events

```kotlin
sealed class TestProgressEvent : VizEvent() {
    
    data class TestPhaseStarted(
        val phaseName: String,  // "setup", "action", "assertion"
        val virtualTimeMs: Long
    ) : TestProgressEvent()
    
    data class AssertionMade(
        val assertionType: String,
        val expected: String,
        val actual: String,
        val passed: Boolean,
        val virtualTimeMs: Long
    ) : TestProgressEvent()
    
    data class TimeJump(
        val fromMs: Long,
        val toMs: Long,
        val reason: String,  // "advanceTimeBy(5000)", "advanceUntilIdle"
        val skippedTasks: Int
    ) : TestProgressEvent()
}
```

---

## 4. Visualization Design

### 4.1 Virtual Timeline View

```
┌─────────────────────────────────────────────────────────────┐
│           VIRTUAL TIME TESTING                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Test: "retry with backoff"                                 │
│  Current Virtual Time: 2,300ms                              │
│                                                              │
│  ═══════════════════════════════════════════════════════════ │
│                    VIRTUAL TIMELINE                          │
│  ═══════════════════════════════════════════════════════════ │
│                                                              │
│  0ms        500ms       1000ms      2000ms      3000ms      │
│  │           │           │           │           │          │
│  ├───────────┼───────────┼───────────┼───────────┼──────    │
│  │           │           │           │           │          │
│  ▼           ▼           ▼           ▼                      │
│  START    attempt-1   attempt-2   attempt-3                 │
│            (fail)      (fail)      (pending)                │
│              │           │           │                      │
│              └─100ms─────┘           │                      │
│                   delay              │                      │
│                          └──200ms────┘                      │
│                              delay                          │
│                                                              │
│                                      ▲                      │
│                                 YOU ARE HERE                │
│                                 waiting for                 │
│                                 400ms delay                 │
│                                                              │
│  ═══════════════════════════════════════════════════════════ │
│                    SCHEDULED TASKS                           │
│  ═══════════════════════════════════════════════════════════ │
│                                                              │
│  📅 2700ms - retry attempt-3                                │
│  📅 5000ms - timeout (will cancel)                          │
│                                                              │
│  ═══════════════════════════════════════════════════════════ │
│  Controls:                                                   │
│  ═══════════════════════════════════════════════════════════ │
│                                                              │
│  [▶ advanceTimeBy: [____400_] ms]  [⏩ advanceUntilIdle]    │
│  [⏭ runCurrent]                    [🔄 Reset]               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Task Queue Visualization

```
┌─────────────────────────────────────────────────────────────┐
│           TASK SCHEDULER QUEUE                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Virtual Time: 1500ms                                        │
│                                                              │
│  PAST (executed)                                             │
│  ────────────────────────────────────────────────────────── │
│  ✅ 0ms     launch "initializer"                            │
│  ✅ 500ms   delay resumed in "worker-1"                     │
│  ✅ 1000ms  timeout check in "monitor"                      │
│                                                              │
│  PRESENT (current time)                                      │
│  ────────────────────────────────────────────────────────── │
│  ⏳ 1500ms  periodic emit in "ticker" ◀── READY TO RUN     │
│                                                              │
│  FUTURE (scheduled)                                          │
│  ────────────────────────────────────────────────────────── │
│  📅 2000ms  retry in "fetcher"                              │
│  📅 3000ms  cleanup in "cleaner"                            │
│  📅 5000ms  timeout in "guard"                              │
│  📅 10000ms repeat in "ticker"                              │
│                                                              │
│  [▶ Run Current (1 task)]  [⏩ Skip to 2000ms]              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 4.3 Time Jump Animation

```
Before advanceTimeBy(3000):
  │
  │  Current: 1000ms
  │  
  │  ●───────────────────────────────────────▶
  │  ▲
  │  │
  │  Time
  │

After advanceTimeBy(3000):
  │
  │  Current: 4000ms
  │  
  │  ●════════════════●──────────────────────▶
  │  │                ▲
  │  │       ┌────────┘
  │  │       │
  │  └───────┤ TIME JUMP!
  │          │ +3000ms
  │          │ 5 tasks executed
  │          └─────────────────
  │
```

---

## 5. Test Scenarios

### 5.1 Basic Time Control

```kotlin
@Test
fun `visualize time advancement`() = runTest {
    var checkpoints = mutableListOf<Pair<Long, String>>()
    
    vizLaunch("worker") {
        checkpoints.add(currentTime to "start")
        vizDelay(1000)
        checkpoints.add(currentTime to "after 1s")
        vizDelay(2000)
        checkpoints.add(currentTime to "after 3s")
    }
    
    // Nothing executed yet (StandardTestDispatcher)
    assertEquals(0, checkpoints.size)
    
    advanceTimeBy(1000)
    assertEquals(listOf(0L to "start", 1000L to "after 1s"), checkpoints)
    
    advanceTimeBy(2000)
    assertEquals(3, checkpoints.size)
}
```

**Expected Visualization:**
- Timeline showing virtual time at 0, 1000, 3000
- Tasks appearing and executing at scheduled times
- Time jump animation between advances

### 5.2 Testing Timeouts

```kotlin
@Test
fun `test timeout behavior`() = runTest {
    var result: String? = null
    
    vizLaunch("timed-operation") {
        result = withTimeoutOrNull(5000) {
            vizDelay(10000)  // Takes too long!
            "completed"
        }
    }
    
    // At 0ms - operation started
    advanceTimeBy(4999)
    assertNull(result)  // Still running
    
    advanceTimeBy(1)  // Now at 5000ms
    assertEquals(null, result)  // Timed out!
}
```

**Expected Visualization:**
- Show timeout countdown
- Highlight moment of timeout
- Show that inner delay was cancelled

### 5.3 Testing Retry Logic

```kotlin
@Test
fun `test retry with exponential backoff`() = runTest {
    var attempts = 0
    val delays = mutableListOf<Long>()
    
    vizLaunch("retry-test") {
        vizRetry(
            times = 4,
            initialDelayMs = 100,
            factor = 2.0
        ) {
            attempts++
            if (attempts < 4) {
                throw IOException("Simulated failure")
            }
            "success"
        }
    }
    
    // Advance through retries
    advanceTimeBy(100)   // After 1st retry delay
    assertEquals(2, attempts)
    
    advanceTimeBy(200)   // After 2nd retry delay (100 * 2)
    assertEquals(3, attempts)
    
    advanceTimeBy(400)   // After 3rd retry delay (200 * 2)
    assertEquals(4, attempts)
}
```

### 5.4 Testing Periodic Tasks

```kotlin
@Test
fun `test periodic execution`() = runTest {
    val ticks = mutableListOf<Long>()
    
    val job = vizLaunch("ticker") {
        while (isActive) {
            ticks.add(currentTime)
            vizDelay(1000)
        }
    }
    
    advanceTimeBy(3500)
    job.cancel()
    
    assertEquals(listOf(0L, 1000L, 2000L, 3000L), ticks)
}
```

**Expected Visualization:**
- Repeating pattern on timeline
- Each tick marked
- Cancellation point shown

---

## 6. Common Testing Patterns

### 6.1 Testing Race Conditions (Deterministically)

```kotlin
@Test
fun `deterministic race test`() = runTest {
    var winner = ""
    
    vizLaunch("racer-1") {
        vizDelay(100)
        winner = "racer-1"
    }
    
    vizLaunch("racer-2") {
        vizDelay(100)
        winner = "racer-2"
    }
    
    advanceUntilIdle()
    
    // With StandardTestDispatcher, order is deterministic!
    // First launched coroutine executes first when times are equal
    assertEquals("racer-2", winner)
}
```

### 6.2 Testing with TestScope

```kotlin
@Test
fun `using test scope directly`() = runTest {
    val viewModel = MyViewModel(
        scope = this,  // TestScope!
        repository = mockRepository
    )
    
    viewModel.loadData()
    
    // Advance time for debounce
    advanceTimeBy(300)
    
    // Check state
    assertEquals(LoadingState.Success, viewModel.state.value)
}
```

### 6.3 Testing Cancellation Timing

```kotlin
@Test
fun `test cancellation at specific time`() = runTest {
    var cancelled = false
    
    val job = vizLaunch("long-task") {
        try {
            vizDelay(10000)
        } catch (e: CancellationException) {
            cancelled = true
            throw e
        }
    }
    
    advanceTimeBy(5000)
    assertFalse(cancelled)
    
    job.cancel()
    runCurrent()  // Process cancellation
    
    assertTrue(cancelled)
    assertEquals(5000, currentTime)  // Time didn't advance
}
```

---

## 7. Wrapper Implementation

### 7.1 VizTestScope

```kotlin
class VizTestScope(
    private val session: VizSession,
    private val testScope: TestScope
) : TestScope by testScope {
    
    override fun advanceTimeBy(delayTimeMillis: Long) {
        val fromTime = currentTime
        
        session.send(VirtualTimeAdvanced(
            fromMs = fromTime,
            toMs = fromTime + delayTimeMillis,
            advanceType = "advanceTimeBy",
            tasksExecuted = 0  // Updated after
        ))
        
        testScope.advanceTimeBy(delayTimeMillis)
    }
    
    override fun advanceUntilIdle() {
        val fromTime = currentTime
        
        testScope.advanceUntilIdle()
        
        session.send(IdleStateReached(
            currentTimeMs = currentTime,
            totalTasksExecuted = calculateExecutedTasks(),
            totalTimeAdvanced = currentTime - fromTime
        ))
    }
    
    fun vizDelay(timeMillis: Long) {
        session.send(TaskScheduled(
            taskId = nextTaskId(),
            scheduledForMs = currentTime + timeMillis,
            currentTimeMs = currentTime,
            delayMs = timeMillis,
            coroutineId = currentCoroutineId(),
            description = "delay($timeMillis)"
        ))
        
        delay(timeMillis)
    }
}

fun vizRunTest(block: suspend VizTestScope.() -> Unit) = runTest {
    val session = VizSession("test-session")
    val vizScope = VizTestScope(session, this)
    vizScope.block()
}
```

---

## 8. Frontend Components

### 8.1 VirtualTimelineView

```typescript
interface VirtualTimeState {
  currentTimeMs: number;
  scheduledTasks: ScheduledTask[];
  executedTasks: ExecutedTask[];
  timeJumps: TimeJump[];
}

const VirtualTimelineView: React.FC<{ state: VirtualTimeState }> = ({ state }) => {
  const maxTime = Math.max(
    state.currentTimeMs,
    ...state.scheduledTasks.map(t => t.scheduledForMs)
  );
  
  return (
    <div className="virtual-timeline">
      <div className="time-axis">
        <TimeRuler maxTime={maxTime} currentTime={state.currentTimeMs} />
      </div>
      
      <div className="task-lanes">
        {/* Past tasks */}
        {state.executedTasks.map(task => (
          <TaskMarker 
            key={task.taskId}
            task={task}
            type="executed"
            position={task.executedAtMs / maxTime * 100}
          />
        ))}
        
        {/* Current time indicator */}
        <CurrentTimeIndicator position={state.currentTimeMs / maxTime * 100} />
        
        {/* Future tasks */}
        {state.scheduledTasks.map(task => (
          <TaskMarker
            key={task.taskId}
            task={task}
            type="scheduled"
            position={task.scheduledForMs / maxTime * 100}
          />
        ))}
      </div>
      
      <div className="controls">
        <TimeAdvanceControls />
      </div>
    </div>
  );
};
```

### 8.2 TimeAdvanceControls

```typescript
const TimeAdvanceControls: React.FC<{
  onAdvanceBy: (ms: number) => void;
  onAdvanceUntilIdle: () => void;
  onRunCurrent: () => void;
}> = ({ onAdvanceBy, onAdvanceUntilIdle, onRunCurrent }) => {
  const [advanceMs, setAdvanceMs] = useState(1000);
  
  return (
    <div className="time-controls">
      <div className="advance-by">
        <input 
          type="number" 
          value={advanceMs}
          onChange={e => setAdvanceMs(Number(e.target.value))}
        />
        <Button onClick={() => onAdvanceBy(advanceMs)}>
          ▶ Advance {advanceMs}ms
        </Button>
      </div>
      
      <Button onClick={onAdvanceUntilIdle}>
        ⏩ Advance Until Idle
      </Button>
      
      <Button onClick={onRunCurrent}>
        ⏭ Run Current Tasks
      </Button>
    </div>
  );
};
```

---

## 9. Summary

### Key Concepts

| Concept | Description |
|---------|-------------|
| **Virtual Time** | Simulated clock controlled by test |
| **TestDispatcher** | Dispatcher that uses virtual time |
| **advanceTimeBy** | Jump forward in virtual time |
| **advanceUntilIdle** | Run all scheduled tasks |
| **runCurrent** | Only run tasks at current time |
| **Deterministic** | Same test = same results |

### When to Use What

| Dispatcher | Use Case |
|------------|----------|
| `StandardTestDispatcher` | When you need precise time control |
| `UnconfinedTestDispatcher` | When you want eager execution |
| `runTest` | Default test runner (uses Standard) |

### Implementation Checklist

- [ ] VizTestScope wrapper
- [ ] Task scheduling visualization
- [ ] Time jump animation
- [ ] Timeline view component
- [ ] Time controls UI
- [ ] Test scenario examples
- [ ] Integration with existing VizScope

---

**End of Document**

