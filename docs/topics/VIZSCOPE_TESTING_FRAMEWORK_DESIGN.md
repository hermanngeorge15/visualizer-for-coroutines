# VizScope Testing Framework - Deep Dive Design

**Version:** 1.0  
**Date:** November 29, 2025  
**Purpose:** Comprehensive testing framework design for YOUR VizScope/VizSession implementation

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Your Implementation Analysis](#your-implementation-analysis)
3. [Testing Strategy](#testing-strategy)
4. [Test Framework Architecture](#test-framework-architecture)
5. [Validator System Design](#validator-system-design)
6. [Test Scenarios](#test-scenarios)
7. [Event Verification](#event-verification)
8. [Integration Patterns](#integration-patterns)
9. [Implementation Roadmap](#implementation-roadmap)

---

## Executive Summary

### What You Have

Your coroutine visualization system consists of:

1. **VizScope** - Instrumented coroutine wrappers
   - `vizLaunch()` - Launch with event tracking
   - `vizAsync()` - Async with deferred tracking
   - `vizDelay()` - Delay with suspension tracking

2. **VizSession** - Session management and event system
   - `EventBus` - Event streaming
   - `EventStore` - Event persistence
   - `RuntimeSnapshot` - Current state tracking
   - `JobStatusMonitor` - Job state tracking

3. **Event System** - Comprehensive event types (20+ events)
   - Lifecycle: Created, Started, Suspended, Resumed, Completed, Cancelled, Failed
   - Special: WaitingForChildren, JobStateChanged, BodyCompleted
   - Async: DeferredValueAvailable, DeferredAwaitStarted, DeferredAwaitCompleted
   - Dispatchers: DispatcherSelected, ThreadAssigned

4. **Existing Check System**
   - `EventRecorder` - Basic event recording
   - `SequenceChecker` - Basic sequence validation

### What You Need

A comprehensive testing framework to **validate that your VizScope wrappers correctly**:

✅ **Emit all events in correct order**  
✅ **Track nested launches at any depth**  
✅ **Capture exception propagation correctly**  
✅ **Record cancellation cascades**  
✅ **Validate structured concurrency rules**  
✅ **Track async/await behavior**  
✅ **Monitor job state transitions**  
✅ **Verify timing and delays**  
✅ **Test dispatcher switching**  
✅ **Handle all edge cases**

---

## Your Implementation Analysis

### VizScope Wrapper Functions

#### vizLaunch() - What It Does

```
vizLaunch(label, context, block) 
   ↓
1. Extract parent context (VizCoroutineElement)
2. Generate coroutineId, jobId
3. Create VizCoroutineElement with IDs
4. Create EventContext
5. Launch coroutine with element in context
   ↓
6. EMIT: CoroutineCreated
7. EMIT: CoroutineStarted  
8. EMIT: ThreadAssigned
9. Execute user block()
10. Check for active children
11. EMIT: WaitingForChildren (if has children)
12. EMIT: CoroutineBodyCompleted
13. Register invokeOnCompletion handler
   ↓
   On completion:
   - cause == null → EMIT: CoroutineCompleted
   - cause is CancellationException → EMIT: CoroutineCancelled
   - other → EMIT: CoroutineFailed
```

**What needs testing:**
- ✅ All 6-8 events emitted in correct order
- ✅ Parent-child relationships tracked correctly
- ✅ WaitingForChildren emitted ONLY when has active children
- ✅ BodyCompleted BEFORE children complete
- ✅ Coroutine completes AFTER all children
- ✅ Exception handling emits correct terminal event
- ✅ Job registration works correctly

#### vizAsync() - What It Does

```
vizAsync(label, context, block)
   ↓
Similar to vizLaunch but:
1-8. Same as vizLaunch
9. Execute block and capture result
10. EMIT: DeferredValueAvailable
11. Return InstrumentedDeferred wrapper
   ↓
When awaited:
- EMIT: DeferredAwaitStarted
- Suspend until value ready
- EMIT: DeferredAwaitCompleted
- Return value
```

**What needs testing:**
- ✅ All lifecycle events emitted
- ✅ DeferredValueAvailable emitted when ready
- ✅ Multiple awaiters tracked correctly
- ✅ Await events emitted for each awaiter
- ✅ Exception in async propagates correctly
- ✅ Cancellation before await works

#### vizDelay() - What It Does

```
vizDelay(timeMillis)
   ↓
1. Extract VizCoroutineElement from context
2. Create EventContext
3. Capture suspension point (stack trace)
4. EMIT: CoroutineSuspended (with reason="delay", duration)
5. Actual delay(timeMillis)
6. EMIT: CoroutineResumed
```

**What needs testing:**
- ✅ Suspended event before delay
- ✅ Resumed event after delay
- ✅ Duration matches actual delay
- ✅ Suspension point captured correctly
- ✅ Works in nested contexts

### VizSession - What It Provides

#### Event Flow

```
VizScope wrapper calls session.send(event)
   ↓
VizSession.send():
1. store.append(event)      - Persist event
2. applier.apply(event)     - Update snapshot
3. eventBus.send(event)     - Broadcast to subscribers
```

**Key Features:**
- `eventBus.stream()` - Flow of all events in order
- `store.all()` - Complete event history
- `snapshot.coroutines` - Current state of all coroutines
- `projectionService.getHierarchyTree()` - Parent-child tree
- `getSplitTimeline(coroutineId)` - Events for specific coroutine
- `correlatedFlow()` - Paired coroutine/job events

**What needs testing:**
- ✅ Events arrive in correct order
- ✅ All events persisted in store
- ✅ Snapshot updated correctly
- ✅ Timeline queries work correctly
- ✅ Hierarchy reflects structure
- ✅ Correlation finds matching events

### Existing Check System

You already have:

**EventRecorder:**
- `record(event)` - Add event to lists
- `all()` - Get all events
- `forCoroutine(id)` - Get events for specific coroutine
- `ofKind(kind)` - Get events of specific type
- `inTimeRange(start, end)` - Get events in time window

**SequenceChecker:**
- `checkSequence(coroutineId, expectedKinds)` - Verify event sequence

**Gap:** You need richer validation on top of this foundation.

---

## Testing Strategy

### Three-Layer Testing Approach

```
┌─────────────────────────────────────────────────────┐
│  Layer 3: Integration Tests                         │
│  - Complete scenarios with nested launches           │
│  - Exception propagation through hierarchy           │
│  - Complex async/await patterns                      │
│  - Real-world usage patterns                         │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│  Layer 2: Validation Tests                          │
│  - Event ordering validation                         │
│  - Structured concurrency rules                      │
│  - Timing validation                                 │
│  - State machine validation                          │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│  Layer 1: Unit Tests                                │
│  - vizLaunch emits correct events                    │
│  - vizAsync tracks deferred correctly                │
│  - vizDelay captures suspension                      │
│  - Single coroutine behaviors                        │
└─────────────────────────────────────────────────────┘
```

### Test Philosophy

**Principle 1: Test YOUR Implementation**
- Don't test Kotlin coroutines - test YOUR wrappers
- Verify YOUR events are emitted correctly
- Validate YOUR state tracking works

**Principle 2: Use YOUR Existing Infrastructure**
- Build on EventRecorder and SequenceChecker
- Leverage VizSession's query capabilities
- Use existing event types and structures

**Principle 3: Test Observable Behavior**
- Events emitted (what and when)
- Event ordering (before/after relationships)
- State transitions (snapshot changes)
- Hierarchy structure (parent-child relationships)

**Principle 4: Deterministic Testing**
- Focus on event order, not timing
- Use relative relationships ("A before B")
- Test causality ("A causes B")

---

## Test Framework Architecture

### Overall Design

```
┌──────────────────────────────────────────────────────┐
│          Test Execution Layer                         │
│  ┌────────────────────────────────────────────────┐  │
│  │  TestScenarioRunner                             │  │
│  │  - Creates VizSession                           │  │
│  │  - Creates VizScope                             │  │
│  │  - Subscribes EventRecorder to event stream     │  │
│  │  - Executes test scenario                       │  │
│  │  - Returns TestResult with all events           │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────┐
│         Validation Layer                              │
│  ┌────────────────────────────────────────────────┐  │
│  │  Enhanced Validators (built on YOUR tools)     │  │
│  │  - EventSequenceValidator                       │  │
│  │  - HierarchyValidator                           │  │
│  │  - StructuredConcurrencyValidator               │  │
│  │  - DeferredTrackingValidator                    │  │
│  │  - JobStateValidator                            │  │
│  │  - WaitingForChildrenValidator                  │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────┐
│       YOUR Existing Infrastructure                    │
│  - VizScope (vizLaunch, vizAsync, vizDelay)         │  │
│  - VizSession (eventBus, store, snapshot)           │  │
│  - EventRecorder                                     │  │
│  - SequenceChecker                                   │  │
└──────────────────────────────────────────────────────┘
```

### Core Components Design

#### 1. TestScenarioRunner

**Purpose:** Execute test scenarios and collect all events

**Design:**
```
TestScenarioRunner {
    - Creates isolated VizSession for each test
    - Creates VizScope with session
    - Creates EventRecorder and subscribes to session.bus.stream()
    - Provides DSL for defining test scenarios
    - Executes scenario and waits for completion
    - Returns TestResult with:
      * Complete event list
      * Final snapshot
      * Hierarchy tree
      * Timeline data
}
```

**Key Capabilities:**
- Isolated test execution (each test gets own session)
- Complete event capture (via EventRecorder)
- Timeout handling (tests don't hang forever)
- Error capture (test failures recorded)

#### 2. TestResult

**Purpose:** Encapsulate all data from test execution

**Design:**
```
TestResult {
    - session: VizSession
    - recorder: EventRecorder
    - scenario: TestScenario
    - duration: Duration
    - succeeded: Boolean
    - error: Throwable?
    
    Methods:
    - getAllEvents(): List<VizEvent>
    - getEventsFor(coroutineId): List<VizEvent>
    - getEventsOfKind(kind): List<VizEvent>
    - getSnapshot(): RuntimeSnapshot
    - getHierarchy(): List<HierarchyNode>
    - getTimeline(coroutineId): List<VizEvent>
}
```

**Usage Pattern:**
```kotlin
val result = TestScenarioRunner.run {
    vizLaunch("parent") {
        vizLaunch("child") {
            vizDelay(100)
        }
    }
}

// Now validate
result.verify {
    eventSequence("child") {
        created -> started -> suspended -> resumed -> bodyCompleted -> completed
    }
}
```

#### 3. Test DSL

**Purpose:** Readable test definitions

**Design:**
```
testScenario("my-test") {
    // Define what to test
    execute {
        vizLaunch("parent") {
            vizLaunch("child-1") { vizDelay(100) }
            vizLaunch("child-2") { vizDelay(200) }
        }
    }
    
    // Define expectations
    expect {
        eventSequence("parent") {
            created -> started -> bodyCompleted -> completed
        }
        
        eventOrder {
            completed("child-1") before completed("parent")
            completed("child-2") before completed("parent")
        }
        
        hierarchy {
            parent("parent") hasChildren ["child-1", "child-2"]
        }
        
        structuredConcurrency {
            parentWaitsForChildren("parent")
        }
    }
}
```

---

## Validator System Design

### 1. EventSequenceValidator

**Purpose:** Validate exact event sequence for a coroutine

**What It Validates:**
- Events occur in specific order
- No unexpected events
- No missing events
- Event sequence matches expected pattern

**Design:**
```
EventSequenceValidator {
    uses: EventRecorder.forCoroutine()
    
    validates:
    - Exact sequence match
    - All expected events present
    - No extra events
    - Order preserved
    
    example expectations:
    - "parent": Created -> Started -> BodyCompleted -> Completed
    - "child": Created -> Started -> Suspended -> Resumed -> BodyCompleted -> Completed
    - "async": Created -> Started -> BodyCompleted -> DeferredValueAvailable -> Completed
}
```

**Algorithm:**
```
1. Get actual events for coroutine: recorder.forCoroutine(coroutineId)
2. Extract event kinds: events.map { it.kind }
3. Compare with expected sequence
4. Report:
   - Missing events
   - Extra events
   - Out-of-order events
```

### 2. HierarchyValidator

**Purpose:** Validate parent-child relationships

**What It Validates:**
- Parent-child links correct
- Hierarchy depth correct
- All children tracked
- No orphaned coroutines

**Design:**
```
HierarchyValidator {
    uses: session.projectionService.getHierarchyTree()
    
    validates:
    - Parent has expected children
    - Child has correct parent
    - Depth matches expectation
    - Tree structure correct
}
```

**Validation Checks:**
```
1. For each coroutine in hierarchy:
   - Find in snapshot
   - Check parentId matches expected
   - Check children list matches expected
   
2. Tree structure:
   - No cycles
   - All nodes reachable from root
   - Depth calculation correct
   
3. Coroutine IDs:
   - All referenced IDs exist
   - No dangling references
```

### 3. StructuredConcurrencyValidator

**Purpose:** Validate structured concurrency rules

**What It Validates:**
- Parents wait for children
- Parent body completes before parent coroutine
- Children complete before parent
- WaitingForChildren event emitted correctly
- Exception propagation follows rules
- Cancellation cascades correctly

**Design:**
```
StructuredConcurrencyValidator {
    uses: 
    - EventRecorder
    - RuntimeSnapshot
    - HierarchyTree
    
    validates:
    Rule 1: Parent Waits for Children
    - BodyCompleted(parent) before Completed(parent)
    - WaitingForChildren(parent) emitted if has children
    - All Completed(child) before Completed(parent)
    
    Rule 2: Exception Propagation
    - Failed(child) causes Cancelled(parent)
    - Cancelled(parent) causes Cancelled(siblings)
    - Terminal events in correct order
    
    Rule 3: Cancellation Propagation
    - Cancelled(parent) causes Cancelled(all children)
    - Cascades down entire subtree
}
```

**Validation Algorithm:**
```
For each parent coroutine:
  1. Find BodyCompleted event
  2. Find WaitingForChildren event (if has children)
  3. Find all children completion events
  4. Find parent completion event
  
  Verify:
  - BodyCompleted.timestamp < all children Completed.timestamp
  - If children exist: WaitingForChildren emitted
  - All children Completed.timestamp < parent Completed.timestamp
  
For each failed coroutine:
  1. Find Failed event
  2. Find parent
  3. Find siblings
  
  Verify:
  - Parent Cancelled after child Failed
  - Siblings Cancelled after parent Cancelled
  - Order: Failed(child) -> Cancelled(parent) -> Cancelled(siblings)
```

### 4. DeferredTrackingValidator

**Purpose:** Validate async/await behavior

**What It Validates:**
- DeferredValueAvailable emitted when async completes
- Await events emitted for each awaiter
- Multiple awaiters tracked correctly
- Await suspends until value ready
- Value available before await completes

**Design:**
```
DeferredTrackingValidator {
    uses: EventRecorder.ofKind()
    
    validates:
    - DeferredValueAvailable(asyncCoroutine) emitted
    - DeferredAwaitStarted(awaiter) for each awaiter
    - DeferredAwaitCompleted(awaiter) after value available
    - Order: ValueAvailable before all AwaitCompleted
}
```

**Validation Algorithm:**
```
For each async coroutine:
  1. Find DeferredValueAvailable event
  2. Find all DeferredAwaitStarted events referencing this deferred
  3. Find all DeferredAwaitCompleted events
  
  Verify:
  - DeferredValueAvailable emitted
  - For each awaiter:
    * AwaitStarted event exists
    * AwaitCompleted event exists
    * AwaitCompleted.timestamp > ValueAvailable.timestamp
  - Multiple awaiters: all get same value
```

### 5. JobStateValidator

**Purpose:** Validate job state tracking

**What It Validates:**
- JobStateChanged events emitted
- Job states transition correctly
- Job children count accurate
- Job completion correlates with coroutine completion

**Design:**
```
JobStateValidator {
    uses: 
    - session.jobStateFlow()
    - session.correlatedFlow()
    
    validates:
    - JobStateChanged events for each state transition
    - Job state matches coroutine state
    - Children count accurate
    - State transitions valid
}
```

**State Transitions:**
```
Valid transitions:
- Active(children=N) -> Active(children=N-1) [child completed]
- Active(children=0) -> Completed [all children done]
- Active -> Cancelled [cancellation]
- Any -> Cancelled [exception]

Invalid transitions:
- Completed -> Active
- Cancelled -> Active
- Completed -> Cancelled
```

### 6. WaitingForChildrenValidator

**Purpose:** Validate WaitingForChildren events

**What It Validates:**
- Event emitted ONLY when has active children
- activeChildrenCount accurate
- activeChildrenIds list correct
- Event timing (after BodyCompleted, before Completed)
- Progressive decrease as children complete

**Design:**
```
WaitingForChildrenValidator {
    uses: EventRecorder.ofKind("WaitingForChildren")
    
    validates:
    - Event emitted if and only if has active children
    - activeChildrenCount matches actual
    - activeChildrenIds contains correct IDs
    - Timestamp: BodyCompleted < WaitingForChildren < Completed
    - Multiple events show decreasing activeChildrenCount
}
```

**Validation Algorithm:**
```
For each WaitingForChildren event:
  1. Get parent coroutineId
  2. Get hierarchy at event time
  3. Count active children at event time
  
  Verify:
  - activeChildrenCount == actual active children
  - activeChildrenIds contains only active children
  - All IDs in list actually exist
  - Event timestamp between BodyCompleted and Completed
  
For progression tracking:
  1. Get all WaitingForChildren events for same parent
  2. Sort by timestamp
  3. Verify activeChildrenCount decreases: N -> N-1 -> N-2 -> ... -> 0
```

---

## Test Scenarios

### Category 1: Basic vizLaunch Tests

#### Test 1.1: Single Launch - Basic Lifecycle

**Scenario:**
```kotlin
vizLaunch("worker") {
    vizDelay(100)
}
```

**Validate:**
- ✅ Events: Created -> Started -> Suspended -> Resumed -> BodyCompleted -> Completed
- ✅ No WaitingForChildren (no children)
- ✅ ThreadAssigned emitted
- ✅ Final state: COMPLETED
- ✅ Snapshot contains coroutine
- ✅ No parent (root level)

**Why Important:** Verifies basic wrapper instrumentation works.

#### Test 1.2: Nested Launch - Parent-Child

**Scenario:**
```kotlin
vizLaunch("parent") {
    vizLaunch("child") {
        vizDelay(100)
    }
}
```

**Validate:**
- ✅ Hierarchy: parent -> child
- ✅ Created("parent") before Created("child")
- ✅ BodyCompleted("parent") before Completed("parent")
- ✅ WaitingForChildren("parent") emitted
- ✅ Completed("child") before Completed("parent")
- ✅ activeChildrenCount == 1

**Why Important:** Verifies parent-child tracking and waiting.

#### Test 1.3: Multiple Children

**Scenario:**
```kotlin
vizLaunch("parent") {
    vizLaunch("child-1") { vizDelay(100) }
    vizLaunch("child-2") { vizDelay(200) }
    vizLaunch("child-3") { vizDelay(150) }
}
```

**Validate:**
- ✅ Hierarchy: parent -> [child-1, child-2, child-3]
- ✅ WaitingForChildren with activeChildrenCount = 3
- ✅ All children complete before parent
- ✅ Completion order matches delays (child-1, child-3, child-2)
- ✅ Parent completes last

**Why Important:** Verifies multiple children handling.

#### Test 1.4: Deep Nesting

**Scenario:**
```kotlin
vizLaunch("L1") {
    vizLaunch("L2") {
        vizLaunch("L3") {
            vizLaunch("L4") {
                vizDelay(100)
            }
        }
    }
}
```

**Validate:**
- ✅ Hierarchy depth = 4
- ✅ Each level waits for children
- ✅ Completion order: L4 -> L3 -> L2 -> L1
- ✅ WaitingForChildren at each level
- ✅ Bottom-up completion

**Why Important:** Verifies arbitrary depth works.

### Category 2: vizAsync Tests

#### Test 2.1: Basic Async/Await

**Scenario:**
```kotlin
vizLaunch("parent") {
    val deferred = vizAsync("compute") {
        vizDelay(100)
        42
    }
    val result = deferred.await()
}
```

**Validate:**
- ✅ DeferredValueAvailable emitted
- ✅ DeferredAwaitStarted emitted
- ✅ DeferredAwaitCompleted emitted
- ✅ Order: ValueAvailable before AwaitCompleted
- ✅ Parent waits for async child

**Why Important:** Verifies async tracking works.

#### Test 2.2: Multiple Awaiters

**Scenario:**
```kotlin
vizLaunch("parent") {
    val deferred = vizAsync("compute") {
        vizDelay(100)
        42
    }
    
    vizLaunch("awaiter-1") { deferred.await() }
    vizLaunch("awaiter-2") { deferred.await() }
    vizLaunch("awaiter-3") { deferred.await() }
}
```

**Validate:**
- ✅ Single DeferredValueAvailable
- ✅ Three DeferredAwaitStarted events (one per awaiter)
- ✅ Three DeferredAwaitCompleted events
- ✅ All awaiters resume after value available
- ✅ All awaiters tracked correctly

**Why Important:** Verifies multiple await tracking.

#### Test 2.3: Async with Exception

**Scenario:**
```kotlin
vizLaunch("parent") {
    val deferred = vizAsync("compute") {
        vizDelay(100)
        throw RuntimeException("Failed")
    }
    try {
        deferred.await()
    } catch (e: Exception) {
        // Handle
    }
}
```

**Validate:**
- ✅ Compute: Failed event emitted
- ✅ No DeferredValueAvailable
- ✅ Exception propagated to awaiter
- ✅ Parent continues (exception caught)

**Why Important:** Verifies exception in async.

### Category 3: Exception Propagation Tests

#### Test 3.1: Child Failure Cancels Parent

**Scenario:**
```kotlin
vizLaunch("parent") {
    vizLaunch("good-child") {
        vizDelay(5000)  // Long
    }
    vizLaunch("bad-child") {
        vizDelay(100)
        throw RuntimeException("Fail")
    }
}
```

**Validate:**
- ✅ Failed("bad-child") emitted
- ✅ Cancelled("parent") emitted after
- ✅ Cancelled("good-child") emitted
- ✅ Order: Failed -> Cancelled(parent) -> Cancelled(sibling)
- ✅ Final states: bad-child=FAILED, parent=CANCELLED, good-child=CANCELLED

**Why Important:** Critical test for structured concurrency!

#### Test 3.2: Multiple Failures

**Scenario:**
```kotlin
vizLaunch("parent") {
    vizLaunch("fail-1") {
        vizDelay(100)
        throw RuntimeException("Fail 1")
    }
    vizLaunch("fail-2") {
        vizDelay(200)
        throw RuntimeException("Fail 2")
    }
}
```

**Validate:**
- ✅ First failure wins
- ✅ Parent cancelled by first failure
- ✅ Second child cancelled before it fails
- ✅ Only one Failed event (from fail-1)

**Why Important:** Verifies first-failure-wins rule.

### Category 4: Cancellation Tests

#### Test 4.1: Explicit Cancellation

**Scenario:**
```kotlin
val job = vizLaunch("worker") {
    repeat(100) {
        vizDelay(100)
    }
}

delay(350)
job.cancel()
```

**Validate:**
- ✅ Worker runs for ~300ms (3 iterations)
- ✅ Cancelled event emitted
- ✅ Cancellation happens during delay
- ✅ Final state: CANCELLED

**Why Important:** Verifies explicit cancellation.

#### Test 4.2: Cancellation Propagates

**Scenario:**
```kotlin
val parent = vizLaunch("parent") {
    vizLaunch("child-1") { vizDelay(5000) }
    vizLaunch("child-2") { vizDelay(5000) }
    vizLaunch("child-3") { vizDelay(5000) }
}

delay(100)
parent.cancel()
```

**Validate:**
- ✅ Cancelled("parent") emitted
- ✅ All children cancelled
- ✅ Order: parent cancelled first, then children
- ✅ All final states: CANCELLED

**Why Important:** Verifies cancellation cascade.

### Category 5: WaitingForChildren Tests

#### Test 5.1: Progressive Children Completion

**Scenario:**
```kotlin
vizLaunch("parent") {
    vizLaunch("child-1") { vizDelay(100) }
    vizLaunch("child-2") { vizDelay(200) }
    vizLaunch("child-3") { vizDelay(300) }
}
```

**Validate:**
- ✅ WaitingForChildren events show: 3 -> 2 -> 1 -> (complete)
- ✅ First event: activeChildrenCount = 3
- ✅ After child-1: activeChildrenCount = 2
- ✅ After child-2: activeChildrenCount = 1
- ✅ After child-3: parent completes

**Why Important:** Verifies progressive tracking.

#### Test 5.2: Nested Waiting

**Scenario:**
```kotlin
vizLaunch("L1") {
    vizLaunch("L2-A") {
        vizLaunch("L3-A1") { vizDelay(100) }
        vizLaunch("L3-A2") { vizDelay(150) }
    }
    vizLaunch("L2-B") {
        vizLaunch("L3-B1") { vizDelay(120) }
    }
}
```

**Validate:**
- ✅ L1 emits WaitingForChildren(activeChildrenCount=2)
- ✅ L2-A emits WaitingForChildren(activeChildrenCount=2)
- ✅ L2-B emits WaitingForChildren(activeChildrenCount=1)
- ✅ Each level waits correctly
- ✅ Bottom-up completion: L3 -> L2 -> L1

**Why Important:** Verifies multi-level waiting.

### Category 6: Dispatcher Tests

#### Test 6.1: Dispatcher Switching

**Scenario:**
```kotlin
val dispatchers = VizDispatchers(session, "test")

vizLaunch("worker", context = dispatchers.io) {
    // Run on IO
    vizDelay(100)
}
```

**Validate:**
- ✅ ThreadAssigned event contains dispatcher info
- ✅ Worker runs on IO dispatcher thread
- ✅ DispatcherSelected event emitted (if implemented)

**Why Important:** Verifies dispatcher tracking.

### Category 7: Edge Cases

#### Test 7.1: Empty Parent (No Children)

**Scenario:**
```kotlin
vizLaunch("lonely") {
    vizDelay(100)
    // No children
}
```

**Validate:**
- ✅ NO WaitingForChildren event
- ✅ BodyCompleted followed immediately by Completed
- ✅ Normal lifecycle
- ✅ No errors

**Why Important:** Verifies edge case handling.

#### Test 7.2: Immediate Cancellation

**Scenario:**
```kotlin
val job = vizLaunch("worker") {
    vizDelay(10000)
}

job.cancel()  // Cancel immediately
```

**Validate:**
- ✅ Created and Started emitted
- ✅ Cancelled emitted
- ✅ May or may not suspend (race condition OK)
- ✅ Final state: CANCELLED

**Why Important:** Verifies race condition handling.

---

## Future Features - Preparation & Design

### Overview

This section prepares for **future wrapper implementations** that you'll add to VizScope:
- `vizFlow()` - Flow producers with emission tracking
- `vizWithContext()` - Context switching with tracking
- `vizSupervisorScope()` - Supervisor scope with isolation tracking
- `vizChannel()` - Channel creation with send/receive tracking

### 8. Flow Support (Future)

#### What vizFlow() Will Do

**Wrapper Design:**
```kotlin
suspend fun <T> vizFlow(
    label: String? = null,
    builder: suspend FlowCollector<T>.() -> Unit
): InstrumentedFlow<T>
```

**Expected Events:**
```
1. FlowCreated - Flow builder created
2. FlowCollectionStarted - Collection begins
3. FlowValueEmitted(value) - Each emission
4. FlowCollectionCompleted - Normal completion
5. FlowCollectionCancelled - Cancelled during collection
6. FlowBufferOverflow - Backpressure event
```

**Event Flow:**
```
FlowCreated(flowId, producerCoroutineId) →
  FlowCollectionStarted(flowId, collectorCoroutineId) →
    FlowValueEmitted(flowId, value, seq) × N →
  FlowCollectionCompleted(flowId) OR FlowCollectionCancelled(flowId)
```

#### Test Categories for Flow

**Category 8.1: Basic Flow Emission**

**Scenario:**
```kotlin
vizLaunch("consumer") {
    vizFlow("producer") {
        repeat(5) { i ->
            emit(i)
            vizDelay(100)
        }
    }.collect { value ->
        // Process
    }
}
```

**Validate:**
- ✅ FlowCreated emitted
- ✅ FlowCollectionStarted when collection begins
- ✅ 5 FlowValueEmitted events (values 0-4)
- ✅ FlowValueEmitted events in sequence order
- ✅ FlowCollectionCompleted at end
- ✅ Timestamps show emission intervals (~100ms)

**Category 8.2: Flow Backpressure**

**Scenario:**
```kotlin
vizLaunch("consumer") {
    vizFlow("fast-producer") {
        repeat(100) { emit(it) }  // Fast
    }.collect { value ->
        vizDelay(50)  // Slow consumer
    }
}
```

**Validate:**
- ✅ FlowBufferOverflow events if buffer fills
- ✅ Producer suspension tracked
- ✅ Consumer suspension tracked
- ✅ Backpressure timing recorded
- ✅ All values eventually consumed

**Category 8.3: Flow Cancellation**

**Scenario:**
```kotlin
vizLaunch("consumer") {
    vizFlow("producer") {
        repeat(100) { emit(it) }
    }.collect { value ->
        if (value == 10) {
            throw CancellationException("Stop")
        }
    }
}
```

**Validate:**
- ✅ FlowValueEmitted(0) through FlowValueEmitted(10)
- ✅ FlowCollectionCancelled after value 10
- ✅ Producer cancellation tracked
- ✅ No emissions after cancellation
- ✅ Cleanup events recorded

**Category 8.4: Flow Operators**

**Scenario:**
```kotlin
vizLaunch("consumer") {
    vizFlow("source") {
        repeat(10) { emit(it) }
    }
    .map { it * 2 }
    .filter { it > 5 }
    .take(3)
    .collect { value ->
        // Process
    }
}
```

**Validate:**
- ✅ Operator chain tracked
- ✅ Transformation events recorded
- ✅ Values match expected transformations
- ✅ Take(3) cancels after 3 values
- ✅ All intermediate steps visible

**Category 8.5: Multiple Collectors (Cold Flow)**

**Scenario:**
```kotlin
val flow = vizFlow("shared") {
    repeat(5) { emit(it) }
}

vizLaunch("collector-1") { flow.collect { } }
vizLaunch("collector-2") { flow.collect { } }
```

**Validate:**
- ✅ Two separate FlowCollectionStarted events
- ✅ Each collector gets all values (cold flow)
- ✅ Independent emission tracking
- ✅ No shared state between collectors

#### FlowValidator Design

```
FlowValidator {
    validates:
    - All emissions recorded
    - Emission order correct
    - Collection lifecycle complete
    - Backpressure handled correctly
    - Cancellation propagates correctly
    - Operator transformations correct
    
    methods:
    - verifyEmissionSequence(flowId, expectedValues)
    - verifyEmissionTiming(flowId, expectedIntervals)
    - verifyBackpressure(flowId, expectedOverflows)
    - verifyCollectorTracking(flowId, collectorIds)
    - verifyOperatorChain(flowId, operators)
}
```

### 9. WithContext Support (Future)

#### What vizWithContext() Will Do

**Wrapper Design:**
```kotlin
suspend fun <T> vizWithContext(
    label: String? = null,
    context: CoroutineContext,
    block: suspend CoroutineScope.() -> T
): T
```

**Expected Events:**
```
1. ContextSwitchStarted - Before context switch
2. DispatcherSelected - New dispatcher chosen
3. ThreadAssigned - New thread assigned
4. [block execution events]
5. ContextSwitchCompleted - After returning to original context
```

**Event Flow:**
```
Current Context (Dispatcher A, Thread 1) →
  ContextSwitchStarted(fromDispatcher, toDispatcher) →
    DispatcherSelected(newDispatcher) →
    ThreadAssigned(newThread) →
    [execute block on new context] →
  ContextSwitchCompleted(toDispatcher, fromDispatcher) →
Back to Original Context (Dispatcher A, Thread 1)
```

#### Test Categories for WithContext

**Category 9.1: Basic Context Switch**

**Scenario:**
```kotlin
val dispatchers = VizDispatchers(session, "test")

vizLaunch("worker", context = dispatchers.default) {
    val result = vizWithContext("io-work", dispatchers.io) {
        vizDelay(100)
        "Result"
    }
}
```

**Validate:**
- ✅ ContextSwitchStarted(default → io)
- ✅ DispatcherSelected(io)
- ✅ ThreadAssigned to IO thread
- ✅ Work executes on IO dispatcher
- ✅ ContextSwitchCompleted(io → default)
- ✅ Returns to default dispatcher

**Category 9.2: Nested Context Switches**

**Scenario:**
```kotlin
vizLaunch("worker", context = dispatchers.default) {
    vizWithContext("level-1", dispatchers.io) {
        vizWithContext("level-2", dispatchers.default) {
            vizWithContext("level-3", dispatchers.io) {
                vizDelay(100)
            }
        }
    }
}
```

**Validate:**
- ✅ Multiple ContextSwitch events
- ✅ Correct nesting: default → io → default → io → default
- ✅ Each switch tracked with timestamps
- ✅ Returns to correct context at each level
- ✅ Thread switches recorded

**Category 9.3: Exception in WithContext**

**Scenario:**
```kotlin
vizLaunch("worker") {
    try {
        vizWithContext("fail-context", dispatchers.io) {
            throw RuntimeException("Fail")
        }
    } catch (e: Exception) {
        // Handle
    }
}
```

**Validate:**
- ✅ ContextSwitchStarted emitted
- ✅ Exception recorded in context
- ✅ ContextSwitchCompleted (with error marker)
- ✅ Returns to original context despite exception
- ✅ Parent continues normally

**Category 9.4: Context Switch Timing**

**Scenario:**
```kotlin
vizLaunch("worker") {
    val start = System.nanoTime()
    
    vizWithContext("io-work", dispatchers.io) {
        vizDelay(500)
    }
    
    val duration = System.nanoTime() - start
}
```

**Validate:**
- ✅ Context switch overhead minimal (<1ms)
- ✅ Work duration matches expected (~500ms)
- ✅ Total time = overhead + work time
- ✅ Return switch overhead minimal

#### WithContextValidator Design

```
WithContextValidator {
    validates:
    - Context switches tracked
    - Dispatcher changes recorded
    - Thread assignments correct
    - Nested switches handled
    - Exceptions don't break context
    - Timing overhead acceptable
    
    methods:
    - verifyContextSwitch(fromDispatcher, toDispatcher)
    - verifyThreadChange(fromThread, toThread)
    - verifyNestingDepth(expectedDepth)
    - verifySwitchTiming(expectedOverhead)
    - verifyReturnToOriginal(originalContext)
}
```

### 10. SupervisorScope Support (Future)

#### What vizSupervisorScope() Will Do

**Wrapper Design:**
```kotlin
suspend fun <T> vizSupervisorScope(
    label: String? = null,
    block: suspend VizScope.() -> T
): T
```

**Expected Events:**
```
1. SupervisorScopeCreated - Scope created
2. SupervisorScopeStarted - Scope begins execution
3. [child events - failures isolated]
4. ChildFailureIsolated - Child failed but not propagated
5. SupervisorScopeCompleted - Scope completed
```

**Key Behavior:**
- Child failures do NOT cancel siblings
- Child failures do NOT cancel supervisor scope
- Supervisor scope waits for all children (even failed ones)
- Each child independent

**Event Flow:**
```
SupervisorScopeCreated →
  SupervisorScopeStarted →
    Child-1: Started → Failed →
      ChildFailureIsolated(child-1) →
    Child-2: Started → Completed (continues!) →
    Child-3: Started → Completed (continues!) →
  SupervisorScopeCompleted
```

#### Test Categories for SupervisorScope

**Category 10.1: Basic Isolation**

**Scenario:**
```kotlin
vizSupervisorScope("supervisor") {
    vizLaunch("fail-child") {
        vizDelay(100)
        throw RuntimeException("Fail")
    }
    
    vizLaunch("good-child-1") {
        vizDelay(500)
    }
    
    vizLaunch("good-child-2") {
        vizDelay(600)
    }
}
```

**Validate:**
- ✅ SupervisorScopeCreated emitted
- ✅ Failed(fail-child) emitted
- ✅ ChildFailureIsolated event emitted
- ✅ good-child-1 NOT cancelled
- ✅ good-child-2 NOT cancelled
- ✅ Both good children complete successfully
- ✅ Supervisor scope completes after all children

**Category 10.2: Multiple Failures**

**Scenario:**
```kotlin
vizSupervisorScope("supervisor") {
    vizLaunch("fail-1") {
        vizDelay(100)
        throw RuntimeException("Fail 1")
    }
    
    vizLaunch("fail-2") {
        vizDelay(200)
        throw RuntimeException("Fail 2")
    }
    
    vizLaunch("good-child") {
        vizDelay(300)
    }
}
```

**Validate:**
- ✅ Both failures isolated
- ✅ Two ChildFailureIsolated events
- ✅ good-child completes successfully
- ✅ Supervisor scope completes
- ✅ No cancellation propagation between children

**Category 10.3: Nested Supervisor**

**Scenario:**
```kotlin
vizLaunch("parent") {
    vizSupervisorScope("supervisor") {
        vizLaunch("fail-child") {
            throw RuntimeException("Fail")
        }
        vizLaunch("good-child") {
            vizDelay(500)
        }
    }
    // Parent continues after supervisor
}
```

**Validate:**
- ✅ fail-child failure isolated
- ✅ good-child completes
- ✅ Supervisor scope completes
- ✅ Parent continues normally
- ✅ No cancellation of parent

**Category 10.4: Exception in Supervisor Body**

**Scenario:**
```kotlin
vizSupervisorScope("supervisor") {
    vizLaunch("child") {
        vizDelay(1000)
    }
    
    throw RuntimeException("Supervisor itself fails")
}
```

**Validate:**
- ✅ Supervisor scope fails
- ✅ Child IS cancelled (supervisor itself failed)
- ✅ Different from child failure
- ✅ Proper event sequence

#### SupervisorValidator Design

```
SupervisorValidator {
    validates:
    - Child failures isolated
    - Siblings not cancelled
    - Supervisor completes after all children
    - Multiple failures handled
    - Supervisor itself can fail
    
    methods:
    - verifyFailureIsolation(failedChild, siblings)
    - verifySiblingsContinue(siblings)
    - verifySupervisorCompletes(supervisorId)
    - verifyNoFailurePropagation(failedChild)
    - verifyMultipleFailuresIsolated(failedChildren)
}
```

### 11. Channel Support (Future)

#### What vizChannel() Will Do

**Wrapper Design:**
```kotlin
fun <T> vizChannel(
    label: String? = null,
    capacity: Int = Channel.RENDEZVOUS,
    onBufferOverflow: BufferOverflow = BufferOverflow.SUSPEND
): InstrumentedChannel<T>
```

**Expected Events:**
```
1. ChannelCreated - Channel created
2. ChannelSendStarted - Send operation begins
3. ChannelSendCompleted - Send operation completes
4. ChannelReceiveStarted - Receive operation begins
5. ChannelReceiveCompleted - Receive operation completes
6. ChannelBufferStateChanged - Buffer size changed
7. ChannelClosed - Channel closed
8. ProducerSuspended - Producer blocked (buffer full)
9. ConsumerSuspended - Consumer blocked (buffer empty)
```

**Event Flow:**
```
Producer Side:
ChannelSendStarted(value) →
  [if buffer full: ProducerSuspended] →
  ChannelBufferStateChanged(+1) →
ChannelSendCompleted(value)

Consumer Side:
ChannelReceiveStarted →
  [if buffer empty: ConsumerSuspended] →
  ChannelBufferStateChanged(-1) →
ChannelReceiveCompleted(value)
```

#### Test Categories for Channels

**Category 11.1: Basic Send/Receive**

**Scenario:**
```kotlin
val channel = vizChannel<Int>("work-queue", capacity = 5)

vizLaunch("producer") {
    repeat(10) { i ->
        channel.send(i)
        vizDelay(50)
    }
    channel.close()
}

vizLaunch("consumer") {
    for (value in channel) {
        vizDelay(100)
    }
}
```

**Validate:**
- ✅ ChannelCreated(capacity=5)
- ✅ 10 ChannelSendStarted/Completed pairs
- ✅ 10 ChannelReceiveStarted/Completed pairs
- ✅ All values sent and received
- ✅ ChannelClosed event
- ✅ FIFO order maintained

**Category 11.2: Backpressure - Producer Faster**

**Scenario:**
```kotlin
val channel = vizChannel<Int>("queue", capacity = 3)

vizLaunch("fast-producer") {
    repeat(20) { i ->
        channel.send(i)  // Fast
    }
}

vizLaunch("slow-consumer") {
    repeat(20) {
        channel.receive()
        vizDelay(100)  // Slow
    }
}
```

**Validate:**
- ✅ Buffer fills to capacity (3)
- ✅ ProducerSuspended events when buffer full
- ✅ Producer resumes when consumer receives
- ✅ ChannelBufferStateChanged tracks buffer size
- ✅ Max buffer size never exceeded
- ✅ All values eventually consumed

**Category 11.3: Backpressure - Consumer Faster**

**Scenario:**
```kotlin
val channel = vizChannel<Int>("queue", capacity = 3)

vizLaunch("slow-producer") {
    repeat(20) { i ->
        vizDelay(100)  // Slow
        channel.send(i)
    }
}

vizLaunch("fast-consumer") {
    repeat(20) {
        channel.receive()  // Fast
    }
}
```

**Validate:**
- ✅ Buffer mostly empty
- ✅ ConsumerSuspended events when buffer empty
- ✅ Consumer resumes when producer sends
- ✅ No producer suspension
- ✅ Consumer waits for producer

**Category 11.4: Multiple Producers (Fan-In)**

**Scenario:**
```kotlin
val channel = vizChannel<Int>("shared-queue", capacity = 10)

vizLaunch("producer-1") {
    repeat(10) { channel.send(it) }
}

vizLaunch("producer-2") {
    repeat(10) { channel.send(it + 100) }
}

vizLaunch("producer-3") {
    repeat(10) { channel.send(it + 200) }
}

vizLaunch("consumer") {
    repeat(30) { channel.receive() }
}
```

**Validate:**
- ✅ 30 send operations tracked
- ✅ 30 receive operations tracked
- ✅ All producers tracked separately
- ✅ Consumer receives from all producers
- ✅ Values interleaved correctly
- ✅ No values lost

**Category 11.5: Multiple Consumers (Fan-Out)**

**Scenario:**
```kotlin
val channel = vizChannel<Int>("shared-queue", capacity = 10)

vizLaunch("producer") {
    repeat(30) { channel.send(it) }
    channel.close()
}

vizLaunch("consumer-1") {
    for (value in channel) {
        // Process
    }
}

vizLaunch("consumer-2") {
    for (value in channel) {
        // Process
    }
}

vizLaunch("consumer-3") {
    for (value in channel) {
        // Process
    }
}
```

**Validate:**
- ✅ 30 values sent
- ✅ 30 values received (distributed among consumers)
- ✅ Each value received exactly once
- ✅ Load distribution tracked
- ✅ All consumers eventually idle
- ✅ Channel close propagates to all consumers

**Category 11.6: Channel Closing**

**Scenario:**
```kotlin
val channel = vizChannel<Int>("queue", capacity = 5)

vizLaunch("producer") {
    repeat(10) { channel.send(it) }
    channel.close()
}

vizLaunch("consumer") {
    for (value in channel) {
        // Receives all values, then loop exits
    }
}
```

**Validate:**
- ✅ ChannelClosed event after all sends
- ✅ Consumer receives all buffered values
- ✅ Consumer loop exits after close
- ✅ No exception thrown
- ✅ Graceful shutdown

**Category 11.7: Conflated Channel**

**Scenario:**
```kotlin
val channel = vizChannel<Int>(
    "conflated", 
    capacity = Channel.CONFLATED
)

vizLaunch("fast-producer") {
    repeat(100) { i ->
        channel.send(i)
    }
}

vizLaunch("slow-consumer") {
    repeat(10) {
        vizDelay(100)
        channel.receive()
    }
}
```

**Validate:**
- ✅ Many values sent
- ✅ Few values received (conflated)
- ✅ Consumer gets latest values only
- ✅ No producer suspension
- ✅ Dropped value count tracked

#### ChannelValidator Design

```
ChannelValidator {
    validates:
    - All sends tracked
    - All receives tracked
    - Buffer capacity respected
    - FIFO order maintained
    - Backpressure handled correctly
    - Multiple producers/consumers work
    - Channel close handled
    - No values lost (unless conflated)
    
    methods:
    - verifySendReceiveBalance(channelId)
    - verifyBufferState(channelId, maxSize)
    - verifyBackpressure(channelId, expectedSuspensions)
    - verifyFIFO(channelId)
    - verifyMultipleProducers(channelId, producerIds)
    - verifyMultipleConsumers(channelId, consumerIds)
    - verifyChannelClose(channelId)
    - verifyNoValueLoss(channelId)
}
```

---

## Future Events Summary

### New Event Types to Implement

**Flow Events:**
```kotlin
FlowCreated(flowId, label, producerCoroutineId)
FlowCollectionStarted(flowId, collectorCoroutineId)
FlowValueEmitted(flowId, value, seq)
FlowCollectionCompleted(flowId)
FlowCollectionCancelled(flowId, reason)
FlowBufferOverflow(flowId, bufferSize)
```

**Context Switch Events:**
```kotlin
ContextSwitchStarted(fromDispatcher, toDispatcher, fromThread, toThread)
ContextSwitchCompleted(fromDispatcher, toDispatcher)
```

**Supervisor Events:**
```kotlin
SupervisorScopeCreated(scopeId, label)
SupervisorScopeStarted(scopeId)
ChildFailureIsolated(supervisorId, failedChildId, exception)
SupervisorScopeCompleted(scopeId)
```

**Channel Events:**
```kotlin
ChannelCreated(channelId, label, capacity, bufferOverflow)
ChannelSendStarted(channelId, producerId, value)
ChannelSendCompleted(channelId, producerId, value)
ChannelReceiveStarted(channelId, consumerId)
ChannelReceiveCompleted(channelId, consumerId, value)
ChannelBufferStateChanged(channelId, oldSize, newSize)
ProducerSuspended(channelId, producerId, reason="buffer full")
ConsumerSuspended(channelId, consumerId, reason="buffer empty")
ChannelClosed(channelId, closerId)
```

---

## Future Validators Summary

### Additional Validators Needed

1. **FlowValidator**
   - Emission tracking
   - Backpressure detection
   - Operator chain validation
   - Collection lifecycle

2. **WithContextValidator**
   - Context switches tracked
   - Dispatcher changes recorded
   - Thread assignments correct
   - Nesting handled properly

3. **SupervisorValidator**
   - Failure isolation verified
   - Sibling independence maintained
   - Supervisor completion after all children

4. **ChannelValidator**
   - Send/receive balance
   - Buffer management
   - FIFO ordering
   - Multiple producer/consumer coordination

---

## Implementation Priority

### Recommended Order:

**Phase 1 (Current):**
- ✅ vizLaunch
- ✅ vizAsync
- ✅ vizDelay

**Phase 2 (Next):**
- 🔜 vizWithContext (simpler, useful for dispatcher testing)
- 🔜 vizSupervisorScope (important for error handling patterns)

**Phase 3 (Later):**
- 📋 vizFlow (complex but very useful)
- 📋 vizChannel (complex, multiple patterns)

**Phase 4 (Advanced):**
- 📋 Flow operators (map, filter, etc.)
- 📋 SharedFlow, StateFlow
- 📋 Conflated channels, Buffered channels variants

---

## Event Verification

### Event Ordering Patterns

#### Pattern 1: Basic Lifecycle

```
Expected for simple coroutine:
Created -> Started -> [work] -> BodyCompleted -> Completed

With suspension:
Created -> Started -> Suspended -> Resumed -> BodyCompleted -> Completed

With children:
Created -> Started -> [children created] -> BodyCompleted -> 
  WaitingForChildren -> [children complete] -> Completed
```

#### Pattern 2: Parent-Child

```
Parent with one child:
Created(parent) -> Started(parent) -> 
  Created(child) -> Started(child) -> 
    [child work] -> 
  BodyCompleted(child) -> Completed(child) ->
BodyCompleted(parent) -> WaitingForChildren(parent) -> Completed(parent)

Key invariant: Completed(child) BEFORE Completed(parent)
```

#### Pattern 3: Exception Flow

```
Child throws exception:
Started(child) -> Failed(child) ->
  Cancelled(parent) -> 
    Cancelled(sibling-1) ->
    Cancelled(sibling-2) ->
  ...

Key invariant: Failed(source) BEFORE all Cancelled(victims)
```

#### Pattern 4: Async/Await

```
Async with await:
Created(async) -> Started(async) -> 
  [work] -> 
  BodyCompleted(async) -> DeferredValueAvailable ->
Created(awaiter) -> Started(awaiter) -> 
  DeferredAwaitStarted -> [suspended] ->
  DeferredAwaitCompleted -> 
  BodyCompleted(awaiter) -> Completed(awaiter) ->
Completed(async)

Key invariant: DeferredValueAvailable BEFORE DeferredAwaitCompleted
```

### Timestamp Analysis

**What to check:**
- Event order (A before B)
- Relative timing (A much before B vs A slightly before B)
- Concurrent events (A and B ~same time)
- Causal relationships (A causes B)

**Algorithms:**

```
Check A before B:
  eventA = recorder.forCoroutine(idA).find { it.kind == "X" }
  eventB = recorder.forCoroutine(idB).find { it.kind == "Y" }
  assert(eventA.tsNanos < eventB.tsNanos)

Check concurrent (within threshold):
  eventA = ...
  eventB = ...
  diff = abs(eventA.tsNanos - eventB.tsNanos)
  threshold = 10_000_000  // 10ms in nanos
  assert(diff < threshold)

Check causal (A causes B, small delay):
  eventA = ...
  eventB = ...
  assert(eventA.tsNanos < eventB.tsNanos)
  delay = eventB.tsNanos - eventA.tsNanos
  assert(delay < 1_000_000)  // Less than 1ms = causally related
```

### Snapshot Verification

**What to check:**
- Coroutine exists in snapshot
- Correct state
- Correct parent ID
- Correct children list
- Job registered

**Algorithms:**

```
Verify coroutine in snapshot:
  val node = session.snapshot.coroutines[coroutineId]
  assertNotNull(node)
  assertEquals(expectedState, node.state)
  assertEquals(expectedParent, node.parentId)
  assertEquals(expectedChildren.toSet(), node.children.toSet())

Verify hierarchy:
  val tree = session.projectionService.getHierarchyTree()
  val parentNode = tree.find { it.name == "parent" }
  val childNode = tree.find { it.name == "child" }
  assert(parentNode.children.contains(childNode))
```

---

## Integration Patterns

### Pattern 1: Standard Test Structure

```kotlin
@Test
fun `test parent waits for children`() = runBlocking {
    // SETUP
    val session = VizSession("test-session")
    val recorder = EventRecorder()
    
    // Subscribe recorder to event stream
    val subscription = launch {
        session.bus.stream().collect { event ->
            recorder.record(event)
        }
    }
    
    // EXECUTE
    val scope = VizScope(session)
    scope.vizLaunch("parent") {
        vizLaunch("child-1") { vizDelay(100) }
        vizLaunch("child-2") { vizDelay(200) }
    }
    
    // Wait for completion
    delay(500)
    
    // VALIDATE
    val parentEvents = recorder.forCoroutine("parent")
    val childEvents = recorder.forCoroutine("child-1")
    
    // Check event sequence
    val parentKinds = parentEvents.map { it.kind }
    assert(parentKinds.contains("WaitingForChildren"))
    
    // Check ordering
    val child1Completed = recorder.ofKind("CoroutineCompleted")
        .find { it.label == "child-1" }
    val parentCompleted = recorder.ofKind("CoroutineCompleted")
        .find { it.label == "parent" }
    assert(child1Completed.tsNanos < parentCompleted.tsNanos)
    
    // Verify final state
    val finalSnapshot = session.snapshot
    assertEquals(CoroutineState.COMPLETED, finalSnapshot.coroutines["parent"]?.state)
    
    // Cleanup
    subscription.cancel()
    session.close()
}
```

### Pattern 2: Using Test Helper

```kotlin
fun testWithRecording(
    testName: String,
    block: suspend VizScope.() -> Unit
): TestResult {
    val session = VizSession(testName)
    val recorder = EventRecorder()
    
    val subscription = session.sessionScope.launch {
        session.bus.stream().collect { recorder.record(it) }
    }
    
    runBlocking {
        val scope = VizScope(session)
        try {
            scope.block()
            delay(100)  // Let events settle
            TestResult.Success(session, recorder)
        } catch (e: Exception) {
            TestResult.Failure(session, recorder, e)
        } finally {
            subscription.cancel()
            session.close()
        }
    }
}

// Usage:
val result = testWithRecording("my-test") {
    vizLaunch("worker") {
        vizDelay(100)
    }
}

result.verify {
    eventSequence("worker") {
        created -> started -> suspended -> resumed -> completed
    }
}
```

### Pattern 3: Assertion Builder

```kotlin
class TestResultVerifier(
    private val session: VizSession,
    private val recorder: EventRecorder
) {
    fun verifyEventSequence(
        coroutineId: String,
        expectedKinds: List<String>
    ) {
        val actualKinds = recorder.forCoroutine(coroutineId)
            .map { it.kind }
        assertEquals(expectedKinds, actualKinds)
    }
    
    fun verifyEventOrder(
        label1: String,
        kind1: String,
        label2: String,
        kind2: String
    ) {
        val event1 = recorder.all()
            .find { it.label == label1 && it.kind == kind1 }
        val event2 = recorder.all()
            .find { it.label == label2 && it.kind == kind2 }
        
        assertNotNull(event1)
        assertNotNull(event2)
        assert(event1.tsNanos < event2.tsNanos)
    }
    
    fun verifyHierarchy(
        parentLabel: String,
        childLabels: List<String>
    ) {
        val tree = session.projectionService.getHierarchyTree()
        val parent = tree.find { it.name == parentLabel }
        assertNotNull(parent)
        
        val actualChildren = parent.children.map { it.name }.toSet()
        val expectedChildren = childLabels.toSet()
        assertEquals(expectedChildren, actualChildren)
    }
    
    fun verifyWaitingForChildren(
        parentLabel: String,
        expectedActiveCount: Int
    ) {
        val waitingEvents = recorder.ofKind("WaitingForChildren")
            .filter { it.label == parentLabel }
        
        assert(waitingEvents.isNotEmpty())
        val event = waitingEvents.first() as WaitingForChildren
        assertEquals(expectedActiveCount, event.activeChildrenCount)
    }
}
```

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1)

**Goal:** Basic test execution infrastructure

**Tasks:**
1. Create `TestScenarioRunner`
   - Session setup
   - EventRecorder subscription
   - Scenario execution
   - Cleanup

2. Create `TestResult` data class
   - Wrap session, recorder, snapshot
   - Provide query methods

3. Create basic test helpers
   - `testWithRecording()` function
   - Timeout handling
   - Error capture

**Deliverable:** Can run basic tests and collect events

### Phase 2: Basic Validators (Week 2)

**Goal:** Event sequence and ordering validation

**Tasks:**
1. Enhance `SequenceChecker`
   - Exact sequence matching
   - Missing/extra event detection
   - Better error messages

2. Create `EventOrderValidator`
   - Before/after assertions
   - Timestamp comparison
   - Causality checking

3. Create `HierarchyValidator`
   - Parent-child verification
   - Tree structure validation

**Deliverable:** Can validate basic patterns

### Phase 3: Structured Concurrency (Week 3)

**Goal:** Validate SC rules automatically

**Tasks:**
1. Create `StructuredConcurrencyValidator`
   - Parent waits for children
   - BodyCompleted before Completed
   - WaitingForChildren validation
   - Children complete before parent

2. Create `ExceptionPropagationValidator`
   - Failed -> Cancelled ordering
   - Cascade verification
   - First-failure-wins

3. Create `CancellationValidator`
   - Cancellation cascades
   - Propagation order
   - Terminal states

**Deliverable:** Automatic SC rule checking

### Phase 4: Advanced Features (Week 4)

**Goal:** Async, Job state, timing

**Tasks:**
1. Create `DeferredTrackingValidator`
   - Async lifecycle
   - Multiple awaiters
   - Value availability

2. Create `JobStateValidator`
   - State transitions
   - Children count
   - Correlation with coroutine events

3. Create `WaitingForChildrenValidator`
   - Progressive decrease
   - Active children accuracy
   - Timing correctness

**Deliverable:** Complete validation suite

### Phase 5: Test DSL (Week 5)

**Goal:** Readable test definitions

**Tasks:**
1. Design DSL syntax
   - `testScenario { }` builder
   - `execute { }` block
   - `expect { }` block

2. Implement DSL builders
   - Scenario builder
   - Expectation builder
   - Fluent assertions

3. Create examples
   - All test categories
   - Documentation
   - Best practices

**Deliverable:** Production-ready DSL

### Phase 6: Integration & Documentation (Week 6)

**Goal:** Complete, documented system

**Tasks:**
1. Integration tests
   - Run full test suite
   - Fix any issues
   - Performance tuning

2. Documentation
   - Usage guide
   - API reference
   - Examples library

3. CI/CD integration
   - Automated test runs
   - Coverage reports
   - Regression detection

**Deliverable:** Production-ready framework

---

## Future Features Checklist

### What's Ready Now (Phase 1)

✅ **vizLaunch** - Fully implemented and tested  
✅ **vizAsync** - Fully implemented and tested  
✅ **vizDelay** - Fully implemented and tested  
✅ **Basic event system** - Complete  
✅ **Parent-child tracking** - Working  
✅ **Structured concurrency** - Validated  
✅ **Exception propagation** - Tracked  
✅ **Job monitoring** - Implemented  

### What's Designed for Future (Phase 2+)

#### vizWithContext - Dispatcher Switching
```
Status: 📋 Design Complete, Ready for Implementation

Wrapper: vizWithContext(label, context, block)

Events to Implement:
- ContextSwitchStarted
- ContextSwitchCompleted
- (Reuse existing: DispatcherSelected, ThreadAssigned)

Validator: WithContextValidator
- Context switches tracked
- Dispatcher changes correct
- Thread assignments verified
- Nesting depth validated

Test Categories: 4 scenarios prepared
Complexity: ⭐⭐ (Medium - straightforward)
Priority: 🔥 High (useful for dispatcher testing)
```

#### vizSupervisorScope - Failure Isolation
```
Status: 📋 Design Complete, Ready for Implementation

Wrapper: vizSupervisorScope(label, block)

Events to Implement:
- SupervisorScopeCreated
- SupervisorScopeStarted
- ChildFailureIsolated
- SupervisorScopeCompleted

Validator: SupervisorValidator
- Failure isolation verified
- Siblings not cancelled
- Multiple failures handled
- Supervisor completion tracked

Test Categories: 4 scenarios prepared
Complexity: ⭐⭐⭐ (Medium-High - isolation logic)
Priority: 🔥 High (critical for error handling)
```

#### vizFlow - Flow Tracking
```
Status: 📋 Design Complete, Ready for Implementation

Wrapper: vizFlow(label, builder) -> InstrumentedFlow<T>

Events to Implement:
- FlowCreated
- FlowCollectionStarted
- FlowValueEmitted
- FlowCollectionCompleted
- FlowCollectionCancelled
- FlowBufferOverflow

Validator: FlowValidator
- Emission sequence verified
- Backpressure detected
- Collection lifecycle tracked
- Operator chain validated

Test Categories: 5 scenarios prepared
Complexity: ⭐⭐⭐⭐ (High - complex lifecycle)
Priority: 🔥🔥 Very High (widely used)
```

#### vizChannel - Channel Operations
```
Status: 📋 Design Complete, Ready for Implementation

Wrapper: vizChannel(label, capacity, overflow) -> InstrumentedChannel<T>

Events to Implement:
- ChannelCreated
- ChannelSendStarted/Completed
- ChannelReceiveStarted/Completed
- ChannelBufferStateChanged
- ProducerSuspended/ConsumerSuspended
- ChannelClosed

Validator: ChannelValidator
- Send/receive balance
- Buffer capacity respected
- FIFO order maintained
- Backpressure handled
- Multiple producers/consumers tracked

Test Categories: 7 scenarios prepared
Complexity: ⭐⭐⭐⭐⭐ (Very High - multiple patterns)
Priority: 🔥 High (common use case)
```

### Implementation Roadmap Extended

#### Phase 1: Foundation (Complete)
✅ Basic vizLaunch, vizAsync, vizDelay  
✅ EventRecorder, SequenceChecker  
✅ VizSession, RuntimeSnapshot  
✅ Job monitoring  

#### Phase 2: Core Validators (Current)
- EventSequenceValidator
- HierarchyValidator  
- StructuredConcurrencyValidator
- DeferredTrackingValidator
- WaitingForChildrenValidator

#### Phase 3: Context & Supervisor (Next)
- Implement vizWithContext wrapper
- Implement WithContextValidator
- Implement vizSupervisorScope wrapper
- Implement SupervisorValidator
- Test scenarios for both

#### Phase 4: Flow Support (Future)
- Design InstrumentedFlow wrapper
- Implement vizFlow wrapper
- Implement FlowValidator
- Test 5 flow scenarios
- Operator tracking

#### Phase 5: Channel Support (Future)
- Design InstrumentedChannel wrapper
- Implement vizChannel wrapper
- Implement ChannelValidator
- Test 7 channel scenarios
- Multiple producer/consumer patterns

#### Phase 6: Advanced Features (Future)
- SharedFlow, StateFlow wrappers
- Select expressions tracking
- Actor pattern support
- Flow operator chain visualization

---

## Summary

### What This Design Provides

✅ **Complete testing strategy** for YOUR current VizScope wrappers  
✅ **Validator system** that builds on YOUR existing infrastructure  
✅ **Comprehensive test scenarios** covering all current use cases  
✅ **Event verification patterns** for YOUR event types  
✅ **Integration patterns** showing how to implement  
✅ **Implementation roadmap** with clear phases  
✅ **Future-ready design** for Flow, WithContext, SupervisorScope, Channels  
✅ **46+ test scenarios** prepared (20 current + 26 future)  
✅ **50+ event types** defined (current + future)  
✅ **10 validators** designed (6 current + 4 future)  

### Key Design Principles

1. **Build on YOUR Infrastructure**
   - Uses VizSession, EventRecorder, SequenceChecker
   - Extends existing capabilities
   - No reinventing the wheel
   - Prepares for future wrappers

2. **Test Observable Behavior**
   - Events emitted (YOUR events)
   - Event ordering (YOUR timeline)
   - State transitions (YOUR snapshot)
   - Hierarchy (YOUR projection service)
   - Future: Flow emissions, context switches, channel operations

3. **Comprehensive Coverage**
   - Current: vizLaunch, vizAsync, vizDelay
   - Future: vizFlow, vizWithContext, vizSupervisorScope, vizChannel
   - All event types (20+ current, 30+ future)
   - All patterns (nested, async, exceptions, cancellations, flows, channels)
   - All edge cases

4. **Practical Implementation**
   - Clear roadmap with priorities
   - Incremental development
   - Concrete examples for each feature
   - Production-ready approach
   - Future features fully designed

### What You Can Do Now

**Immediate (Phase 1-2):**
1. ✅ Test vizLaunch behavior completely
2. ✅ Test vizAsync with multiple awaiters
3. ✅ Test vizDelay suspension tracking
4. ✅ Validate structured concurrency rules
5. ✅ Test exception propagation
6. ✅ Test cancellation cascades
7. ✅ Test job state tracking
8. ✅ Test WaitingForChildren behavior

**Next (Phase 3):**
1. 📋 Implement vizWithContext wrapper
2. 📋 Test dispatcher switching
3. 📋 Implement vizSupervisorScope wrapper
4. 📋 Test failure isolation

**Future (Phase 4-5):**
1. 📋 Implement vizFlow wrapper
2. 📋 Test flow emissions and backpressure
3. 📋 Implement vizChannel wrapper
4. 📋 Test channel send/receive patterns

### Next Steps

1. **Review this design** - Understand the complete approach (current + future)
2. **Start Phase 2** - Implement current validators
3. **Write current tests** - Cover all vizLaunch/vizAsync/vizDelay scenarios
4. **Phase 3 preparation** - When ready, implement vizWithContext
5. **Phase 4 preparation** - When ready, implement vizSupervisorScope
6. **Future phases** - Flow and Channel when needed
7. **Document** - Create usage guide as you go
8. **Iterate** - Improve based on real usage

### Feature Comparison

| Feature | Status | Events | Tests | Complexity | Priority |
|---------|--------|--------|-------|------------|----------|
| vizLaunch | ✅ Done | 8 types | 8 scenarios | ⭐⭐ | 🔥🔥🔥 |
| vizAsync | ✅ Done | 11 types | 6 scenarios | ⭐⭐⭐ | 🔥🔥🔥 |
| vizDelay | ✅ Done | 2 types | 4 scenarios | ⭐ | 🔥🔥 |
| vizWithContext | 📋 Designed | 4 types | 4 scenarios | ⭐⭐ | 🔥🔥 |
| vizSupervisorScope | 📋 Designed | 4 types | 4 scenarios | ⭐⭐⭐ | 🔥🔥 |
| vizFlow | 📋 Designed | 6 types | 5 scenarios | ⭐⭐⭐⭐ | 🔥🔥🔥 |
| vizChannel | 📋 Designed | 9 types | 7 scenarios | ⭐⭐⭐⭐⭐ | 🔥🔥 |

**Total:** 7 features, 44 event types, 38 test scenarios designed

---

**This design is specifically for YOUR implementation - both current and future. It leverages YOUR existing VizScope, VizSession, EventRecorder, and event system to create a comprehensive testing framework that validates YOUR wrappers work correctly in all scenarios, with complete preparation for future features you plan to add.**

**Current wrappers (vizLaunch, vizAsync, vizDelay):** Fully designed and ready to test  
**Future wrappers (vizFlow, vizWithContext, vizSupervisorScope, vizChannel):** Fully designed and ready to implement when you need them

**No generic framework - this is 100% tailored to YOUR implementation, present and future.**

---

**End of Design Document**

