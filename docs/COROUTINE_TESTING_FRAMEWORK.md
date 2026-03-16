# Comprehensive Coroutine Testing & Validation Framework

**Version:** 1.0  
**Date:** November 28, 2025  
**Purpose:** Design a robust framework for testing and validating all coroutine behaviors including async, launch, withContext, Flow, Channels, nested scenarios, exceptions, cancellations, and event ordering.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Framework Architecture](#framework-architecture)
3. [Test DSL Design](#test-dsl-design)
4. [Validation System](#validation-system)
5. [Scenario Types](#scenario-types)
6. [Event Ordering Validation](#event-ordering-validation)
7. [Exception & Cancellation Testing](#exception--cancellation-testing)
8. [Flow & Channel Testing](#flow--channel-testing)
9. [Timing & Determinism](#timing--determinism)
10. [Implementation Guide](#implementation-guide)
11. [Best Practices](#best-practices)
12. [Integration Examples](#integration-examples)

---

## Executive Summary

### The Problem

Testing coroutines is challenging because:
- **Non-deterministic execution** - Thread scheduling varies
- **Invisible state transitions** - Suspension/resumption happens behind the scenes
- **Complex hierarchies** - Parent-child relationships and structured concurrency
- **Exception propagation** - Failures cascade through the hierarchy
- **Timing dependencies** - Race conditions and ordering issues
- **Multiple primitives** - launch, async, Flow, Channel, withContext each behave differently

### The Solution

A comprehensive testing framework that:
1. **Captures all events** - Every state transition, suspension, resumption
2. **Validates ordering** - Ensures events occur in the expected sequence
3. **Handles all constructs** - launch, async, Flow, Channel, withContext, supervisorScope
4. **Tests exceptions** - Verifies propagation and structured concurrency
5. **Supports nested scenarios** - Multi-level hierarchies with complex interactions
6. **Deterministic testing** - Repeatable results with controlled timing
7. **Rich assertions** - Fluent DSL for expressing expectations

### Key Features

| Feature | Description | Benefit |
|---------|-------------|---------|
| **Declarative DSL** | Express test scenarios as structured configurations | Clear, maintainable tests |
| **Event Validators** | Verify event sequences, timing, and relationships | Catch subtle bugs |
| **Scenario Builder** | Composable building blocks for complex scenarios | Reusable test components |
| **Exception Testing** | Structured concurrency verification | Ensure proper error handling |
| **Timeline Assertions** | Validate temporal relationships and ordering | Verify async behavior |
| **Flow/Channel Support** | Test backpressure, buffering, cancellation | Complete coverage |
| **Auto-documentation** | Generate test reports and visualizations | Living documentation |

---

## Framework Architecture

### High-Level Design

```
┌─────────────────────────────────────────────────────────────────┐
│                    Test Framework Layer                          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Test DSL (ScenarioBuilder, FluentAPI)                   │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Validation Engine                                        │   │
│  │  - EventOrderValidator                                    │   │
│  │  - StateTransitionValidator                               │   │
│  │  - StructuredConcurrencyValidator                         │   │
│  │  - TimingValidator                                        │   │
│  │  - FlowValidator                                          │   │
│  │  - ChannelValidator                                       │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                  Execution & Capture Layer                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  ScenarioExecutor                                         │   │
│  │  - Runs test scenarios                                    │   │
│  │  - Captures all events                                    │   │
│  │  - Controls timing (TestDispatcher)                       │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  EventCapture & Timeline                                  │   │
│  │  - Complete event stream                                  │   │
│  │  - Temporal ordering                                      │   │
│  │  - Causality tracking                                     │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│              VizSession & Instrumentation Layer                  │
│  (Existing - VizScope, VizDispatchers, Event Bus)               │
└─────────────────────────────────────────────────────────────────┘
```

### Core Components

#### 1. ScenarioBuilder
Fluent API for constructing test scenarios:
```kotlin
scenario("parent-with-children") {
    launch("parent") {
        delay(100)
        launch("child-1") {
            delay(200)
        }
        launch("child-2") {
            delay(300)
            throw CustomException()
        }
    }
}
```

#### 2. ValidationEngine
Validates captured events against expectations:
```kotlin
validate {
    eventOrder {
        created("parent") before started("parent")
        started("child-1") before started("child-2")
        completed("child-1") before failed("child-2")
    }
    
    structuredConcurrency {
        whenFails("child-2") {
            cancelled("parent")
            cancelled("child-1")
        }
    }
    
    timing {
        "child-1" completes at (300.ms ± 50.ms)
        "child-2" fails at (400.ms ± 50.ms)
    }
}
```

#### 3. EventCapture
Captures all events with full context:
```kotlin
data class CapturedEvent(
    val kind: String,
    val coroutineId: String,
    val label: String?,
    val timestamp: Long,
    val threadId: Long,
    val state: CoroutineState,
    val parentId: String?,
    val causedBy: String?, // For cancellations/failures
    val metadata: Map<String, Any>
)
```

#### 4. AssertionDSL
Rich assertions for coroutine behaviors:
```kotlin
assertions {
    coroutine("parent") {
        hasState(COMPLETED)
        hasChildren("child-1", "child-2")
        waited(forAllChildren = true)
    }
    
    hierarchy {
        depth equals 2
        totalCoroutines equals 3
        leafNodes contains "child-1"
    }
}
```

---

## Test DSL Design

### Scenario Definition DSL

#### Basic Launch Scenario
```kotlin
@Test
fun `test basic launch with delay`() = coroutineTest {
    // Define the scenario
    val scenario = scenario("basic-launch") {
        launch("worker") {
            delay(1000)
            log("Work complete")
        }
    }
    
    // Execute
    val result = execute(scenario)
    
    // Validate
    result.assert {
        eventSequence {
            created("worker")
            started("worker")
            suspended("worker", reason = "delay")
            resumed("worker")
            bodyCompleted("worker")
            completed("worker")
        }
        
        timing {
            totalDuration isApproximately 1000.ms
        }
        
        finalState {
            coroutine("worker") hasState COMPLETED
        }
    }
}
```

#### Nested Launch Scenario
```kotlin
@Test
fun `test nested launches with varying delays`() = coroutineTest {
    val scenario = scenario("nested-hierarchy") {
        launch("parent") {
            delay(50)
            
            launch("child-1") {
                delay(100)
                launch("grandchild-1-1") {
                    delay(200)
                }
            }
            
            launch("child-2") {
                delay(150)
                launch("grandchild-2-1") {
                    delay(100)
                }
            }
        }
    }
    
    val result = execute(scenario)
    
    result.assert {
        hierarchy {
            parent("parent") hasChildren listOf("child-1", "child-2")
            parent("child-1") hasChildren listOf("grandchild-1-1")
            parent("child-2") hasChildren listOf("grandchild-2-1")
            maxDepth equals 3
        }
        
        eventOrder {
            // Parent creates children first
            created("child-1") happensBefore created("grandchild-1-1")
            created("child-2") happensBefore created("grandchild-2-1")
            
            // Grandchildren complete before parents
            completed("grandchild-1-1") happensBefore completed("child-1")
            completed("grandchild-2-1") happensBefore completed("child-2")
            
            // All children complete before parent
            completed("child-1") happensBefore completed("parent")
            completed("child-2") happensBefore completed("parent")
        }
        
        timing {
            // Verify exact timing with tolerance
            "grandchild-1-1" completes at (350.ms ± 50.ms)  // 50 + 100 + 200
            "grandchild-2-1" completes at (300.ms ± 50.ms)  // 50 + 150 + 100
            "parent" completes at (350.ms ± 50.ms)  // Max of children
        }
        
        structuredConcurrency {
            // Verify parent waited for all children
            coroutine("parent") {
                emitted("WaitingForChildren") withCount 2
                bodyCompletedBefore childrenCompleted()
            }
        }
    }
}
```

#### Async/Await Scenario
```kotlin
@Test
fun `test async with multiple awaiters`() = coroutineTest {
    val scenario = scenario("async-multiple-awaiters") {
        launch("parent") {
            val deferred = async("compute") {
                delay(500)
                return@async 42
            }
            
            launch("awaiter-1") {
                val result = deferred.await()
                verify(result == 42)
            }
            
            launch("awaiter-2") {
                delay(100)
                val result = deferred.await()
                verify(result == 42)
            }
            
            launch("awaiter-3") {
                delay(200)
                val result = deferred.await()
                verify(result == 42)
            }
        }
    }
    
    val result = execute(scenario)
    
    result.assert {
        eventSequence {
            // Deferred creation and value availability
            created("compute")
            started("compute")
            after(500.ms) {
                event("DeferredValueAvailable", coroutine = "compute")
            }
            
            // All awaiters should resume after deferred completes
            event("DeferredAwaitStarted", coroutine = "awaiter-1")
            event("DeferredAwaitStarted", coroutine = "awaiter-2")
            event("DeferredAwaitStarted", coroutine = "awaiter-3")
            
            event("DeferredValueAvailable") happensBefore {
                allOf(
                    event("DeferredAwaitCompleted", coroutine = "awaiter-1"),
                    event("DeferredAwaitCompleted", coroutine = "awaiter-2"),
                    event("DeferredAwaitCompleted", coroutine = "awaiter-3")
                )
            }
        }
        
        deferredTracking {
            deferred("compute") {
                awaitedBy listOf("awaiter-1", "awaiter-2", "awaiter-3")
                valueAvailableAt (500.ms ± 50.ms)
            }
        }
        
        structuredConcurrency {
            // Parent waits for async coroutine even without explicit await
            coroutine("parent") {
                waited(forChildren = listOf("compute", "awaiter-1", "awaiter-2", "awaiter-3"))
            }
        }
    }
}
```

#### Exception Propagation Scenario
```kotlin
@Test
fun `test exception propagation in structured concurrency`() = coroutineTest {
    val scenario = scenario("exception-propagation") {
        launch("parent") {
            launch("child-ok") {
                delay(5000)  // Long-running, should be cancelled
            }
            
            delay(100)  // Ensure child-ok starts
            
            launch("child-fail") {
                delay(200)
                throw CustomException("Intentional failure")
            }
            
            // Parent body completes, but waits for children
        }
    }
    
    val result = execute(scenario)
    
    result.assert {
        exceptions {
            // Child-fail throws exception
            coroutine("child-fail") {
                throws<CustomException>()
                failsAt (300.ms ± 50.ms)  // 100 (parent delay) + 200
            }
            
            // Exception propagates to parent
            coroutine("parent") {
                cancelledDueTo("child-fail")
                stateTransition(ACTIVE to CANCELLED)
            }
            
            // Sibling is cancelled due to structured concurrency
            coroutine("child-ok") {
                cancelledDueTo("parent")  // Parent cancels children
                neverCompletes()
            }
        }
        
        eventOrder {
            failed("child-fail") happensBefore cancelled("parent")
            cancelled("parent") happensBefore cancelled("child-ok")
        }
        
        finalState {
            coroutine("child-fail") hasState FAILED
            coroutine("parent") hasState CANCELLED
            coroutine("child-ok") hasState CANCELLED
        }
        
        structuredConcurrency {
            verified()  // Ensures structured concurrency rules were followed
        }
    }
}
```

#### Flow Scenario
```kotlin
@Test
fun `test flow with backpressure and cancellation`() = coroutineTest {
    val scenario = scenario("flow-backpressure") {
        launch("producer") {
            flow {
                repeat(10) { i ->
                    delay(100)  // Slow producer
                    emit(i)
                }
            }.collect { value ->
                log("Received: $value")
                delay(200)  // Slow consumer - backpressure!
                
                if (value == 5) {
                    throw CancellationException("Stop at 5")
                }
            }
        }
    }
    
    val result = execute(scenario)
    
    result.assert {
        flow {
            coroutine("producer") {
                emittedValues(0, 1, 2, 3, 4, 5)
                notEmitted(6, 7, 8, 9)  // Cancelled before these
                
                emissionTiming {
                    each approximately every(100.ms)
                }
                
                backpressure {
                    detected()
                    collectionSlowerThan emission
                }
                
                cancellation {
                    cancelledAt value(5)
                    reason("Stop at 5")
                }
            }
        }
        
        timing {
            // Each value takes 100ms (emit) + 200ms (collect) = 300ms
            // 6 values = ~1800ms total
            totalDuration isApproximately (1800.ms ± 200.ms)
        }
    }
}
```

#### Channel Scenario
```kotlin
@Test
fun `test channel with multiple producers and consumers`() = coroutineTest {
    val scenario = scenario("channel-multi-producer-consumer") {
        val channel = Channel<Int>(capacity = 5)
        
        // Multiple producers
        launch("producer-1") {
            repeat(10) {
                channel.send(it)
                delay(50)
            }
        }
        
        launch("producer-2") {
            repeat(10) {
                channel.send(it + 100)
                delay(75)
            }
        }
        
        // Multiple consumers
        launch("consumer-1") {
            repeat(10) {
                val value = channel.receive()
                log("Consumer-1: $value")
                delay(100)
            }
        }
        
        launch("consumer-2") {
            repeat(10) {
                val value = channel.receive()
                log("Consumer-2: $value")
                delay(100)
            }
        }
    }
    
    val result = execute(scenario)
    
    result.assert {
        channel {
            capacity equals 5
            
            producers("producer-1", "producer-2") {
                totalItemsSent equals 20
            }
            
            consumers("consumer-1", "consumer-2") {
                totalItemsReceived equals 20
            }
            
            // Verify no items lost
            itemsSent equals itemsReceived
            
            buffering {
                maxBufferUsage lessThanOrEqual 5
                bufferOverflowOccurred(false)
            }
            
            synchronization {
                // Verify proper suspension/resumption
                producers suspendedWhen bufferFull
                consumers suspendedWhen bufferEmpty
            }
        }
        
        structuredConcurrency {
            // All producers/consumers should complete
            allCoroutines haveState COMPLETED
        }
    }
}
```

#### WithContext Scenario
```kotlin
@Test
fun `test withContext dispatcher switching`() = coroutineTest {
    val scenario = scenario("with-context-switching") {
        launch("main", dispatcher = Dispatchers.Default) {
            log("On Default: ${Thread.currentThread().name}")
            
            val result = withContext(Dispatchers.IO) {
                log("On IO: ${Thread.currentThread().name}")
                delay(500)
                "IO Result"
            }
            
            log("Back on Default: ${Thread.currentThread().name}")
            verify(result == "IO Result")
        }
    }
    
    val result = execute(scenario)
    
    result.assert {
        dispatchers {
            coroutine("main") {
                startedOn(Dispatchers.Default)
                switchedTo(Dispatchers.IO) at (50.ms ± 20.ms)
                switchedBackTo(Dispatchers.Default) at (550.ms ± 50.ms)
                endedOn(Dispatchers.Default)
            }
            
            eventSequence {
                event("DispatcherSelected", dispatcher = "Default")
                event("DispatcherSelected", dispatcher = "IO")
                event("DispatcherSelected", dispatcher = "Default")
            }
        }
        
        threads {
            // Should use different threads for different dispatchers
            usedThreads greaterThan 1
            threadFor(Dispatchers.Default) notEquals threadFor(Dispatchers.IO)
        }
    }
}
```

#### SupervisorScope Scenario
```kotlin
@Test
fun `test supervisor scope - sibling isolation`() = coroutineTest {
    val scenario = scenario("supervisor-scope") {
        supervisorScope("supervisor") {
            launch("child-1") {
                delay(100)
                throw RuntimeException("Child-1 fails")
            }
            
            launch("child-2") {
                delay(500)
                log("Child-2 completes successfully")
            }
            
            launch("child-3") {
                delay(300)
                log("Child-3 completes successfully")
            }
        }
    }
    
    val result = execute(scenario)
    
    result.assert {
        exceptions {
            coroutine("child-1") {
                throws<RuntimeException>()
            }
            
            // Supervisor scope prevents propagation to siblings
            coroutine("child-2") {
                notCancelled()
                completes successfully
            }
            
            coroutine("child-3") {
                notCancelled()
                completes successfully
            }
            
            coroutine("supervisor") {
                notCancelled()
                completes successfully
            }
        }
        
        structuredConcurrency {
            // Supervisor scope breaks normal cancellation propagation
            isolatedFailure("child-1") {
                doesNotCancel siblings
                doesNotCancel parent
            }
        }
        
        finalState {
            coroutine("child-1") hasState FAILED
            coroutine("child-2") hasState COMPLETED
            coroutine("child-3") hasState COMPLETED
            coroutine("supervisor") hasState COMPLETED
        }
    }
}
```

---

## Validation System

### Event Order Validator

Validates temporal ordering of events:

```kotlin
interface EventOrderValidator {
    fun before(event1: EventMatcher, event2: EventMatcher): Validation
    fun after(event1: EventMatcher, event2: EventMatcher): Validation
    fun between(event: EventMatcher, start: EventMatcher, end: EventMatcher): Validation
    fun sequence(vararg events: EventMatcher): Validation
    fun concurrent(vararg events: EventMatcher, within: Duration): Validation
}

// Usage
eventOrder {
    created("parent") before started("parent")
    started("parent") before created("child-1")
    
    sequence(
        created("parent"),
        started("parent"),
        created("child-1"),
        started("child-1"),
        completed("child-1"),
        completed("parent")
    )
    
    // Child-1 and child-2 start concurrently
    concurrent(
        started("child-1"),
        started("child-2"),
        within = 100.ms
    )
}
```

### State Transition Validator

Validates coroutine state machine transitions:

```kotlin
interface StateTransitionValidator {
    fun validTransition(from: CoroutineState, to: CoroutineState): Boolean
    fun transitionPath(coroutine: String, vararg states: CoroutineState): Validation
    fun neverReached(coroutine: String, state: CoroutineState): Validation
}

// Usage
stateTransitions {
    coroutine("worker") {
        transitions(
            CREATED,
            ACTIVE,
            SUSPENDED,
            ACTIVE,
            COMPLETED
        )
        
        neverReached(CANCELLED)
        neverReached(FAILED)
    }
    
    coroutine("failed-worker") {
        transitions(
            CREATED,
            ACTIVE,
            FAILED
        )
    }
}
```

### Structured Concurrency Validator

Validates structured concurrency rules:

```kotlin
interface StructuredConcurrencyValidator {
    // Parent waits for all children
    fun parentWaitsForChildren(parent: String): Validation
    
    // Child failure cancels parent and siblings
    fun childFailureCancelsFamily(child: String): Validation
    
    // Parent cancellation cancels children
    fun parentCancellationCancelsChildren(parent: String): Validation
    
    // Supervisor scope isolation
    fun supervisorIsolatesFailures(supervisor: String): Validation
}

// Usage
structuredConcurrency {
    // Verify parent waits
    coroutine("parent") {
        waitsForChildren("child-1", "child-2", "child-3")
        bodyCompletes before childrenComplete
        coroutineCompletes after childrenComplete
        
        emitted("WaitingForChildren") {
            withActiveCount(3) // Initially
            withActiveCount(2) // After child-1 completes
            withActiveCount(1) // After child-2 completes
            withActiveCount(0) // After child-3 completes
        }
    }
    
    // Verify exception propagation
    whenFails("child-2") {
        cancels("parent")
        cancels("child-1")
        cancels("child-3")
        
        order {
            failed("child-2") happens first
            cancelled("parent") happens second
            cancelled("child-1", "child-3") happen last
        }
    }
    
    // Verify parent cancellation propagates
    whenCancelled("parent") {
        cancels allChildren
        cancels allDescendants
        
        noCancellationPropagatesTo parent
    }
}
```

### Timing Validator

Validates temporal relationships and durations:

```kotlin
interface TimingValidator {
    fun duration(coroutine: String, expected: Duration, tolerance: Duration): Validation
    fun completesAt(coroutine: String, timestamp: Duration, tolerance: Duration): Validation
    fun delay(duration: Duration, tolerance: Duration): Validation
}

// Usage
timing {
    // Absolute timing from scenario start
    coroutine("child-1") {
        startsAt (100.ms ± 20.ms)
        completesAt (500.ms ± 50.ms)
        totalDuration isApproximately (400.ms ± 50.ms)
        activeDuration isApproximately (400.ms ± 50.ms)
        suspendedDuration isApproximately (0.ms)
    }
    
    // Relative timing
    coroutine("child-2") {
        startsAfter("child-1")
        completesBefore("parent")
        duration shorterThan "child-1"
    }
    
    // Suspension timing
    coroutine("worker") {
        suspended(count = 3)
        suspensionDurations approximately listOf(100.ms, 200.ms, 300.ms)
        totalSuspendedTime isApproximately (600.ms ± 100.ms)
    }
}
```

### Flow Validator

Validates Flow behavior:

```kotlin
interface FlowValidator {
    fun emittedValues(flow: String, vararg values: Any): Validation
    fun emissionRate(flow: String, rate: Duration): Validation
    fun collectionRate(flow: String, rate: Duration): Validation
    fun backpressure(flow: String): BackpressureValidation
    fun cancellation(flow: String, reason: String): Validation
}

// Usage
flow {
    producer("data-stream") {
        emitted(values = listOf(1, 2, 3, 4, 5))
        emissionRate approximately every(100.ms)
        
        backpressure {
            detected()
            maximumBufferSize equals 10
            bufferOverflow(false)
        }
        
        cancelled {
            at value(5)
            reason("User cancellation")
            cleanupExecuted()
        }
    }
    
    consumer("data-processor") {
        received(values = listOf(1, 2, 3, 4, 5))
        processingRate approximately every(200.ms)
        
        slowConsumer {
            isSlowerThan producer
            causesBackpressure()
        }
    }
}
```

### Channel Validator

Validates Channel behavior:

```kotlin
interface ChannelValidator {
    fun capacity(expected: Int): Validation
    fun itemsSent(count: Int): Validation
    fun itemsReceived(count: Int): Validation
    fun bufferUsage(max: Int): Validation
    fun suspension(reason: String): Validation
}

// Usage
channel("work-queue") {
    capacity equals 10
    
    producers {
        count equals 3
        totalItemsSent equals 100
        suspended when bufferFull
    }
    
    consumers {
        count equals 2
        totalItemsReceived equals 100
        suspended when bufferEmpty
    }
    
    integrity {
        noItemsLost()
        fifoOrdering()
        allItemsConsumed()
    }
    
    performance {
        avgBufferUsage between (3 to 7)
        maxBufferUsage lessThanOrEqual 10
        throughput approximately (10 items per second)
    }
}
```

---

## Scenario Types

### 1. Basic Launch Scenarios

**Single Launch**
```kotlin
scenario("single-launch") {
    launch("worker") {
        delay(1000)
    }
}
```

**Parallel Launches**
```kotlin
scenario("parallel-launches") {
    launch("worker-1") { delay(1000) }
    launch("worker-2") { delay(1500) }
    launch("worker-3") { delay(800) }
}
```

**Sequential Launches**
```kotlin
scenario("sequential-launches") {
    launch("worker-1") {
        delay(1000)
    }.join()
    
    launch("worker-2") {
        delay(1000)
    }.join()
}
```

### 2. Nested Hierarchies

**Simple Nesting**
```kotlin
scenario("simple-nesting") {
    launch("parent") {
        launch("child-1") { delay(500) }
        launch("child-2") { delay(1000) }
    }
}
```

**Deep Nesting**
```kotlin
scenario("deep-nesting") {
    launch("L1") {
        launch("L2") {
            launch("L3") {
                launch("L4") {
                    launch("L5") {
                        delay(1000)
                    }
                }
            }
        }
    }
}
```

**Wide Tree**
```kotlin
scenario("wide-tree") {
    launch("root") {
        repeat(10) { i ->
            launch("child-$i") {
                delay((i + 1) * 100L)
            }
        }
    }
}
```

### 3. Async/Await Scenarios

**Basic Async**
```kotlin
scenario("basic-async") {
    launch("parent") {
        val result = async("compute") {
            delay(1000)
            42
        }.await()
        verify(result == 42)
    }
}
```

**Multiple Async**
```kotlin
scenario("multiple-async") {
    launch("parent") {
        val d1 = async("compute-1") { delay(500); 1 }
        val d2 = async("compute-2") { delay(1000); 2 }
        val d3 = async("compute-3") { delay(800); 3 }
        
        val sum = d1.await() + d2.await() + d3.await()
        verify(sum == 6)
    }
}
```

**Async with Exception**
```kotlin
scenario("async-exception") {
    launch("parent") {
        val deferred = async("compute") {
            delay(500)
            throw RuntimeException("Computation failed")
        }
        
        try {
            deferred.await()
        } catch (e: RuntimeException) {
            log("Caught: ${e.message}")
        }
    }
}
```

### 4. Exception Scenarios

**Child Failure**
```kotlin
scenario("child-failure") {
    launch("parent") {
        launch("good-child") { delay(5000) }
        launch("bad-child") {
            delay(500)
            throw RuntimeException("Failure")
        }
    }
}
```

**Multiple Failures**
```kotlin
scenario("multiple-failures") {
    launch("parent") {
        launch("fail-1") {
            delay(100)
            throw RuntimeException("Fail 1")
        }
        launch("fail-2") {
            delay(200)
            throw RuntimeException("Fail 2")
        }
    }
}
```

### 5. Cancellation Scenarios

**Explicit Cancellation**
```kotlin
scenario("explicit-cancellation") {
    val job = launch("worker") {
        repeat(100) {
            delay(100)
            log("Iteration $it")
        }
    }
    
    delay(550)  // Let it run for a bit
    job.cancel("User requested cancellation")
}
```

**Timeout Cancellation**
```kotlin
scenario("timeout-cancellation") {
    launch("parent") {
        withTimeout(1000) {
            launch("long-worker") {
                delay(5000)  // Will timeout
            }
        }
    }
}
```

### 6. Flow Scenarios

**Basic Flow**
```kotlin
scenario("basic-flow") {
    launch("consumer") {
        flow {
            repeat(5) {
                emit(it)
                delay(100)
            }
        }.collect { value ->
            log("Received: $value")
        }
    }
}
```

**Flow with Operators**
```kotlin
scenario("flow-operators") {
    launch("consumer") {
        flow {
            repeat(10) { emit(it) }
        }
        .map { it * 2 }
        .filter { it > 5 }
        .take(5)
        .collect { value ->
            log("Value: $value")
        }
    }
}
```

**Flow Cancellation**
```kotlin
scenario("flow-cancellation") {
    launch("consumer") {
        flow {
            repeat(100) {
                emit(it)
                delay(100)
            }
        }.collect { value ->
            log("Value: $value")
            if (value == 5) {
                throw CancellationException("Stop")
            }
        }
    }
}
```

### 7. Channel Scenarios

**Basic Channel**
```kotlin
scenario("basic-channel") {
    val channel = Channel<Int>(capacity = 5)
    
    launch("producer") {
        repeat(10) {
            channel.send(it)
            delay(100)
        }
        channel.close()
    }
    
    launch("consumer") {
        for (value in channel) {
            log("Received: $value")
            delay(150)
        }
    }
}
```

**Fan-Out**
```kotlin
scenario("fan-out") {
    val channel = Channel<Int>()
    
    launch("producer") {
        repeat(100) {
            channel.send(it)
        }
        channel.close()
    }
    
    repeat(3) { i ->
        launch("consumer-$i") {
            for (value in channel) {
                log("Consumer $i: $value")
                delay(100)
            }
        }
    }
}
```

**Fan-In**
```kotlin
scenario("fan-in") {
    val channel = Channel<Int>()
    
    repeat(3) { i ->
        launch("producer-$i") {
            repeat(10) {
                channel.send(i * 100 + it)
                delay(100)
            }
        }
    }
    
    launch("consumer") {
        repeat(30) {
            val value = channel.receive()
            log("Received: $value")
        }
    }
}
```

### 8. Context Scenarios

**WithContext**
```kotlin
scenario("with-context") {
    launch("worker") {
        val result = withContext(Dispatchers.IO) {
            delay(1000)
            "IO Result"
        }
        log("Result: $result")
    }
}
```

**Nested WithContext**
```kotlin
scenario("nested-with-context") {
    launch("worker", dispatcher = Dispatchers.Default) {
        withContext(Dispatchers.IO) {
            delay(500)
            withContext(Dispatchers.Default) {
                delay(500)
            }
        }
    }
}
```

### 9. Supervisor Scenarios

**Basic Supervisor**
```kotlin
scenario("basic-supervisor") {
    supervisorScope {
        launch("child-1") {
            delay(100)
            throw RuntimeException("Fail")
        }
        launch("child-2") {
            delay(500)
            log("Success")
        }
    }
}
```

**Nested Supervisor**
```kotlin
scenario("nested-supervisor") {
    launch("parent") {
        supervisorScope {
            launch("supervised-1") {
                throw RuntimeException("Isolated failure")
            }
            launch("supervised-2") {
                delay(1000)
            }
        }
        // Parent continues even if supervised-1 fails
        log("Parent continues")
    }
}
```

---

## Event Ordering Validation

### Timeline Analysis

The framework captures a complete timeline of events and provides rich APIs for validation:

```kotlin
data class Timeline(
    val events: List<CapturedEvent>,
    val startTime: Long,
    val endTime: Long
) {
    // Query events
    fun eventsFor(coroutine: String): List<CapturedEvent>
    fun eventsOfKind(kind: String): List<CapturedEvent>
    fun eventsBetween(start: Long, end: Long): List<CapturedEvent>
    
    // Ordering queries
    fun happensBefore(event1: CapturedEvent, event2: CapturedEvent): Boolean
    fun happensAfter(event1: CapturedEvent, event2: CapturedEvent): Boolean
    fun happensConcurrently(event1: CapturedEvent, event2: CapturedEvent, threshold: Duration): Boolean
    
    // Temporal queries
    fun timeBetween(event1: CapturedEvent, event2: CapturedEvent): Duration
    fun durationOf(coroutine: String): Duration
    
    // Causality tracking
    fun causedBy(event: CapturedEvent): CapturedEvent?
    fun causes(event: CapturedEvent): List<CapturedEvent>
}
```

### Ordering Patterns

**Sequential Ordering**
```kotlin
eventOrder {
    // Strict sequence
    sequence(
        created("parent"),
        started("parent"),
        created("child"),
        started("child"),
        completed("child"),
        bodyCompleted("parent"),
        completed("parent")
    )
}
```

**Happens-Before Relationships**
```kotlin
eventOrder {
    // Parent-child creation order
    created("parent") happensBefore created("child")
    started("parent") happensBefore started("child")
    
    // Child completion before parent
    completed("child") happensBefore completed("parent")
    
    // Exception propagation order
    failed("child") happensBefore cancelled("parent")
    cancelled("parent") happensBefore cancelled("sibling")
}
```

**Concurrent Events**
```kotlin
eventOrder {
    // Multiple children start concurrently
    concurrent(
        started("child-1"),
        started("child-2"),
        started("child-3"),
        within = 50.ms
    )
    
    // But created in order
    created("child-1") happensBefore created("child-2")
    created("child-2") happensBefore created("child-3")
}
```

**Time-Bounded Events**
```kotlin
eventOrder {
    // Event occurs within time window
    completed("worker") {
        between(900.ms to 1100.ms)  // Expected at ~1000ms
    }
    
    // Events occur in specific windows
    within(0.ms to 100.ms) {
        created("parent")
        started("parent")
    }
    
    within(100.ms to 200.ms) {
        created("child-1")
        created("child-2")
    }
}
```

### Causality Tracking

Track cause-and-effect relationships:

```kotlin
causality {
    // Exception causes cancellation
    failed("child") causes cancelled("parent")
    cancelled("parent") causes cancelled("sibling")
    
    // Completion enables resumption
    completed("async-task") causes resumed("awaiter")
    
    // Send enables receive
    sent("producer", value = 42) causes received("consumer", value = 42)
    
    // Channel close causes completion
    closed("channel") causes completed("consumer")
}
```

---

## Exception & Cancellation Testing

### Exception Propagation

**Basic Exception Propagation**
```kotlin
exceptions {
    // Verify exception is thrown
    coroutine("worker") {
        throws<RuntimeException>()
        message contains "Intentional failure"
        stackTrace includes "worker.kt:42"
    }
    
    // Verify propagation path
    propagation {
        originates("child")
        propagatesTo("parent")
        propagatesTo siblings("child-2", "child-3")
    }
    
    // Verify timing
    timing {
        thrownAt (500.ms ± 50.ms)
        propagatedWithin (50.ms)
    }
}
```

**Multiple Exceptions**
```kotlin
exceptions {
    // First exception wins in structured concurrency
    coroutine("child-1") {
        throws<CustomException1>()
        throwsAt (100.ms)
    }
    
    coroutine("child-2") {
        throws<CustomException2>()
        throwsAt (200.ms)
    }
    
    // Parent is cancelled by first exception
    coroutine("parent") {
        cancelledBy("child-1")
        cancellationCause is CustomException1
        neverSeesException<CustomException2>()
    }
}
```

**Exception Handling**
```kotlin
exceptions {
    coroutine("parent") {
        // Exception is caught and handled
        tryCatch {
            catches<RuntimeException>()
            handledBy("parent")
            doesNotPropagate()
        }
    }
    
    // Siblings not affected
    coroutine("sibling") {
        notCancelled()
        completes successfully
    }
}
```

### Cancellation Testing

**Explicit Cancellation**
```kotlin
cancellation {
    // Job is cancelled explicitly
    coroutine("worker") {
        cancelledExplicitly()
        cancellationReason("User requested")
        
        // Verify cleanup
        cleanup {
            executed()
            releasedResources()
            completedWithin (100.ms)
        }
    }
}
```

**Propagated Cancellation**
```kotlin
cancellation {
    // Parent cancellation propagates
    whenCancelled("parent") {
        propagatesTo allChildren
        propagatesTo allDescendants
        
        order {
            cancelled("parent") happens first
            then cancelled("child-1", "child-2")
            then cancelled("grandchild-1", "grandchild-2")
        }
        
        timing {
            propagatesWithin (100.ms)
        }
    }
}
```

**Cooperative Cancellation**
```kotlin
cancellation {
    coroutine("cooperative-worker") {
        // Checks isActive regularly
        checksActiveState(frequency = every(100.ms))
        
        // Responds to cancellation
        respondsTo cancellation within (150.ms)
        
        // Cleanup is executed
        cleanup {
            executed()
            releasedResources("database", "network")
        }
    }
    
    coroutine("non-cooperative-worker") {
        // Never checks isActive
        doesNotCheckActiveState()
        
        // Takes long to cancel
        respondsTo cancellation within (5000.ms)
    }
}
```

**Timeout Cancellation**
```kotlin
cancellation {
    coroutine("timeout-worker") {
        timeout(1000.ms)
        
        // Worker takes too long
        runsFor (5000.ms)
        
        // Is cancelled by timeout
        cancelledBy timeout
        cancellationType is TimeoutCancellationException
        
        timing {
            cancelledAt (1000.ms ± 50.ms)
        }
    }
}
```

**Non-Cancellable Sections**
```kotlin
cancellation {
    coroutine("critical-worker") {
        // Has non-cancellable section
        nonCancellable {
            duration approximately (500.ms)
            completes evenIfCancelled
        }
        
        // Cancellation happens after critical section
        cancelledAfter nonCancellableSection
    }
}
```

---

## Flow & Channel Testing

### Flow Testing

**Emission Validation**
```kotlin
flow("data-stream") {
    // Values
    emits(values = listOf(1, 2, 3, 4, 5))
    emitOrder is strict
    noDuplicates()
    
    // Timing
    firstEmission at (100.ms ± 20.ms)
    lastEmission at (500.ms ± 50.ms)
    emissionInterval approximately every(100.ms)
    
    // Completion
    completes successfully
    emittedAllValues()
}
```

**Operator Validation**
```kotlin
flow("processed-stream") {
    source("raw-stream")
    
    operators {
        applied("map", "filter", "take")
        
        transformation("map") {
            input values listOf(1, 2, 3, 4, 5)
            output values listOf(2, 4, 6, 8, 10)
            transformation is (x -> x * 2)
        }
        
        transformation("filter") {
            input values listOf(2, 4, 6, 8, 10)
            output values listOf(6, 8, 10)
            predicate is (x -> x > 5)
        }
        
        transformation("take") {
            input values listOf(6, 8, 10)
            output values listOf(6, 8, 10)
            limit is 5
        }
    }
}
```

**Backpressure Testing**
```kotlin
flow("backpressure-stream") {
    producer {
        emissionRate approximately every(100.ms)
        totalEmissions equals 10
    }
    
    consumer {
        collectionRate approximately every(500.ms)
        totalCollections equals 10
    }
    
    backpressure {
        detected()
        consumer isSlowerThan producer
        
        buffering {
            strategy is BufferOverflow.SUSPEND
            maxBufferSize equals 64
            actualMaxUsage lessThan 64
        }
        
        // Producer suspends when buffer full
        producerSuspensions {
            count greaterThan 0
            totalSuspendedTime approximately (2000.ms)
        }
    }
}
```

**Flow Cancellation**
```kotlin
flow("cancellable-stream") {
    emits(1, 2, 3, 4, 5)
    
    cancellation {
        cancelledAt value(5)
        reason("User cancellation")
        
        cleanup {
            executed()
            releasedResources()
        }
        
        // Remaining values not emitted
        notEmitted(6, 7, 8, 9, 10)
    }
}
```

**Cold vs Hot Flows**
```kotlin
flow("cold-flow") {
    type is ColdFlow
    
    // Each collector gets own emissions
    collector("consumer-1") {
        receives(1, 2, 3, 4, 5)
        startsAt (0.ms)
    }
    
    collector("consumer-2") {
        receives(1, 2, 3, 4, 5)  // Same values!
        startsAt (500.ms)
    }
    
    // Emissions are independent
    emissions("consumer-1") notSharedWith emissions("consumer-2")
}

sharedFlow("hot-flow") {
    type is HotFlow
    replay equals 2
    
    // Collectors share emissions
    collector("consumer-1") {
        receives(1, 2, 3, 4, 5)
        startsAt (0.ms)
    }
    
    collector("consumer-2") {
        receives(3, 4, 5)  // Starts late, misses 1 and 2
        startsAt (250.ms)
        receivesReplayed(2, 3)  // Gets replay buffer
    }
}

stateFlow("state-flow") {
    type is StateFlow
    initialValue equals 0
    
    updates(1, 2, 3, 4, 5)
    
    collector("consumer-1") {
        receives initialValue
        receives updates(1, 2, 3, 4, 5)
    }
    
    collector("consumer-2") {
        startsAt (250.ms)
        receives currentValue(3)  // Gets current state immediately
        receives updates(4, 5)
    }
}
```

### Channel Testing

**Send/Receive Validation**
```kotlin
channel("work-queue") {
    capacity equals 10
    overflow is BufferOverflow.SUSPEND
    
    producer("producer-1") {
        sends(values = (0..99).toList())
        sendRate approximately every(50.ms)
        
        suspensions {
            suspendedWhen bufferFull
            count approximately 5
        }
    }
    
    consumer("consumer-1") {
        receives(count = 100)
        receiveRate approximately every(100.ms)
        
        suspensions {
            suspendedWhen bufferEmpty
            count approximately 10
        }
    }
    
    integrity {
        allSentItems wereReceived
        fifoOrdering maintained
        noDuplicates()
        noLostItems()
    }
}
```

**Buffer Management**
```kotlin
channel("buffered-channel") {
    capacity equals 10
    
    buffering {
        avgUsage between (3 to 7)
        maxUsage equals 10
        minUsage equals 0
        
        // Buffer evolution over time
        timeline {
            at(0.ms) bufferSize equals 0
            at(500.ms) bufferSize approximately 5
            at(1000.ms) bufferSize approximately 8
            at(1500.ms) bufferSize approximately 3
        }
        
        // Buffer never overflows
        overflowOccurred(false)
    }
}
```

**Multiple Producers/Consumers**
```kotlin
channel("shared-queue") {
    producers(count = 3) {
        producer("producer-1") sends 100 items
        producer("producer-2") sends 150 items
        producer("producer-3") sends 200 items
        
        totalSent equals 450
    }
    
    consumers(count = 2) {
        consumer("consumer-1") receives approximately 225 items
        consumer("consumer-2") receives approximately 225 items
        
        totalReceived equals 450
        
        // Load balancing
        loadDistribution isBalanced (tolerance = 10%)
    }
    
    fairness {
        allProducers hadChanceTo send
        allConsumers hadChanceTo receive
        noStarvation()
    }
}
```

**Channel Closing**
```kotlin
channel("closeable-channel") {
    producer("producer") {
        sends(1, 2, 3, 4, 5)
        closes channel at (500.ms)
    }
    
    consumer("consumer") {
        receives(1, 2, 3, 4, 5)
        detectsClose()
        exitsGracefully()
        completes after channelClose
    }
    
    closing {
        closedBy("producer")
        closedAt (500.ms ± 50.ms)
        cause is ChannelClosed
        
        // No more sends after close
        noSubsequentSends()
        
        // Existing items still consumed
        bufferedItems wereConsumed
    }
}
```

**Conflated Channels**
```kotlin
channel("conflated-channel") {
    type is ConflatedChannel
    capacity equals 1
    overflow is BufferOverflow.DROP_OLDEST
    
    producer("fast-producer") {
        sends(values = (0..99).toList())
        sendRate approximately every(10.ms)
        neverSuspends()  // Never blocks
    }
    
    consumer("slow-consumer") {
        receiveRate approximately every(100.ms)
        receives approximately 10 items  // Most are dropped
        
        // Receives only latest values
        receivedValues are mostRecent
    }
    
    conflation {
        droppedItems approximately 90
        retentionRate approximately 10%
        alwaysHasLatest value
    }
}
```

---

## Timing & Determinism

### Controlled Test Execution

Use `TestDispatcher` for deterministic timing:

```kotlin
@Test
fun `test with controlled time`() = coroutineTest {
    // Use virtual time
    val testScheduler = TestCoroutineScheduler()
    val testDispatcher = StandardTestDispatcher(testScheduler)
    
    val scenario = scenario("timed-scenario") {
        launch("worker", dispatcher = testDispatcher) {
            delay(1000)
            log("After 1 second")
            delay(2000)
            log("After 3 seconds total")
        }
    }
    
    val result = execute(scenario, scheduler = testScheduler)
    
    // Time is virtual - test runs instantly
    // but events occur at correct virtual timestamps
    
    result.assert {
        timing {
            // Uses virtual time
            logEvent("After 1 second") at (1000.ms exactly)
            logEvent("After 3 seconds total") at (3000.ms exactly)
            
            // Total virtual time
            totalDuration equals (3000.ms exactly)
            
            // Real execution time is near-zero
            realExecutionTime lessThan (100.ms)
        }
    }
}
```

### Timing Tolerance

Handle timing variability in real dispatchers:

```kotlin
timing {
    // Exact timing (for TestDispatcher)
    completes at (1000.ms exactly)
    
    // With tolerance (for real dispatchers)
    completes at (1000.ms ± 100.ms)
    completes at (1000.ms ± 10.percent)
    
    // Range
    completes between (900.ms to 1100.ms)
    
    // Relative timing (always deterministic)
    "child-1" completes before "child-2"
    "child-2" starts after "child-1"
    
    // Duration relationships
    "child-1" duration approximately "child-2" duration
    "child-1" duration lessThan "child-2" duration
}
```

### Deterministic Validation

Focus on deterministic properties:

```kotlin
// ❌ Non-deterministic - thread scheduling varies
assertions {
    threadId("worker") equals 42  // BAD: Thread ID varies
    exactTimestamp("worker") equals 1234567890  // BAD: Timing varies
}

// ✅ Deterministic - always true regardless of scheduling
assertions {
    // Ordering is deterministic
    created("parent") happensBefore created("child")
    completed("child") happensBefore completed("parent")
    
    // State transitions are deterministic
    coroutine("worker") transitioned (CREATED -> ACTIVE -> COMPLETED)
    
    // Structured concurrency is deterministic
    whenFails("child") then cancelled("parent")
    
    // Causality is deterministic
    failed("child") caused cancelled("parent")
}
```

---

## Implementation Guide

### Step 1: Core Framework Classes

```kotlin
// TestScenario.kt
data class TestScenario(
    val name: String,
    val root: CoroutineNode
)

sealed class CoroutineNode {
    abstract val label: String
    abstract val children: List<CoroutineNode>
    
    data class Launch(
        override val label: String,
        val dispatcher: CoroutineDispatcher? = null,
        val block: suspend CoroutineScope.() -> Unit,
        override val children: List<CoroutineNode> = emptyList()
    ) : CoroutineNode()
    
    data class Async(
        override val label: String,
        val dispatcher: CoroutineDispatcher? = null,
        val block: suspend CoroutineScope.() -> Int,
        override val children: List<CoroutineNode> = emptyList()
    ) : CoroutineNode()
    
    data class WithContext(
        override val label: String,
        val dispatcher: CoroutineDispatcher,
        val block: suspend CoroutineScope.() -> Unit,
        override val children: List<CoroutineNode> = emptyList()
    ) : CoroutineNode()
}

// ScenarioExecutor.kt
class ScenarioExecutor(
    private val session: VizSession
) {
    suspend fun execute(scenario: TestScenario): ExecutionResult {
        val events = mutableListOf<CapturedEvent>()
        
        // Subscribe to all events
        val collector = launch {
            session.bus.stream().collect { event ->
                events.add(captureEvent(event))
            }
        }
        
        // Execute the scenario
        val startTime = System.nanoTime()
        try {
            executeNode(scenario.root)
        } finally {
            val endTime = System.nanoTime()
            collector.cancel()
            
            return ExecutionResult(
                scenario = scenario,
                events = events,
                timeline = Timeline(events, startTime, endTime),
                session = session
            )
        }
    }
    
    private suspend fun executeNode(node: CoroutineNode) {
        when (node) {
            is CoroutineNode.Launch -> executeLaunch(node)
            is CoroutineNode.Async -> executeAsync(node)
            is CoroutineNode.WithContext -> executeWithContext(node)
        }
    }
    
    private suspend fun executeLaunch(node: CoroutineNode.Launch) {
        val scope = VizScope(session, context = node.dispatcher ?: EmptyCoroutineContext)
        scope.vizLaunch(label = node.label, block = node.block).join()
    }
    
    // ... other execution methods
}

// ExecutionResult.kt
data class ExecutionResult(
    val scenario: TestScenario,
    val events: List<CapturedEvent>,
    val timeline: Timeline,
    val session: VizSession
) {
    fun assert(block: AssertionContext.() -> Unit) {
        val context = AssertionContext(this)
        context.block()
        context.validate()
    }
}
```

### Step 2: Assertion DSL

```kotlin
// AssertionContext.kt
class AssertionContext(
    private val result: ExecutionResult
) {
    private val validators = mutableListOf<Validator>()
    
    fun eventOrder(block: EventOrderContext.() -> Unit) {
        val context = EventOrderContext(result.timeline)
        context.block()
        validators.add(context.build())
    }
    
    fun timing(block: TimingContext.() -> Unit) {
        val context = TimingContext(result.timeline)
        context.block()
        validators.add(context.build())
    }
    
    fun structuredConcurrency(block: StructuredConcurrencyContext.() -> Unit) {
        val context = StructuredConcurrencyContext(result)
        context.block()
        validators.add(context.build())
    }
    
    fun validate() {
        validators.forEach { validator ->
            val result = validator.validate()
            if (!result.success) {
                throw AssertionError(result.message)
            }
        }
    }
}

// EventOrderContext.kt
class EventOrderContext(
    private val timeline: Timeline
) {
    private val constraints = mutableListOf<OrderConstraint>()
    
    infix fun EventMatcher.happensBefore(other: EventMatcher) {
        constraints.add(OrderConstraint.Before(this, other))
    }
    
    infix fun EventMatcher.happensAfter(other: EventMatcher) {
        constraints.add(OrderConstraint.After(this, other))
    }
    
    fun sequence(vararg events: EventMatcher) {
        events.zipWithNext().forEach { (first, second) ->
            first happensBefore second
        }
    }
    
    fun build(): Validator {
        return EventOrderValidator(timeline, constraints)
    }
}

// EventMatcher.kt
data class EventMatcher(
    val kind: String? = null,
    val coroutineLabel: String? = null,
    val state: CoroutineState? = null
) {
    fun matches(event: CapturedEvent): Boolean {
        if (kind != null && event.kind != kind) return false
        if (coroutineLabel != null && event.label != coroutineLabel) return false
        if (state != null && event.state != state) return false
        return true
    }
}

// Helper functions
fun created(label: String) = EventMatcher(kind = "CoroutineCreated", coroutineLabel = label)
fun started(label: String) = EventMatcher(kind = "CoroutineStarted", coroutineLabel = label)
fun completed(label: String) = EventMatcher(kind = "CoroutineCompleted", coroutineLabel = label)
fun cancelled(label: String) = EventMatcher(kind = "CoroutineCancelled", coroutineLabel = label)
fun failed(label: String) = EventMatcher(kind = "CoroutineFailed", coroutineLabel = label)
```

### Step 3: Validators

```kotlin
// EventOrderValidator.kt
class EventOrderValidator(
    private val timeline: Timeline,
    private val constraints: List<OrderConstraint>
) : Validator {
    override fun validate(): ValidationResult {
        val violations = mutableListOf<String>()
        
        for (constraint in constraints) {
            when (constraint) {
                is OrderConstraint.Before -> {
                    val event1 = timeline.findFirst(constraint.first)
                    val event2 = timeline.findFirst(constraint.second)
                    
                    if (event1 == null) {
                        violations.add("Event not found: ${constraint.first}")
                    } else if (event2 == null) {
                        violations.add("Event not found: ${constraint.second}")
                    } else if (event1.timestamp >= event2.timestamp) {
                        violations.add(
                            "Expected ${constraint.first} before ${constraint.second}, " +
                            "but ${constraint.first} at ${event1.timestamp}ns " +
                            "and ${constraint.second} at ${event2.timestamp}ns"
                        )
                    }
                }
                // ... other constraints
            }
        }
        
        return if (violations.isEmpty()) {
            ValidationResult.Success
        } else {
            ValidationResult.Failure(violations.joinToString("\n"))
        }
    }
}

// StructuredConcurrencyValidator.kt
class StructuredConcurrencyValidator(
    private val result: ExecutionResult
) : Validator {
    override fun validate(): ValidationResult {
        val violations = mutableListOf<String>()
        
        // Verify parents wait for children
        for (coroutine in result.session.snapshot.coroutines.values) {
            if (coroutine.children.isNotEmpty()) {
                validateParentWaitsForChildren(coroutine, violations)
            }
        }
        
        // Verify exception propagation
        val failedCoroutines = result.timeline.eventsOfKind("CoroutineFailed")
        for (failedEvent in failedCoroutines) {
            validateExceptionPropagation(failedEvent, violations)
        }
        
        // Verify cancellation propagation
        val cancelledCoroutines = result.timeline.eventsOfKind("CoroutineCancelled")
        for (cancelledEvent in cancelledCoroutines) {
            validateCancellationPropagation(cancelledEvent, violations)
        }
        
        return if (violations.isEmpty()) {
            ValidationResult.Success
        } else {
            ValidationResult.Failure(violations.joinToString("\n"))
        }
    }
    
    private fun validateParentWaitsForChildren(
        parent: CoroutineNode,
        violations: MutableList<String>
    ) {
        // Find parent's body completion event
        val bodyCompleted = result.timeline.findFirst(
            EventMatcher(kind = "CoroutineBodyCompleted", coroutineLabel = parent.label)
        )
        
        // Find parent's completion event
        val parentCompleted = result.timeline.findFirst(
            EventMatcher(kind = "CoroutineCompleted", coroutineLabel = parent.label)
        )
        
        if (bodyCompleted == null || parentCompleted == null) return
        
        // Find all children completion events
        for (childId in parent.children) {
            val child = result.session.snapshot.coroutines[childId] ?: continue
            val childCompleted = result.timeline.findFirst(
                EventMatcher(kind = "CoroutineCompleted", coroutineLabel = child.label)
            )
            
            if (childCompleted != null && childCompleted.timestamp > parentCompleted.timestamp) {
                violations.add(
                    "Parent ${parent.label} completed before child ${child.label}"
                )
            }
        }
        
        // Verify WaitingForChildren event was emitted
        val waitingEvent = result.timeline.findFirst(
            EventMatcher(kind = "WaitingForChildren", coroutineLabel = parent.label)
        )
        
        if (waitingEvent == null && parent.children.isNotEmpty()) {
            violations.add(
                "Parent ${parent.label} did not emit WaitingForChildren event"
            )
        }
    }
    
    private fun validateExceptionPropagation(
        failedEvent: CapturedEvent,
        violations: MutableList<String>
    ) {
        // Find parent
        val parentId = failedEvent.parentId ?: return
        val parent = result.session.snapshot.coroutines[parentId] ?: return
        
        // Parent should be cancelled (unless supervisor scope)
        val parentCancelled = result.timeline.findFirst(
            EventMatcher(kind = "CoroutineCancelled", coroutineLabel = parent.label)
        )
        
        if (parentCancelled == null) {
            violations.add(
                "Parent ${parent.label} was not cancelled when child ${failedEvent.label} failed"
            )
        }
        
        // All siblings should be cancelled
        for (siblingId in parent.children) {
            if (siblingId == failedEvent.coroutineId) continue
            
            val sibling = result.session.snapshot.coroutines[siblingId] ?: continue
            val siblingCancelled = result.timeline.findFirst(
                EventMatcher(kind = "CoroutineCancelled", coroutineLabel = sibling.label)
            )
            
            if (siblingCancelled == null) {
                violations.add(
                    "Sibling ${sibling.label} was not cancelled when ${failedEvent.label} failed"
                )
            }
        }
    }
    
    private fun validateCancellationPropagation(
        cancelledEvent: CapturedEvent,
        violations: MutableList<String>
    ) {
        // Find coroutine
        val coroutine = result.session.snapshot.coroutines.values.find {
            it.label == cancelledEvent.label
        } ?: return
        
        // All children should be cancelled
        for (childId in coroutine.children) {
            val child = result.session.snapshot.coroutines[childId] ?: continue
            val childCancelled = result.timeline.findFirst(
                EventMatcher(kind = "CoroutineCancelled", coroutineLabel = child.label)
            )
            
            if (childCancelled == null) {
                violations.add(
                    "Child ${child.label} was not cancelled when parent ${coroutine.label} was cancelled"
                )
            }
        }
    }
}
```

### Step 4: Test Utilities

```kotlin
// CoroutineTestScope.kt
fun coroutineTest(
    timeout: Duration = 60.seconds,
    block: suspend CoroutineTestScope.() -> Unit
) = runTest(timeout = timeout) {
    val testScope = CoroutineTestScopeImpl(this)
    testScope.block()
}

class CoroutineTestScopeImpl(
    private val testScope: TestScope
) : CoroutineTestScope {
    private val sessions = mutableListOf<VizSession>()
    
    override fun scenario(name: String, block: ScenarioBuilder.() -> Unit): TestScenario {
        val builder = ScenarioBuilder(name)
        builder.block()
        return builder.build()
    }
    
    override suspend fun execute(
        scenario: TestScenario,
        scheduler: TestCoroutineScheduler? = null
    ): ExecutionResult {
        val session = VizSession(scenario.name)
        sessions.add(session)
        
        val executor = ScenarioExecutor(session)
        return executor.execute(scenario)
    }
    
    override fun tearDown() {
        sessions.forEach { it.close() }
        sessions.clear()
    }
}

// ScenarioBuilder.kt
class ScenarioBuilder(private val name: String) {
    private val nodes = mutableListOf<CoroutineNode>()
    
    fun launch(
        label: String,
        dispatcher: CoroutineDispatcher? = null,
        block: suspend CoroutineScope.() -> Unit
    ) {
        nodes.add(CoroutineNode.Launch(label, dispatcher, block))
    }
    
    fun async(
        label: String,
        dispatcher: CoroutineDispatcher? = null,
        block: suspend CoroutineScope.() -> Int
    ) {
        nodes.add(CoroutineNode.Async(label, dispatcher, block))
    }
    
    fun build(): TestScenario {
        require(nodes.isNotEmpty()) { "Scenario must have at least one coroutine" }
        return TestScenario(name, nodes.first())
    }
}

// Extension functions
val Int.ms get() = Duration.milliseconds(this)
val Int.seconds get() = Duration.seconds(this)

infix fun Duration.±(tolerance: Duration) = TimingRange(this, tolerance)
infix fun Duration.to(end: Duration) = DurationRange(this, end)
```

---

## Best Practices

### 1. Focus on Deterministic Properties

```kotlin
// ✅ Good: Tests deterministic behavior
@Test
fun `parent waits for children - always true`() = coroutineTest {
    val scenario = scenario("parent-waits") {
        launch("parent") {
            launch("child-1") { delay(100) }
            launch("child-2") { delay(200) }
        }
    }
    
    val result = execute(scenario)
    
    result.assert {
        eventOrder {
            completed("child-1") happensBefore completed("parent")
            completed("child-2") happensBefore completed("parent")
        }
    }
}

// ❌ Bad: Tests non-deterministic behavior
@Test
fun `child-1 completes before child-2 - might fail`() = coroutineTest {
    val scenario = scenario("race-condition") {
        launch("child-1") { delay(100) }
        launch("child-2") { delay(100) }  // Same delay - race!
    }
    
    val result = execute(scenario)
    
    result.assert {
        // This might fail randomly due to scheduling
        completed("child-1") happensBefore completed("child-2")
    }
}
```

### 2. Use Virtual Time for Precise Timing

```kotlin
// ✅ Good: Uses virtual time
@Test
fun `exact timing with virtual time`() = coroutineTest {
    val scheduler = TestCoroutineScheduler()
    
    val scenario = scenario("timed") {
        launch("worker") {
            delay(1000)
        }
    }
    
    val result = execute(scenario, scheduler = scheduler)
    
    result.assert {
        timing {
            // Exact timing is possible with virtual time
            completes at (1000.ms exactly)
        }
    }
}

// ⚠️ Acceptable: Real time with tolerance
@Test
fun `approximate timing with real dispatchers`() = coroutineTest {
    val scenario = scenario("real-time") {
        launch("worker", dispatcher = Dispatchers.Default) {
            delay(1000)
        }
    }
    
    val result = execute(scenario)
    
    result.assert {
        timing {
            // Must use tolerance with real dispatchers
            completes at (1000.ms ± 100.ms)
        }
    }
}
```

### 3. Test Edge Cases

```kotlin
@Test
fun `empty parent - no children`() = coroutineTest {
    val scenario = scenario("empty-parent") {
        launch("parent") {
            // No children launched
            delay(100)
        }
    }
    
    val result = execute(scenario)
    
    result.assert {
        hierarchy {
            coroutine("parent") hasChildren emptyList()
        }
        
        // No WaitingForChildren event
        events {
            doesNotContain("WaitingForChildren")
        }
    }
}

@Test
fun `all children fail`() = coroutineTest {
    val scenario = scenario("all-fail") {
        launch("parent") {
            launch("child-1") { throw Exception("Fail 1") }
            launch("child-2") { throw Exception("Fail 2") }
        }
    }
    
    val result = execute(scenario)
    
    result.assert {
        exceptions {
            // First failure wins
            firstFailure is "child-1" or "child-2"
            
            // Parent and all children cancelled/failed
            allCoroutines haveState (CANCELLED or FAILED)
        }
    }
}
```

### 4. Use Descriptive Labels

```kotlin
// ✅ Good: Clear, descriptive labels
scenario("user-registration-flow") {
    launch("api-handler") {
        val validationResult = async("validate-input") { ... }
        val userRecord = async("create-user-record") { ... }
        launch("send-welcome-email") { ... }
    }
}

// ❌ Bad: Generic labels
scenario("test") {
    launch("l1") {
        async("a1") { ... }
        async("a2") { ... }
        launch("l2") { ... }
    }
}
```

### 5. Compose Reusable Scenarios

```kotlin
// Reusable scenario components
fun ScenarioBuilder.standardWorker(label: String, duration: Duration) {
    launch(label) {
        delay(duration.inWholeMilliseconds)
    }
}

fun ScenarioBuilder.failingWorker(label: String, delay: Duration, error: String) {
    launch(label) {
        delay(delay.inWholeMilliseconds)
        throw RuntimeException(error)
    }
}

// Compose into complex scenarios
@Test
fun `complex workflow`() = coroutineTest {
    val scenario = scenario("workflow") {
        launch("coordinator") {
            standardWorker("phase-1", 500.ms)
            standardWorker("phase-2", 1000.ms)
            failingWorker("phase-3", 200.ms, "Validation failed")
        }
    }
    
    // ... assertions
}
```

### 6. Document Expected Behavior

```kotlin
@Test
fun `structured concurrency - parent waits for children`() = coroutineTest {
    /**
     * Expected behavior:
     * 1. Parent launches 3 children with different durations
     * 2. Parent body completes immediately
     * 3. Parent emits WaitingForChildren event
     * 4. Parent waits for all children to complete
     * 5. Children complete in order: child-1 (500ms), child-2 (1000ms), child-3 (1500ms)
     * 6. Parent completes after child-3 (longest)
     * 
     * This validates the core principle of structured concurrency:
     * a parent coroutine waits for all its children before completing.
     */
    
    val scenario = scenario("parent-waits") {
        launch("parent") {
            launch("child-1") { delay(500) }
            launch("child-2") { delay(1000) }
            launch("child-3") { delay(1500) }
            // Parent body ends here, but coroutine waits
        }
    }
    
    val result = execute(scenario)
    
    result.assert {
        // ... assertions matching documented behavior
    }
}
```

---

## Integration Examples

### Example 1: Complete Test Suite

```kotlin
class CoroutineFrameworkTest {
    
    @Test
    fun `basic launch test`() = coroutineTest {
        val scenario = scenario("basic-launch") {
            launch("worker") {
                delay(1000)
            }
        }
        
        val result = execute(scenario)
        
        result.assert {
            eventSequence {
                created("worker")
                started("worker")
                suspended("worker")
                resumed("worker")
                bodyCompleted("worker")
                completed("worker")
            }
            
            finalState {
                coroutine("worker") hasState COMPLETED
            }
        }
    }
    
    @Test
    fun `nested hierarchy test`() = coroutineTest {
        val scenario = scenario("nested") {
            launch("parent") {
                delay(50)
                launch("child-1") {
                    delay(100)
                }
                launch("child-2") {
                    delay(200)
                }
            }
        }
        
        val result = execute(scenario)
        
        result.assert {
            hierarchy {
                coroutine("parent") hasChildren listOf("child-1", "child-2")
                maxDepth equals 2
            }
            
            eventOrder {
                completed("child-1") happensBefore completed("parent")
                completed("child-2") happensBefore completed("parent")
            }
            
            structuredConcurrency {
                coroutine("parent") {
                    waited(forAllChildren = true)
                }
            }
        }
    }
    
    @Test
    fun `exception propagation test`() = coroutineTest {
        val scenario = scenario("exception-prop") {
            launch("parent") {
                launch("good-child") {
                    delay(5000)
                }
                delay(100)
                launch("bad-child") {
                    delay(200)
                    throw RuntimeException("Failure")
                }
            }
        }
        
        val result = execute(scenario)
        
        result.assert {
            exceptions {
                coroutine("bad-child") {
                    throws<RuntimeException>()
                    message contains "Failure"
                }
                
                coroutine("parent") {
                    cancelledDueTo("bad-child")
                }
                
                coroutine("good-child") {
                    cancelledDueTo("parent")
                    neverCompletes()
                }
            }
            
            finalState {
                coroutine("bad-child") hasState FAILED
                coroutine("parent") hasState CANCELLED
                coroutine("good-child") hasState CANCELLED
            }
            
            structuredConcurrency {
                verified()
            }
        }
    }
    
    @Test
    fun `async await test`() = coroutineTest {
        val scenario = scenario("async-await") {
            launch("parent") {
                val deferred = async("compute") {
                    delay(500)
                    42
                }
                
                launch("awaiter") {
                    val result = deferred.await()
                    verify(result == 42)
                }
            }
        }
        
        val result = execute(scenario)
        
        result.assert {
            deferredTracking {
                deferred("compute") {
                    awaitedBy listOf("awaiter")
                    valueAvailableAt (500.ms ± 50.ms)
                }
            }
            
            eventOrder {
                event("DeferredValueAvailable", coroutine = "compute") happensBefore
                    event("DeferredAwaitCompleted", coroutine = "awaiter")
            }
        }
    }
    
    @Test
    fun `flow test`() = coroutineTest {
        val scenario = scenario("flow") {
            launch("consumer") {
                flow {
                    repeat(5) {
                        emit(it)
                        delay(100)
                    }
                }.collect { value ->
                    log("Received: $value")
                    delay(200)
                }
            }
        }
        
        val result = execute(scenario)
        
        result.assert {
            flow {
                coroutine("consumer") {
                    emittedValues(0, 1, 2, 3, 4)
                    
                    backpressure {
                        detected()
                        consumer isSlowerThan producer
                    }
                }
            }
        }
    }
    
    @Test
    fun `channel test`() = coroutineTest {
        val scenario = scenario("channel") {
            val channel = Channel<Int>(capacity = 5)
            
            launch("producer") {
                repeat(10) {
                    channel.send(it)
                    delay(50)
                }
                channel.close()
            }
            
            launch("consumer") {
                for (value in channel) {
                    log("Received: $value")
                    delay(100)
                }
            }
        }
        
        val result = execute(scenario)
        
        result.assert {
            channel {
                capacity equals 5
                
                producer("producer") {
                    sends count 10
                }
                
                consumer("consumer") {
                    receives count 10
                }
                
                integrity {
                    allItemsConsumed()
                    fifoOrdering()
                }
            }
        }
    }
    
    @Test
    fun `supervisor scope test`() = coroutineTest {
        val scenario = scenario("supervisor") {
            supervisorScope {
                launch("child-1") {
                    delay(100)
                    throw RuntimeException("Fail")
                }
                launch("child-2") {
                    delay(500)
                }
            }
        }
        
        val result = execute(scenario)
        
        result.assert {
            exceptions {
                coroutine("child-1") {
                    throws<RuntimeException>()
                }
                
                coroutine("child-2") {
                    notCancelled()
                    completes successfully
                }
            }
            
            structuredConcurrency {
                isolatedFailure("child-1") {
                    doesNotCancel siblings
                }
            }
        }
    }
}
```

### Example 2: Real-World Scenario

```kotlin
@Test
fun `API request with database and external service`() = coroutineTest {
    val scenario = scenario("api-request") {
        launch("http-handler") {
            // Validate request
            async("validate-request") {
                delay(50)
                true
            }.await()
            
            // Parallel: fetch user and check auth
            val user = async("fetch-user") {
                withContext(Dispatchers.IO) {
                    delay(200)
                    User("123", "John")
                }
            }
            
            val authOk = async("check-auth") {
                withContext(Dispatchers.IO) {
                    delay(100)
                    true
                }
            }
            
            user.await()
            authOk.await()
            
            // Sequential: save then notify
            withContext(Dispatchers.IO) {
                launch("save-to-db") {
                    delay(300)
                }
            }.join()
            
            launch("send-notification") {
                delay(100)
            }.join()
            
            // Return response
        }
    }
    
    val result = execute(scenario)
    
    result.assert {
        hierarchy {
            coroutine("http-handler") hasChildren listOf(
                "validate-request",
                "fetch-user",
                "check-auth",
                "save-to-db",
                "send-notification"
            )
        }
        
        eventOrder {
            // Validation happens first
            completed("validate-request") happensBefore started("fetch-user")
            
            // fetch-user and check-auth run in parallel
            concurrent(
                started("fetch-user"),
                started("check-auth"),
                within = 50.ms
            )
            
            // Both complete before save
            completed("fetch-user") happensBefore started("save-to-db")
            completed("check-auth") happensBefore started("save-to-db")
            
            // Save completes before notification
            completed("save-to-db") happensBefore started("send-notification")
            
            // Notification completes before handler
            completed("send-notification") happensBefore completed("http-handler")
        }
        
        dispatchers {
            coroutine("fetch-user") usedDispatcher Dispatchers.IO
            coroutine("check-auth") usedDispatcher Dispatchers.IO
            coroutine("save-to-db") usedDispatcher Dispatchers.IO
        }
        
        timing {
            // Validation: ~50ms
            "validate-request" duration approximately (50.ms)
            
            // Parallel section: max(200ms, 100ms) = 200ms
            parallel("fetch-user", "check-auth") duration approximately (200.ms)
            
            // Sequential: 300ms + 100ms = 400ms
            sequential("save-to-db", "send-notification") duration approximately (400.ms)
            
            // Total: 50 + 200 + 400 = 650ms
            totalDuration approximately (650.ms ± 100.ms)
        }
        
        structuredConcurrency {
            verified()
            coroutine("http-handler") waited forAllChildren
        }
    }
}
```

---

## Conclusion

This comprehensive testing framework provides:

1. **Complete Coverage** - All coroutine constructs (launch, async, Flow, Channel, withContext)
2. **Rich Assertions** - Fluent DSL for expressing complex expectations
3. **Deterministic Testing** - Focus on reliable, repeatable tests
4. **Structured Concurrency Validation** - Verify core principles automatically
5. **Exception & Cancellation Testing** - Comprehensive error scenario support
6. **Timing Validation** - Both virtual and real-time testing
7. **Event Ordering** - Temporal relationships and causality tracking
8. **Extensibility** - Easy to add new validators and matchers

### Next Steps

1. **Implement Core Framework** - Build the basic infrastructure
2. **Add Validators** - Implement each validator type
3. **Create Test Suite** - Write comprehensive tests using the framework
4. **Documentation** - API docs and usage examples
5. **Integration** - Connect with existing VizSession infrastructure
6. **Tooling** - IDE plugins, test generators, visual reports

### Benefits

- **Catch Bugs Early** - Comprehensive validation finds subtle issues
- **Living Documentation** - Tests document expected behavior
- **Refactoring Safety** - Tests verify behavior doesn't change
- **Teaching Tool** - Clear examples of coroutine behavior
- **Production Ready** - Framework suitable for real-world testing

---

**End of Document**

