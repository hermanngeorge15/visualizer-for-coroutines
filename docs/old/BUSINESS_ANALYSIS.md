# Business Analysis: Kotlin Coroutines Visualizer

## Executive Summary

This document provides a comprehensive business and technical analysis for building a Kotlin coroutines visualization framework using Ktor backend and React + TypeScript frontend. The system will enable developers to understand, debug, and teach coroutine concepts through rich, interactive visualizations of coroutine lifecycle, structured concurrency, dispatchers, and common concurrency patterns.

---

## 1. High-Level Mental Model

### 1.1 Conceptual Model

Kotlin coroutines can be represented as a **hierarchical, time-based event system** with four primary dimensions:

1. **Structural Dimension**: Hierarchy of scopes → jobs → coroutines
2. **Temporal Dimension**: Timeline of events (creation, suspension, resumption, completion)
3. **Execution Dimension**: Dispatchers → threads → actual execution context
4. **Data Flow Dimension**: Channels, flows, and communication between coroutines

### 1.2 Data Representation

The visualization system models coroutines as a **directed acyclic graph (DAG)** with temporal annotations:

```
Graph Structure:
- Nodes: Scopes, Jobs, Coroutines, Dispatchers, Threads
- Edges: Parent-child relationships, dispatcher assignments, data dependencies
- Events: Time-stamped state changes (creation, suspension, cancellation, etc.)
- Timelines: Ordered sequences of events per entity
```

**Core Entities:**

| Entity | Purpose | Visual Representation |
|--------|---------|----------------------|
| Scope | Lifecycle boundary | Container/box with children |
| Job | Cancellable unit of work | Node in hierarchy tree |
| Coroutine | Executable suspendable function | Animated flow element |
| Dispatcher | Scheduling policy | Color-coded pool |
| Thread | OS execution context | Horizontal swimlane |
| Event | State transition | Point on timeline |

### 1.3 Relationships

```
CoroutineScope
  └─ Has many Jobs (parent-child)
       └─ Each Job has 0-1 Coroutine
            └─ Executes on Dispatcher
                 └─ Runs on Thread(s)
```

**Key Relationships:**
- **Structural Concurrency**: Parent job cancellation cascades to children
- **Dispatcher Binding**: Coroutines are assigned to dispatchers at creation or via `withContext`
- **Thread Mapping**: Dispatchers manage thread pools; coroutines may switch threads
- **Data Flow**: Channels/Flows connect coroutines for communication

---

## 2. Core Backend Architecture (Ktor-Based)

### 2.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Ktor Application                      │
├─────────────────────────────────────────────────────────┤
│  HTTP/WebSocket Routes                                   │
│  - /api/events (SSE)                                     │
│  - /api/snapshots/{executionId}                          │
│  - /api/executions                                       │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│              Visualization Framework Core               │
├─────────────────────────────────────────────────────────┤
│  Event Bus                                              │
│  - EventEmitter                                          │
│  - EventCollector                                        │
│  - EventStore (in-memory + optional persistence)        │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│              Instrumentation Layer                       │
├─────────────────────────────────────────────────────────┤
│  Wrappers:                                               │
│  - TrackedCoroutineScope                                │
│  - TrackedDispatcher                                     │
│  - TrackedJob                                            │
│  - TrackedFlow                                           │
│  - TrackedChannel                                        │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│            Real Kotlin Coroutines APIs                   │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Key Components

#### 2.2.1 Event Bus System

**EventBus**
- **Responsibility**: Central hub for all coroutine events
- **Features**: Thread-safe event emission, multiple subscribers, filtering
- **Interface**:
  ```kotlin
  interface EventBus {
      fun emit(event: CoroutineEvent)
      fun subscribe(filter: EventFilter): Flow<CoroutineEvent>
      fun getHistory(executionId: String): List<CoroutineEvent>
  }
  ```

**EventCollector**
- **Responsibility**: Aggregates events into execution sessions
- **Features**: Session management, snapshot generation
- **Interface**:
  ```kotlin
  interface EventCollector {
      fun startExecution(name: String): String // returns executionId
      fun endExecution(executionId: String)
      fun getSnapshot(executionId: String): ExecutionSnapshot
  }
  ```

#### 2.2.2 Instrumentation Components

**CoroutineTrackerContext**
- **Responsibility**: Thread-local context for tracking active coroutines
- **Features**: Hierarchical ID generation, parent tracking
- **Implementation**: Uses CoroutineContext.Element

**DispatcherInterceptor**
- **Responsibility**: Intercepts dispatcher operations
- **Features**: Thread assignment tracking, context switches
- **Approach**: Decorates ContinuationInterceptor

#### 2.2.3 Ktor Integration Layer

**VisualizationModule**
- **Responsibility**: Ktor plugin for visualization framework
- **Features**: Automatic setup, route registration, lifecycle management
- **Usage**:
  ```kotlin
  fun Application.module() {
      install(VisualizationFramework) {
          enableWebSocket = true
          enableSSE = true
          historySize = 10000
      }
  }
  ```

**API Routes**
- **GET /api/executions**: List all execution sessions
- **GET /api/events/{executionId}**: SSE stream of events
- **GET /api/snapshot/{executionId}**: Current state snapshot
- **POST /api/executions**: Start new tracked execution
- **WebSocket /ws/events**: Bidirectional event stream

### 2.3 Component Interactions

1. **User Code** calls wrapped coroutine builder (e.g., `trackedLaunch`)
2. **Wrapper** generates unique IDs and emits `CoroutineCreated` event
3. **Wrapper** delegates to real coroutine API
4. **Interceptor** catches suspension points and emits `CoroutineSuspended`
5. **EventBus** broadcasts events to all subscribers
6. **EventCollector** aggregates events into execution session
7. **Ktor Routes** stream events to frontend via SSE/WebSocket

---

## 3. Event Model & Data Structures

### 3.1 Event Hierarchy

```kotlin
sealed class CoroutineEvent {
    abstract val eventId: String
    abstract val timestamp: Long
    abstract val executionId: String
}

// Lifecycle Events
sealed class LifecycleEvent : CoroutineEvent()

data class CoroutineCreated(
    override val eventId: String,
    override val timestamp: Long,
    override val executionId: String,
    val coroutineId: String,
    val parentId: String?,
    val scopeId: String,
    val name: String?,
    val dispatcher: String,
    val sourceLocation: SourceLocation?
) : LifecycleEvent()

data class CoroutineSuspended(
    override val eventId: String,
    override val timestamp: Long,
    override val executionId: String,
    val coroutineId: String,
    val suspensionPoint: String,
    val reason: SuspensionReason
) : LifecycleEvent()

data class CoroutineResumed(
    override val eventId: String,
    override val timestamp: Long,
    override val executionId: String,
    val coroutineId: String,
    val threadId: Long,
    val dispatcher: String
) : LifecycleEvent()

data class CoroutineCompleted(
    override val eventId: String,
    override val timestamp: Long,
    override val executionId: String,
    val coroutineId: String,
    val result: CompletionResult
) : LifecycleEvent()

data class CoroutineCancelled(
    override val eventId: String,
    override val timestamp: Long,
    override val executionId: String,
    val coroutineId: String,
    val cause: String?,
    val propagatedFrom: String?
) : LifecycleEvent()

// Dispatcher Events
sealed class DispatcherEvent : CoroutineEvent()

data class DispatcherSelected(
    override val eventId: String,
    override val timestamp: Long,
    override val executionId: String,
    val coroutineId: String,
    val dispatcherId: String,
    val dispatcherType: DispatcherType
) : DispatcherEvent()

data class ThreadAssigned(
    override val eventId: String,
    override val timestamp: Long,
    override val executionId: String,
    val coroutineId: String,
    val threadId: Long,
    val threadName: String
) : DispatcherEvent()

data class ContextSwitched(
    override val eventId: String,
    override val timestamp: Long,
    override val executionId: String,
    val coroutineId: String,
    val fromDispatcher: String,
    val toDispatcher: String,
    val fromThread: Long?,
    val toThread: Long?
) : DispatcherEvent()

// Flow Events
sealed class FlowEvent : CoroutineEvent()

data class FlowCreated(
    override val eventId: String,
    override val timestamp: Long,
    override val executionId: String,
    val flowId: String,
    val sourceCoroutineId: String?
) : FlowEvent()

data class FlowCollected(
    override val eventId: String,
    override val timestamp: Long,
    override val executionId: String,
    val flowId: String,
    val collectorCoroutineId: String
) : FlowEvent()

data class ValueEmitted(
    override val eventId: String,
    override val timestamp: Long,
    override val executionId: String,
    val flowId: String,
    val value: String, // serialized
    val emitterCoroutineId: String?
) : FlowEvent()

// Channel Events
sealed class ChannelEvent : CoroutineEvent()

data class ChannelCreated(
    override val eventId: String,
    override val timestamp: Long,
    override val executionId: String,
    val channelId: String,
    val capacity: Int,
    val creatorCoroutineId: String?
) : ChannelEvent()

data class ChannelSend(
    override val eventId: String,
    override val timestamp: Long,
    override val executionId: String,
    val channelId: String,
    val senderCoroutineId: String,
    val value: String,
    val suspended: Boolean
) : ChannelEvent()

data class ChannelReceive(
    override val eventId: String,
    override val timestamp: Long,
    override val executionId: String,
    val channelId: String,
    val receiverCoroutineId: String,
    val value: String?,
    val suspended: Boolean
) : ChannelEvent()

// Exception Events
sealed class ExceptionEvent : CoroutineEvent()

data class ExceptionThrown(
    override val eventId: String,
    override val timestamp: Long,
    override val executionId: String,
    val coroutineId: String,
    val exceptionType: String,
    val message: String?,
    val stackTrace: List<String>
) : ExceptionEvent()

data class ExceptionHandled(
    override val eventId: String,
    override val timestamp: Long,
    override val executionId: String,
    val coroutineId: String,
    val exceptionType: String,
    val handlerType: HandlerType
) : ExceptionEvent()

data class ExceptionPropagated(
    override val eventId: String,
    override val timestamp: Long,
    override val executionId: String,
    val fromCoroutineId: String,
    val toCoroutineId: String,
    val exceptionType: String
) : ExceptionEvent()
```

### 3.2 Supporting Data Classes

```kotlin
data class SourceLocation(
    val file: String,
    val line: Int,
    val function: String
)

enum class SuspensionReason {
    DELAY,
    CHANNEL_SEND,
    CHANNEL_RECEIVE,
    MUTEX,
    SEMAPHORE,
    JOIN,
    AWAIT,
    FLOW_COLLECT,
    CUSTOM
}

sealed class CompletionResult {
    data class Success(val value: String?) : CompletionResult()
    data class Failure(val exception: String) : CompletionResult()
}

enum class DispatcherType {
    DEFAULT,
    IO,
    MAIN,
    UNCONFINED,
    CUSTOM
}

enum class HandlerType {
    TRY_CATCH,
    EXCEPTION_HANDLER,
    SUPERVISOR_SCOPE
}

data class ExecutionSnapshot(
    val executionId: String,
    val startTime: Long,
    val endTime: Long?,
    val scopes: List<ScopeInfo>,
    val coroutines: List<CoroutineInfo>,
    val dispatchers: List<DispatcherInfo>,
    val threads: List<ThreadInfo>,
    val relationships: List<Relationship>
)

data class ScopeInfo(
    val id: String,
    val name: String?,
    val parentId: String?,
    val active: Boolean,
    val jobs: List<String>
)

data class CoroutineInfo(
    val id: String,
    val name: String?,
    val parentId: String?,
    val state: CoroutineState,
    val dispatcher: String,
    val currentThread: Long?,
    val createdAt: Long,
    val completedAt: Long?
)

enum class CoroutineState {
    CREATED,
    ACTIVE,
    SUSPENDED,
    COMPLETED,
    CANCELLED
}

data class DispatcherInfo(
    val id: String,
    val type: DispatcherType,
    val parallelism: Int?,
    val queueSize: Int
)

data class ThreadInfo(
    val id: Long,
    val name: String,
    val activeCoroutine: String?
)

data class Relationship(
    val type: RelationType,
    val fromId: String,
    val toId: String,
    val metadata: Map<String, String> = emptyMap()
)

enum class RelationType {
    PARENT_CHILD,
    DISPATCHER_ASSIGNMENT,
    CHANNEL_COMMUNICATION,
    FLOW_DEPENDENCY,
    EXCEPTION_PROPAGATION
}
```

### 3.3 Example Event Stream

**Scenario**: Simple async/await with cancellation

```kotlin
// User code
val execution = visualizer.startExecution("simple-async")
trackedScope {
    val deferred = trackedAsync {
        delay(1000)
        "result"
    }
    delay(500)
    deferred.cancel()
}
visualizer.endExecution(execution)
```

**Generated Events**:

```json
[
  {
    "type": "ExecutionStarted",
    "executionId": "exec_001",
    "timestamp": 1700000000000,
    "name": "simple-async"
  },
  {
    "type": "ScopeCreated",
    "eventId": "ev_001",
    "executionId": "exec_001",
    "timestamp": 1700000000001,
    "scopeId": "scope_001",
    "name": "tracked-scope"
  },
  {
    "type": "CoroutineCreated",
    "eventId": "ev_002",
    "executionId": "exec_001",
    "timestamp": 1700000000002,
    "coroutineId": "co_001",
    "parentId": null,
    "scopeId": "scope_001",
    "name": "async-worker",
    "dispatcher": "Dispatchers.Default"
  },
  {
    "type": "ThreadAssigned",
    "eventId": "ev_003",
    "executionId": "exec_001",
    "timestamp": 1700000000003,
    "coroutineId": "co_001",
    "threadId": 12345,
    "threadName": "DefaultDispatcher-worker-1"
  },
  {
    "type": "CoroutineSuspended",
    "eventId": "ev_004",
    "executionId": "exec_001",
    "timestamp": 1700000000004,
    "coroutineId": "co_001",
    "suspensionPoint": "delay",
    "reason": "DELAY"
  },
  {
    "type": "CoroutineResumed",
    "eventId": "ev_005",
    "executionId": "exec_001",
    "timestamp": 1700000000504,
    "coroutineId": "co_001",
    "threadId": 12346,
    "dispatcher": "Dispatchers.Default"
  },
  {
    "type": "CoroutineCancelled",
    "eventId": "ev_006",
    "executionId": "exec_001",
    "timestamp": 1700000000550,
    "coroutineId": "co_001",
    "cause": "Job was cancelled",
    "propagatedFrom": null
  }
]
```

---

## 4. Wrappers for Major Coroutine Primitives

### 4.1 TrackedCoroutineScope

```kotlin
class TrackedCoroutineScope(
    private val underlying: CoroutineScope,
    private val eventBus: EventBus,
    private val executionId: String,
    private val scopeId: String = generateId(),
    private val name: String? = null
) : CoroutineScope by underlying {

    init {
        eventBus.emit(ScopeCreated(
            eventId = generateId(),
            timestamp = System.currentTimeMillis(),
            executionId = executionId,
            scopeId = scopeId,
            name = name
        ))
    }

    override val coroutineContext: CoroutineContext
        get() = underlying.coroutineContext + 
                TrackerContext(scopeId, eventBus, executionId)
}

// User-facing builder
fun visualizer.trackedScope(
    name: String? = null,
    block: suspend TrackedCoroutineScope.() -> Unit
): Job {
    val scope = TrackedCoroutineScope(
        underlying = CoroutineScope(Dispatchers.Default),
        eventBus = this.eventBus,
        executionId = this.currentExecution,
        name = name
    )
    return scope.launch { block() }
}
```

### 4.2 Wrapped Launch/Async

```kotlin
fun TrackedCoroutineScope.trackedLaunch(
    dispatcher: CoroutineDispatcher = Dispatchers.Default,
    name: String? = null,
    block: suspend CoroutineScope.() -> Unit
): Job {
    val coroutineId = generateId()
    val parentId = coroutineContext[TrackerContext]?.currentCoroutineId
    
    eventBus.emit(CoroutineCreated(
        eventId = generateId(),
        timestamp = System.currentTimeMillis(),
        executionId = executionId,
        coroutineId = coroutineId,
        parentId = parentId,
        scopeId = scopeId,
        name = name,
        dispatcher = dispatcher.toString(),
        sourceLocation = captureSourceLocation()
    ))
    
    val trackedDispatcher = TrackedDispatcher(dispatcher, eventBus, executionId)
    
    return underlying.launch(trackedDispatcher + TrackerContext(coroutineId)) {
        try {
            eventBus.emit(ThreadAssigned(
                eventId = generateId(),
                timestamp = System.currentTimeMillis(),
                executionId = executionId,
                coroutineId = coroutineId,
                threadId = Thread.currentThread().id,
                threadName = Thread.currentThread().name
            ))
            
            block()
            
            eventBus.emit(CoroutineCompleted(
                eventId = generateId(),
                timestamp = System.currentTimeMillis(),
                executionId = executionId,
                coroutineId = coroutineId,
                result = CompletionResult.Success(null)
            ))
        } catch (e: CancellationException) {
            eventBus.emit(CoroutineCancelled(
                eventId = generateId(),
                timestamp = System.currentTimeMillis(),
                executionId = executionId,
                coroutineId = coroutineId,
                cause = e.message,
                propagatedFrom = null
            ))
            throw e
        } catch (e: Exception) {
            eventBus.emit(ExceptionThrown(
                eventId = generateId(),
                timestamp = System.currentTimeMillis(),
                executionId = executionId,
                coroutineId = coroutineId,
                exceptionType = e::class.simpleName ?: "Unknown",
                message = e.message,
                stackTrace = e.stackTrace.take(10).map { it.toString() }
            ))
            throw e
        }
    }
}

fun <T> TrackedCoroutineScope.trackedAsync(
    dispatcher: CoroutineDispatcher = Dispatchers.Default,
    name: String? = null,
    block: suspend CoroutineScope.() -> T
): Deferred<T> {
    // Similar implementation to trackedLaunch but returns Deferred
    // Tracks result value on completion
}
```

### 4.3 Tracked Dispatcher

```kotlin
class TrackedDispatcher(
    private val underlying: CoroutineDispatcher,
    private val eventBus: EventBus,
    private val executionId: String
) : CoroutineDispatcher() {

    private val dispatcherId = generateId()
    
    override fun dispatch(context: CoroutineContext, block: Runnable) {
        val coroutineId = context[TrackerContext]?.currentCoroutineId
        
        underlying.dispatch(context, Runnable {
            if (coroutineId != null) {
                eventBus.emit(ThreadAssigned(
                    eventId = generateId(),
                    timestamp = System.currentTimeMillis(),
                    executionId = executionId,
                    coroutineId = coroutineId,
                    threadId = Thread.currentThread().id,
                    threadName = Thread.currentThread().name
                ))
            }
            block.run()
        })
    }
}

// Tracked withContext
suspend fun <T> trackedWithContext(
    dispatcher: CoroutineDispatcher,
    block: suspend CoroutineScope.() -> T
): T {
    val coroutineId = coroutineContext[TrackerContext]?.currentCoroutineId
    val fromDispatcher = coroutineContext[ContinuationInterceptor]?.toString()
    val fromThread = Thread.currentThread().id
    
    val eventBus = coroutineContext[TrackerContext]?.eventBus
    val executionId = coroutineContext[TrackerContext]?.executionId
    
    if (coroutineId != null && eventBus != null && executionId != null) {
        eventBus.emit(ContextSwitched(
            eventId = generateId(),
            timestamp = System.currentTimeMillis(),
            executionId = executionId,
            coroutineId = coroutineId,
            fromDispatcher = fromDispatcher ?: "unknown",
            toDispatcher = dispatcher.toString(),
            fromThread = fromThread,
            toThread = null // Will be known after switch
        ))
    }
    
    return withContext(TrackedDispatcher(dispatcher, eventBus!!, executionId!!)) {
        block()
    }
}
```

### 4.4 Tracked Flow

```kotlin
class TrackedFlow<T>(
    private val underlying: Flow<T>,
    private val eventBus: EventBus,
    private val executionId: String,
    private val flowId: String = generateId()
) : Flow<T> {

    init {
        eventBus.emit(FlowCreated(
            eventId = generateId(),
            timestamp = System.currentTimeMillis(),
            executionId = executionId,
            flowId = flowId,
            sourceCoroutineId = null // Could capture from context
        ))
    }

    override suspend fun collect(collector: FlowCollector<T>) {
        val collectorCoroutineId = coroutineContext[TrackerContext]?.currentCoroutineId
        
        eventBus.emit(FlowCollected(
            eventId = generateId(),
            timestamp = System.currentTimeMillis(),
            executionId = executionId,
            flowId = flowId,
            collectorCoroutineId = collectorCoroutineId ?: "unknown"
        ))
        
        underlying.collect { value ->
            eventBus.emit(ValueEmitted(
                eventId = generateId(),
                timestamp = System.currentTimeMillis(),
                executionId = executionId,
                flowId = flowId,
                value = value.toString(),
                emitterCoroutineId = collectorCoroutineId
            ))
            
            collector.emit(value)
        }
    }
}

// Builder function
fun <T> trackedFlow(
    eventBus: EventBus,
    executionId: String,
    block: suspend FlowCollector<T>.() -> Unit
): Flow<T> {
    return TrackedFlow(flow(block), eventBus, executionId)
}
```

### 4.5 Tracked Channel

```kotlin
class TrackedChannel<T>(
    private val capacity: Int,
    private val eventBus: EventBus,
    private val executionId: String,
    private val channelId: String = generateId()
) : Channel<T> {

    private val underlying = Channel<T>(capacity)
    
    init {
        eventBus.emit(ChannelCreated(
            eventId = generateId(),
            timestamp = System.currentTimeMillis(),
            executionId = executionId,
            channelId = channelId,
            capacity = capacity,
            creatorCoroutineId = null
        ))
    }

    override suspend fun send(element: T) {
        val senderCoroutineId = coroutineContext[TrackerContext]?.currentCoroutineId
        val willSuspend = underlying.trySend(element).isFailure
        
        eventBus.emit(ChannelSend(
            eventId = generateId(),
            timestamp = System.currentTimeMillis(),
            executionId = executionId,
            channelId = channelId,
            senderCoroutineId = senderCoroutineId ?: "unknown",
            value = element.toString(),
            suspended = willSuspend
        ))
        
        if (willSuspend) {
            underlying.send(element)
        }
    }

    override suspend fun receive(): T {
        val receiverCoroutineId = coroutineContext[TrackerContext]?.currentCoroutineId
        val result = underlying.tryReceive()
        val willSuspend = result.isFailure
        
        val value = if (willSuspend) {
            underlying.receive()
        } else {
            result.getOrThrow()
        }
        
        eventBus.emit(ChannelReceive(
            eventId = generateId(),
            timestamp = System.currentTimeMillis(),
            executionId = executionId,
            channelId = channelId,
            receiverCoroutineId = receiverCoroutineId ?: "unknown",
            value = value.toString(),
            suspended = willSuspend
        ))
        
        return value
    }

    // Delegate other Channel methods to underlying
    override val isClosedForReceive: Boolean get() = underlying.isClosedForReceive
    override val isClosedForSend: Boolean get() = underlying.isClosedForSend
    override val isEmpty: Boolean get() = underlying.isEmpty
    override fun close(cause: Throwable?): Boolean = underlying.close(cause)
    override fun cancel(cause: CancellationException?) = underlying.cancel(cause)
    // ... other delegations
}
```

### 4.6 User Code Example

```kotlin
// In a Ktor route
fun Application.visualizationRoutes() {
    val visualizer = VisualizationFramework.instance
    
    routing {
        post("/run-scenario/race-condition") {
            val execution = visualizer.startExecution("race-condition-demo")
            
            visualizer.trackedScope(name = "race-scenario") {
                var counter = 0
                
                val job1 = trackedLaunch(name = "incrementer-1") {
                    repeat(1000) {
                        counter++
                        yield() // Suspension point
                    }
                }
                
                val job2 = trackedLaunch(name = "incrementer-2") {
                    repeat(1000) {
                        counter++
                        yield()
                    }
                }
                
                job1.join()
                job2.join()
                
                println("Final counter: $counter") // Not 2000 due to race
            }
            
            val snapshot = visualizer.endExecution(execution)
            call.respond(snapshot)
        }
    }
}
```

---

## 5. Concurrency Scenarios & Teaching Cases

### 5.1 Scenario 1: Race Condition

#### Code Example

```kotlin
fun raceConditionScenario(visualizer: Visualizer) {
    visualizer.trackedScope(name = "race-condition") {
        val sharedList = mutableListOf<Int>()
        
        val writers = List(10) { index ->
            trackedLaunch(name = "writer-$index") {
                repeat(100) {
                    sharedList.add(index) // Unsafe concurrent access
                    yield()
                }
            }
        }
        
        writers.forEach { it.join() }
        
        println("Expected: 1000, Actual: ${sharedList.size}")
    }
}
```

#### Emitted Events (Key Sequence)

1. **ScopeCreated**: race-condition scope
2. **CoroutineCreated** × 10: writer-0 through writer-9
3. **ThreadAssigned** × 10: All writers assigned to thread pool
4. **CoroutineSuspended** (interleaved): Writers suspending at `yield()`
5. **CoroutineResumed** (interleaved): Writers resuming on potentially different threads
6. **DataRaceDetected** (custom event): Multiple coroutines accessing sharedList without synchronization
7. **CoroutineCompleted** × 10: All writers complete

#### Visualization Approach

**Timeline View**:
- Horizontal swimlanes for each thread
- Color-coded blocks showing which coroutine is active
- Red markers where concurrent access occurs
- Overlapping access periods highlighted

**Graph View**:
- Nodes for each coroutine
- Edges to shared resource (sharedList)
- Conflict markers where accesses overlap in time

**Key Insight**: Show how coroutines can be preempted at suspension points, leading to interleaved execution and race conditions.

---

### 5.2 Scenario 2: Blocking & Starvation

#### Code Example

```kotlin
fun blockingStarvationScenario(visualizer: Visualizer) {
    visualizer.trackedScope(name = "blocking-starvation") {
        // Only 4 threads in IO dispatcher pool
        val dispatcher = Dispatchers.IO
        
        // Launch 10 coroutines that all block
        val blockers = List(10) { index ->
            trackedLaunch(dispatcher, name = "blocker-$index") {
                // BAD: Blocking call in coroutine
                Thread.sleep(5000) // Blocks thread, not just suspends
            }
        }
        
        delay(100) // Let blockers start
        
        // This coroutine will starve - no threads available
        val starved = trackedLaunch(dispatcher, name = "starved-coroutine") {
            println("Finally got a thread!")
        }
        
        blockers.forEach { it.join() }
        starved.join()
    }
}
```

#### Emitted Events

1. **CoroutineCreated** × 10: blockers
2. **ThreadAssigned** × 4: First 4 blockers get threads
3. **DispatcherQueuedEvent** × 6: Remaining 6 blockers queued
4. **ThreadBlockedEvent** (custom) × 4: Threads occupied by blocking calls
5. **CoroutineCreated**: starved-coroutine
6. **DispatcherQueuedEvent**: starved-coroutine queued
7. **LongQueueWaitWarning** (custom): starved-coroutine waiting > 1s
8. **ThreadReleased** × 4: After 5 seconds, threads freed
9. **CoroutineResumed** (gradually): Queued coroutines get threads

#### Visualization Approach

**Dispatcher Pool View**:
- Fixed-size grid showing thread pool (4 boxes)
- Queue visualization below showing waiting coroutines
- Color coding:
  - Green: Suspended coroutine (good)
  - Red: Blocked thread (bad)
  - Yellow: Queued coroutine

**Timeline View**:
- Show long gaps where starved coroutine waits
- Highlight blocked threads vs suspended coroutines

**Key Insight**: Demonstrate difference between suspending (yields thread) vs blocking (holds thread). Show impact on dispatcher throughput.

---

### 5.3 Scenario 3: Cancellation & Exception Propagation

#### Code Example

```kotlin
fun cancellationPropagationScenario(visualizer: Visualizer) {
    visualizer.trackedScope(name = "cancellation-propagation") {
        val parentJob = trackedLaunch(name = "parent") {
            
            val child1 = trackedLaunch(name = "child-1") {
                try {
                    delay(10000) // Long delay
                } catch (e: CancellationException) {
                    println("Child 1 cancelled")
                    throw e // Must propagate
                }
            }
            
            val child2 = trackedLaunch(name = "child-2") {
                delay(100)
                throw IllegalStateException("Child 2 failed!")
            }
            
            val child3 = trackedLaunch(name = "child-3") {
                delay(10000)
            }
            
            // Wait for all (will fail due to child2)
            joinAll(child1, child2, child3)
        }
        
        try {
            parentJob.join()
        } catch (e: Exception) {
            println("Parent job failed: ${e.message}")
        }
    }
}
```

#### Emitted Events

1. **CoroutineCreated**: parent
2. **CoroutineCreated**: child-1, child-2, child-3 (parentId = parent)
3. **CoroutineSuspended** × 3: All children at delay
4. **CoroutineResumed**: child-2 (after 100ms)
5. **ExceptionThrown**: child-2, IllegalStateException
6. **ExceptionPropagated**: child-2 → parent
7. **CoroutineCancelled**: parent (cause: child exception)
8. **CoroutineCancelled**: child-1 (propagatedFrom: parent)
9. **CoroutineCancelled**: child-3 (propagatedFrom: parent)
10. **ExceptionHandled**: parent exception caught in try-catch

#### Visualization Approach

**Tree View**:
- Parent-child hierarchy
- Animated propagation: exception flows up, cancellation flows down
- Color coding:
  - Normal: Blue
  - Exception: Red
  - Cancelled: Gray
- Arrows showing causality

**Sequence Diagram**:
- Timeline showing order of events
- Vertical lines for each coroutine
- Horizontal arrows for propagation

**Comparison View** (Side-by-side):
- Regular scope vs supervisorScope behavior
- Show how supervisorScope isolates failures

**Key Insight**: Visualize structured concurrency rules - exceptions propagate up, cancellation cascades down. Show difference between regular and supervisor scopes.

---

### 5.4 Scenario Comparison Matrix

| Scenario | Primary Concept | Key Events | Visualization Type | Teaching Goal |
|----------|----------------|------------|-------------------|---------------|
| Race Condition | Shared mutable state | DataAccess, yield points | Timeline, Conflict Graph | Thread safety need |
| Blocking/Starvation | Dispatcher management | ThreadBlocked, QueuedCoroutine | Pool visualization | Blocking vs suspending |
| Cancellation | Structured concurrency | ExceptionPropagated, CoroutineCancelled | Tree, Sequence | Lifecycle management |

---

## 6. Frontend Integration (React + TypeScript)

### 6.1 API Design

#### REST Endpoints

```typescript
// TypeScript API client types

interface ExecutionListResponse {
  executions: ExecutionSummary[]
}

interface ExecutionSummary {
  id: string
  name: string
  startTime: number
  endTime?: number
  coroutineCount: number
  eventCount: number
  status: 'running' | 'completed' | 'failed'
}

interface ExecutionSnapshot {
  executionId: string
  startTime: number
  endTime?: number
  scopes: ScopeInfo[]
  coroutines: CoroutineInfo[]
  dispatchers: DispatcherInfo[]
  threads: ThreadInfo[]
  relationships: Relationship[]
}

interface CoroutineEvent {
  eventId: string
  timestamp: number
  executionId: string
  type: string
  // ... specific event fields
}
```

#### API Routes

```
GET    /api/executions
       Returns: ExecutionListResponse
       Description: List all execution sessions

GET    /api/executions/{executionId}
       Returns: ExecutionSnapshot
       Description: Get full snapshot of execution state

GET    /api/executions/{executionId}/events
       Returns: CoroutineEvent[]
       Query params: ?from={timestamp}&to={timestamp}&type={eventType}
       Description: Query historical events

POST   /api/executions
       Body: { name: string }
       Returns: { executionId: string }
       Description: Start new tracked execution

DELETE /api/executions/{executionId}
       Returns: { success: boolean }
       Description: Clean up execution data

// Server-Sent Events
GET    /api/executions/{executionId}/stream
       Returns: SSE stream of CoroutineEvent
       Description: Real-time event stream

// WebSocket
WS     /ws/events
       Protocol: Send JSON commands, receive events
       Commands: 
         - { type: 'subscribe', executionId: string }
         - { type: 'unsubscribe', executionId: string }
         - { type: 'pause' }
         - { type: 'resume' }
```

### 6.2 Data Structuring for Animation

#### Event Grouping Strategy

```typescript
// Group events by entity for efficient lookups
interface GroupedEvents {
  byCoroutine: Map<string, CoroutineEvent[]>
  byThread: Map<number, CoroutineEvent[]>
  byTimestamp: CoroutineEvent[] // Sorted chronologically
  byType: Map<string, CoroutineEvent[]>
}

// Animation state
interface AnimationState {
  currentTime: number
  speed: number // 1.0 = real-time, 2.0 = 2x speed
  playing: boolean
  events: CoroutineEvent[]
  processedEvents: Set<string> // Event IDs already processed
}

// Derived state at specific time point
interface TimeSliceState {
  activeCoroutines: Map<string, CoroutineRuntimeState>
  threadAssignments: Map<number, string | null> // threadId -> coroutineId
  pendingChannelOps: ChannelOperation[]
  activeFlows: FlowState[]
}
```

#### Recommended Data Flow

1. **Initial Load**: Fetch full snapshot via REST
2. **Live Updates**: Subscribe to SSE/WebSocket for real-time events
3. **Buffering**: Accumulate events in time-sorted buffer
4. **Animation**: 
   - Maintain `currentTime` cursor
   - Process events where `event.timestamp <= currentTime`
   - Update visualization state incrementally
   - Support scrubbing (jump to arbitrary time)

### 6.3 WebSocket vs SSE Recommendation

**Server-Sent Events (SSE)** - Recommended for v1:
- ✅ Simpler to implement (HTTP-based)
- ✅ Automatic reconnection
- ✅ Event ID tracking for resume
- ✅ One-way is sufficient (backend → frontend)
- ✅ Better browser compatibility
- ❌ No bidirectional communication

**WebSocket** - Consider for v2+:
- ✅ Bidirectional (can send commands to backend)
- ✅ Lower latency
- ✅ Can pause/resume specific executions from frontend
- ❌ More complex connection management
- ❌ Requires additional protocol design

#### Recommended Approach

**Phase 1**: Use SSE for event streaming
```kotlin
// Ktor SSE route
routing {
    get("/api/executions/{id}/stream") {
        val executionId = call.parameters["id"]!!
        
        call.response.cacheControl(CacheControl.NoCache(null))
        call.respondSse {
            val eventFlow = eventCollector.subscribe(executionId)
            
            eventFlow.collect { event ->
                send(ServerSentEvent(
                    data = Json.encodeToString(event),
                    event = event::class.simpleName,
                    id = event.eventId
                ))
            }
        }
    }
}
```

**Phase 2**: Add WebSocket for interactive control
```kotlin
routing {
    webSocket("/ws/events") {
        for (frame in incoming) {
            when (val command = Json.decodeFromString<Command>(frame.data)) {
                is Subscribe -> { /* subscribe to execution */ }
                is Pause -> { /* pause event emission */ }
                is Step -> { /* emit next event only */ }
            }
        }
    }
}
```

### 6.4 Frontend Component Suggestions (High-Level)

```typescript
// Component hierarchy (no implementation, just structure)

<ExecutionDashboard>
  <ExecutionList>           // List of available executions
  <ExecutionDetails>        // Selected execution
    <ControlPanel>          // Play/pause/speed/scrub
    <VisualizationTabs>
      <TimelineView>        // Thread swimlanes
      <HierarchyView>       // Scope/coroutine tree
      <GraphView>           // Relationship graph
      <EventLog>            // Detailed event list
      <StatisticsPanel>     // Metrics/counts
    </VisualizationTabs>
  </ExecutionDetails>
</ExecutionDashboard>
```

**Key React Patterns**:
- Use `useReducer` for complex animation state
- `useEffect` for SSE connection lifecycle
- `useMemo` for expensive event grouping operations
- Virtual scrolling for large event lists
- Canvas/WebGL for high-performance animations (D3.js, PixiJS, or Three.js)

---

## 7. Architectural Approaches & Comparison

### 7.1 Approach A: Decoration Pattern (Recommended for v1)

**Description**: Wrap coroutine builders and emit events inline with execution.

**Pros**:
- ✅ Direct, real-time event emission
- ✅ Minimal latency between action and event
- ✅ Simpler to understand and debug
- ✅ Easier to implement initially
- ✅ Works well with Kotlin's delegation

**Cons**:
- ❌ Invasive - requires using wrapped APIs
- ❌ May miss events from unwrapped code
- ❌ Performance overhead on every coroutine operation
- ❌ Harder to disable in production

**Implementation Summary**:
```kotlin
// User must use wrapped versions
val job = trackedLaunch { ... }  // instead of launch { ... }
```

**Best For**: Teaching environments, demos, controlled experiments where all code uses wrappers.

---

### 7.2 Approach B: Bytecode Instrumentation (Advanced)

**Description**: Use bytecode transformation (Kotlin compiler plugin or JVM agent) to auto-inject tracking without changing user code.

**Pros**:
- ✅ Transparent - user code unchanged
- ✅ Captures all coroutines automatically
- ✅ Can be enabled/disabled via build config
- ✅ Production-ready approach

**Cons**:
- ❌ Complex implementation (requires compiler plugin knowledge)
- ❌ Debugging is harder
- ❌ Build time overhead
- ❌ Versioning challenges with Kotlin updates
- ❌ Overkill for initial prototype

**Implementation Summary**:
```kotlin
// User code unchanged
val job = launch { ... }  // Automatically tracked

// In gradle:
plugins {
    id("coroutine-visualizer-plugin")
}
```

**Best For**: Production debugging tools, IDE integrations, commercial products.

---

### 7.3 Approach C: Debugging API Interception (Hybrid)

**Description**: Leverage Kotlin's debugging infrastructure (DebugProbes) which already exists for coroutine debugging.

**Pros**:
- ✅ Reuses existing infrastructure
- ✅ Less invasive than full bytecode instrumentation
- ✅ Official Kotlin support
- ✅ Can capture unwrapped coroutines

**Cons**:
- ❌ Designed for debugging, not production visualization
- ❌ API surface may change
- ❌ Performance overhead when enabled
- ❌ Limited control over granularity

**Implementation Summary**:
```kotlin
import kotlinx.coroutines.debug.*

DebugProbes.install()
DebugProbes.dumpCoroutines() // Get snapshot

// But limited events, must poll or hook into internal APIs
```

**Best For**: Hybrid approach - use DebugProbes for discovery, wrappers for detailed tracking.

---

### 7.4 Recommendation Matrix

| Criterion | Approach A (Decoration) | Approach B (Bytecode) | Approach C (Debug API) |
|-----------|------------------------|----------------------|----------------------|
| **Complexity** | Low | High | Medium |
| **Time to MVP** | 2-3 weeks | 8-12 weeks | 4-6 weeks |
| **Event Granularity** | High | High | Medium |
| **Performance Impact** | Medium | Low-Medium | Medium-High |
| **Production Ready** | No | Yes | Depends |
| **Learning Curve** | Low | High | Medium |
| **Maintainability** | High | Medium | Medium |

### 7.5 Recommended Approach for First Version

**Approach A (Decoration Pattern)** with selective use of Approach C for enrichment.

**Rationale**:
1. **Fastest time to value**: Can build working prototype in weeks, not months
2. **Clear debugging**: When something breaks, it's obvious where
3. **Pedagogical fit**: Explicit wrappers reinforce "this is instrumented" mindset for learning
4. **Incremental complexity**: Can add Approach C later for automatic discovery without rewriting
5. **Flexibility**: Easy to add custom events specific to teaching scenarios

**Migration Path**:
- **v1.0**: Pure decoration, manual wrapping
- **v1.5**: Add DebugProbes integration to auto-discover unwrapped coroutines (show warning)
- **v2.0**: Investigate compiler plugin for automatic wrapping (if product scales)

---

## 8. Implementation Roadmap

### Phase 1: Core Infrastructure (Weeks 1-2)
- [ ] Event model definitions (sealed classes)
- [ ] EventBus implementation
- [ ] EventCollector with in-memory storage
- [ ] Basic Ktor setup with health check

### Phase 2: Wrapper Layer (Weeks 3-4)
- [ ] TrackedCoroutineScope
- [ ] trackedLaunch / trackedAsync
- [ ] TrackedDispatcher
- [ ] Basic suspension point tracking

### Phase 3: API & Serialization (Week 5)
- [ ] REST endpoints for executions
- [ ] JSON serialization (kotlinx.serialization)
- [ ] SSE streaming endpoint
- [ ] CORS and error handling

### Phase 4: Advanced Wrappers (Weeks 6-7)
- [ ] TrackedFlow
- [ ] TrackedChannel
- [ ] Exception tracking
- [ ] Cancellation propagation

### Phase 5: Teaching Scenarios (Week 8)
- [ ] Implement 3 example scenarios
- [ ] Scenario execution endpoints
- [ ] Validation and testing

### Phase 6: Frontend Integration (Weeks 9-10)
- [ ] TypeScript API client
- [ ] Basic dashboard with execution list
- [ ] Timeline visualization (minimal)
- [ ] SSE connection and event streaming

### Phase 7: Polish & Documentation (Weeks 11-12)
- [ ] Error handling and edge cases
- [ ] Performance optimization
- [ ] API documentation (OpenAPI spec)
- [ ] User guide and examples

---

## 9. Technical Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Coroutine Context Loss** | High | Medium | Use CoroutineContext.Element for tracker context propagation |
| **Event Flood Performance** | Medium | High | Implement event sampling, batching, and buffering |
| **Memory Leaks (Long Runs)** | High | Medium | Time-based eviction policy, max event count limits |
| **Suspension Point Missing** | Medium | Medium | Combine with DebugProbes as fallback |
| **Serialization Failures** | Medium | Low | Defensive toString() fallbacks, type filters |
| **Thread Safety Issues** | High | Low | Use concurrent collections, atomic operations |
| **Kotlin Version Changes** | Medium | Low | Pin coroutines version, document compatibility |

---

## 10. Success Metrics

### Technical Metrics
- **Event Latency**: < 1ms from action to emission
- **Throughput**: Support 10,000+ events/second
- **Memory Footprint**: < 100MB for 50K events
- **API Response Time**: < 100ms for snapshot queries
- **SSE Latency**: < 50ms from event to frontend

### User Metrics (Teaching Context)
- **Comprehension**: 80% of users can identify race conditions from visualization
- **Engagement**: Average session > 15 minutes
- **Coverage**: Visualize 15+ distinct concurrency patterns
- **Adoption**: 90% of scenarios use wrappers correctly

---

## 11. Conclusion

This architecture provides a **solid foundation for a coroutine visualization framework** that:

1. **Wraps real coroutine semantics** without faking behavior
2. **Emits rich, structured events** suitable for multiple visualization types
3. **Integrates cleanly with Ktor** for HTTP/SSE delivery
4. **Scales from simple demos to complex scenarios** through modular design
5. **Provides clear path to React + TypeScript frontend** with well-defined data contracts

The **decoration pattern approach** is recommended for v1 because it balances implementation speed, debuggability, and pedagogical clarity. The event model is designed to be **frontend-agnostic**, allowing multiple visualization strategies (timeline, tree, graph, sequence diagrams) from the same data stream.

**Next Steps**:
1. Validate event model with sample scenarios
2. Prototype EventBus + basic wrapper
3. Build minimal Ktor endpoint + SSE stream
4. Iterate based on visualization needs

This framework positions the project for success as both a **teaching tool** and a potential **production debugging aid** as it matures.

