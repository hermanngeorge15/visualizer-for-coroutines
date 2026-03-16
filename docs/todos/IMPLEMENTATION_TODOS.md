# Implementation TODO Tracker

**Last Updated:** November 24, 2025  
**Status:** Phase 1A - Core Instrumentation  

---

## 🔴 CRITICAL - Week 1-2 (Do First)

### Dispatcher Instrumentation

- [ ] **DISP-1:** Create `InstrumentedDispatcher` class
  - **File:** `backend/src/main/kotlin/com/jh/proj/coroutineviz/wrappers/InstrumentedDispatcher.kt`
  - **Effort:** 6-8 hours
  - **Dependencies:** None
  - **Subtasks:**
    - [ ] Extend `CoroutineDispatcher` abstract class
    - [ ] Wrap `dispatch()` method to emit `DispatcherSelected` event
    - [ ] Wrap Runnable to emit `ThreadAssigned` on execution
    - [ ] Handle `isDispatchNeeded()` delegation
    - [ ] Add dispatcher name field (Default, IO, Main, etc.)
  
- [ ] **DISP-2:** Create `DispatcherSelected` event
  - **File:** `backend/src/main/kotlin/com/jh/proj/coroutineviz/events/DispatcherSelected.kt`
  - **Effort:** 1 hour
  - **Fields needed:**
    - sessionId, seq, tsNanos, kind
    - coroutineId, dispatcherId
    - dispatcherName, queueDepth (optional)

- [ ] **DISP-3:** Update VizScope to use instrumented dispatchers
  - **File:** `backend/src/main/kotlin/com/jh/proj/coroutineviz/wrappers/VizScope.kt`
  - **Effort:** 2-3 hours
  - **Changes:**
    - [ ] Add dispatcher parameter to `vizLaunch()`
    - [ ] Create instrumented versions: `vizDispatchers.default`, `vizDispatchers.io`
    - [ ] Emit DispatcherSelected on coroutine start
    - [ ] Track dispatcher switches in withContext

- [ ] **DISP-4:** Update VizJob to track dispatcher
  - **File:** `backend/src/main/kotlin/com/jh/proj/coroutineviz/wrappers/VizJob.kt`
  - **Effort:** 1-2 hours
  - **Changes:**
    - [ ] Store current dispatcher ID
    - [ ] Emit event on dispatcher switch
    - [ ] Update ThreadAssigned to include dispatcher info

- [ ] **DISP-5:** Test dispatcher instrumentation
  - **File:** Create test scenario or update existing
  - **Effort:** 2 hours
  - **Tests:**
    - [ ] Verify DispatcherSelected events appear
    - [ ] Verify thread assignment is correct
    - [ ] Test Default, IO dispatcher switches
    - [ ] Test withContext() dispatcher change

---

### Projection Service

- [ ] **PROJ-1:** Create ProjectionService class
  - **File:** `backend/src/main/kotlin/com/jh/proj/coroutineviz/session/ProjectionService.kt`
  - **Effort:** 4-6 hours
  - **Dependencies:** None
  - **Subtasks:**
    - [ ] Subscribe to EventBus in constructor
    - [ ] Maintain `coroutines: MutableMap<String, HierarchyNode>`
    - [ ] Maintain `threads: MutableMap<String, MutableList<ThreadEvent>>`
    - [ ] Process CoroutineCreated events → build hierarchy
    - [ ] Process ThreadAssigned events → track thread activity
    - [ ] Process state change events → update node states

- [ ] **PROJ-2:** Create HierarchyNode data class
  - **File:** `backend/src/main/kotlin/com/jh/proj/coroutineviz/session/HierarchyNode.kt`
  - **Effort:** 1 hour
  - **Fields:**
    - id, parentId, children (List<String>)
    - name, scopeId, state
    - createdAt, completedAt timestamps
    - dispatcherId, currentThreadId

- [ ] **PROJ-3:** Create ThreadEvent data class
  - **File:** `backend/src/main/kotlin/com/jh/proj/coroutineviz/session/ThreadEvent.kt`
  - **Effort:** 30 minutes
  - **Fields:**
    - coroutineId, threadId, threadName
    - timestamp, eventType (ASSIGNED, RELEASED)

- [ ] **PROJ-4:** Build hierarchy tree method
  - **Method:** `ProjectionService.getHierarchyTree(scopeId: String?)`
  - **Effort:** 2-3 hours
  - **Algorithm:**
    - [ ] Filter nodes by scopeId (if provided)
    - [ ] Find root nodes (parentId == null)
    - [ ] Recursively build tree structure
    - [ ] Include current state for each node
    - [ ] Handle orphaned nodes gracefully

- [ ] **PROJ-5:** Build thread activity method
  - **Method:** `ProjectionService.getThreadActivity()`
  - **Effort:** 1-2 hours
  - **Output:**
    - [ ] Map of thread ID → timeline events
    - [ ] Include coroutine assignments
    - [ ] Include dispatcher information
    - [ ] Sort by timestamp

- [ ] **PROJ-6:** Integrate ProjectionService with VizSession
  - **File:** `backend/src/main/kotlin/com/jh/proj/coroutineviz/session/VizSession.kt`
  - **Effort:** 1 hour
  - **Changes:**
    - [ ] Add `projectionService` property to VizSession
    - [ ] Initialize in constructor with EventBus
    - [ ] Expose via session API

- [ ] **PROJ-7:** Test ProjectionService
  - **Effort:** 2 hours
  - **Tests:**
    - [ ] Run nested scenario
    - [ ] Verify hierarchy is correct (parent-child links)
    - [ ] Verify thread activity is tracked
    - [ ] Test with multiple scenarios in same session

---

### API Endpoints for Projections

- [ ] **API-1:** Add hierarchy endpoint
  - **Endpoint:** `GET /api/sessions/{id}/hierarchy`
  - **File:** `backend/src/main/kotlin/com/jh/proj/coroutineviz/Routing.kt`
  - **Effort:** 1-2 hours
  - **Response:**
    - [ ] Return tree structure (not flat list)
    - [ ] Include node metadata (state, name, timestamps)
    - [ ] Filter by scopeId query parameter (optional)

- [ ] **API-2:** Add thread activity endpoint
  - **Endpoint:** `GET /api/sessions/{id}/threads`
  - **File:** `backend/src/main/kotlin/com/jh/proj/coroutineviz/Routing.kt`
  - **Effort:** 1 hour
  - **Response:**
    - [ ] Return per-thread timeline
    - [ ] Include coroutine assignments
    - [ ] Include dispatcher information

- [ ] **API-3:** Test endpoints with frontend team
  - **Effort:** 2 hours
  - **Tasks:**
    - [ ] Document response format
    - [ ] Provide example responses
    - [ ] Test with real scenarios
    - [ ] Handle edge cases (empty sessions, no threads, etc.)

---

### Suspension Point Tracking

- [ ] **SUSP-1:** Create SuspensionPoint data class
  - **File:** `backend/src/main/kotlin/com/jh/proj/coroutineviz/events/SuspensionPoint.kt`
  - **Effort:** 30 minutes
  - **Fields:**
    - function (String)
    - fileName (String?)
    - lineNumber (Int?)
    - reason (String) // "delay", "withContext", "join", etc.

- [ ] **SUSP-2:** Update CoroutineSuspended event
  - **File:** `backend/src/main/kotlin/com/jh/proj/coroutineviz/events/CoroutineSuspended.kt`
  - **Effort:** 30 minutes
  - **Changes:**
    - [ ] Add `suspensionPoint: SuspensionPoint?` field
    - [ ] Update serialization

- [ ] **SUSP-3:** Capture suspension points in VizScope
  - **File:** `backend/src/main/kotlin/com/jh/proj/coroutineviz/wrappers/VizScope.kt`
  - **Effort:** 2-3 hours
  - **Changes:**
    - [ ] Add stack trace capture helper
    - [ ] Update vizDelay() to capture suspension point
    - [ ] Capture on vizLaunch() suspend
    - [ ] Parse stack trace for relevant frame
    - [ ] Add reason parameter based on context

- [ ] **SUSP-4:** Test suspension tracking
  - **Effort:** 1 hour
  - **Tests:**
    - [ ] Verify suspension points are captured
    - [ ] Check line numbers are correct
    - [ ] Test different suspension types (delay, withContext, join)

---

## 🟡 HIGH PRIORITY - Week 3-4

### Event Filtering & Pagination

- [ ] **FILTER-1:** Create EventFilter class
  - **File:** `backend/src/main/kotlin/com/jh/proj/coroutineviz/session/EventFilter.kt`
  - **Effort:** 3-4 hours
  - **Features:**
    - [ ] Parse filter DSL (e.g., "coroutineId:A AND kind:Suspended")
    - [ ] Support operators: AND, OR, NOT
    - [ ] Support fields: coroutineId, kind, scopeId, timestamp range
    - [ ] Compile to predicate function

- [ ] **FILTER-2:** Apply filtering to event queries
  - **File:** `backend/src/main/kotlin/com/jh/proj/coroutineviz/Routing.kt`
  - **Effort:** 2 hours
  - **Changes:**
    - [ ] Update `/api/sessions/{id}/events?filter=...` endpoint
    - [ ] Parse filter from query parameter
    - [ ] Apply filter before returning results

- [ ] **FILTER-3:** Apply filtering to SSE stream
  - **File:** `backend/src/main/kotlin/com/jh/proj/coroutineviz/Routing.kt`
  - **Effort:** 1 hour
  - **Changes:**
    - [ ] Parse filter from SSE connection parameters
    - [ ] Filter events before sending to client
    - [ ] Test with various filter expressions

- [ ] **PAGE-1:** Implement cursor-based pagination
  - **Effort:** 2-3 hours
  - **Changes:**
    - [ ] Use stepIndex as cursor
    - [ ] Support `?sinceStep=X&limit=100` parameters
    - [ ] Return `nextStep` token in response
    - [ ] Handle edge cases (no more events, invalid step)

- [ ] **PAGE-2:** Test pagination with large scenarios
  - **Effort:** 1 hour
  - **Tests:**
    - [ ] Create scenario with 1000+ events
    - [ ] Page through all events
    - [ ] Verify no events lost
    - [ ] Test limit values (10, 100, 1000)

---

### Timeline Query Enhancement

- [ ] **TIMELINE-1:** Enhanced timeline endpoint
  - **Endpoint:** `GET /api/coroutines/{id}/timeline`
  - **Effort:** 2-3 hours
  - **Features:**
    - [ ] Return events for specific coroutine
    - [ ] Include computed durations (suspend → resume)
    - [ ] Include parent/child relationship links
    - [ ] Include dispatcher switches
    - [ ] Sort by timestamp

- [ ] **TIMELINE-2:** Timeline response format
  - **Effort:** 1 hour
  - **Response structure:**
    - [ ] coroutineId, name, state
    - [ ] events: List<TimelineEvent>
    - [ ] totalDuration, suspendedTime, activeTime
    - [ ] parentId, childrenIds

---

## 🟢 MEDIUM PRIORITY - Week 5-8

### Flow Instrumentation

- [ ] **FLOW-1:** Create InstrumentedFlow wrapper
  - **File:** `backend/src/main/kotlin/com/jh/proj/coroutineviz/wrappers/InstrumentedFlow.kt`
  - **Effort:** 4-6 hours
  - **Features:**
    - [ ] Wrap Flow<T> interface
    - [ ] Override collect() method
    - [ ] Wrap FlowCollector to intercept emissions
    - [ ] Emit FlowCollectionStarted on collect()
    - [ ] Emit FlowValueEmitted for each value
    - [ ] Emit FlowCollectionCompleted on finish
    - [ ] Handle cancellation and exceptions

- [ ] **FLOW-2:** Create Flow events
  - **Files:** Create in `events/` package
  - **Effort:** 2 hours
  - **Events:**
    - [ ] FlowCollectionStarted (flowId, collectorId, coroutineId)
    - [ ] FlowValueEmitted (flowId, collectorId, sequence, valuePreview)
    - [ ] FlowCollectionCompleted (flowId, collectorId)
    - [ ] FlowCollectionFailed (flowId, collectorId, error)

- [ ] **FLOW-3:** Add Flow builder to VizScope
  - **File:** Update VizScope
  - **Effort:** 2 hours
  - **Methods:**
    - [ ] `vizFlow()` builder
    - [ ] Generate flow ID
    - [ ] Return InstrumentedFlow
    - [ ] Track flow lifecycle

- [ ] **FLOW-4:** Create Flow backpressure scenario
  - **File:** Add to ScenarioRunner
  - **Effort:** 2-3 hours
  - **Scenario:**
    - [ ] Fast producer, slow collector
    - [ ] Show buffer behavior
    - [ ] Demonstrate backpressure handling

- [ ] **FLOW-5:** Update EventApplier for Flow events
  - **File:** EventApplier.kt
  - **Effort:** 1 hour
  - **Changes:**
    - [ ] Handle Flow events in apply()
    - [ ] Track flow state in snapshot (if needed)

---

### Channel Instrumentation

- [ ] **CHAN-1:** Create InstrumentedChannel wrapper
  - **File:** `backend/src/main/kotlin/com/jh/proj/coroutineviz/wrappers/InstrumentedChannel.kt`
  - **Effort:** 4-6 hours
  - **Features:**
    - [ ] Wrap Channel<E> interface
    - [ ] Override send() method
    - [ ] Override receive() method
    - [ ] Track buffer depth
    - [ ] Emit send/receive events with correlation
    - [ ] Handle rendezvous vs buffered semantics

- [ ] **CHAN-2:** Create Channel events
  - **Files:** Create in `events/` package
  - **Effort:** 2 hours
  - **Events:**
    - [ ] ChannelSendRequested (channelId, senderId, value, bufferSize)
    - [ ] ChannelSendCompleted (channelId, senderId, suspended)
    - [ ] ChannelReceiveRequested (channelId, receiverId, bufferSize)
    - [ ] ChannelReceiveCompleted (channelId, receiverId, value, suspended)

- [ ] **CHAN-3:** Add Channel builder to VizScope
  - **File:** Update VizScope
  - **Effort:** 2 hours
  - **Methods:**
    - [ ] `vizChannel()` builder
    - [ ] Support capacity parameter
    - [ ] Generate channel ID
    - [ ] Return InstrumentedChannel

- [ ] **CHAN-4:** Create producer-consumer scenario
  - **File:** Add to ScenarioRunner
  - **Effort:** 2-3 hours
  - **Scenario:**
    - [ ] Multiple producers, multiple consumers
    - [ ] Show buffer behavior
    - [ ] Demonstrate rendezvous channel

---

### Exception Propagation

- [ ] **EXC-1:** Create ExceptionPropagated event
  - **File:** `backend/src/main/kotlin/com/jh/proj/coroutineviz/events/ExceptionPropagated.kt`
  - **Effort:** 1 hour
  - **Fields:**
    - fromCoroutineId, toCoroutineId
    - exceptionType, message
    - propagationPath (list of IDs)

- [ ] **EXC-2:** Track exception flow in VizScope
  - **File:** Update VizScope
  - **Effort:** 3-4 hours
  - **Features:**
    - [ ] Capture exception at origin
    - [ ] Emit ExceptionThrown (already exists)
    - [ ] Track propagation through parent chain
    - [ ] Emit ExceptionPropagated for each hop
    - [ ] Handle SupervisorJob boundaries

- [ ] **EXC-3:** Update EventApplier for exception chain
  - **File:** EventApplier.kt
  - **Effort:** 1-2 hours
  - **Changes:**
    - [ ] Build exception chain in snapshot
    - [ ] Track which coroutines failed due to propagation

---

## 🔵 LOW PRIORITY - Week 9+ (Optional)

### Performance Optimization

- [ ] **PERF-1:** Implement event batching
  - **Effort:** 3-4 hours
  - **Features:**
    - [ ] Batch events before emitting to EventBus
    - [ ] Configurable batch size and timeout
    - [ ] Reduce overhead for high-throughput scenarios

- [ ] **PERF-2:** Add reservoir sampling
  - **Effort:** 3-4 hours
  - **Features:**
    - [ ] Sample events for very large streams
    - [ ] Maintain statistical properties
    - [ ] Configurable sampling rate

- [ ] **PERF-3:** SSE compression
  - **Effort:** 2-3 hours
  - **Features:**
    - [ ] Gzip compression for SSE payloads
    - [ ] Reduce bandwidth for remote clients

---

### WebSocket Support

- [ ] **WS-1:** Implement WebSocket endpoint
  - **Endpoint:** `/ws/events`
  - **Effort:** 4-6 hours
  - **Features:**
    - [ ] Bi-directional communication
    - [ ] Support same filtering as SSE
    - [ ] Handle connection lifecycle

- [ ] **WS-2:** Add replay protocol
  - **Effort:** 3-4 hours
  - **Features:**
    - [ ] Client can request event replay
    - [ ] Support time-range queries
    - [ ] Pause/resume stream

---

### Monitoring & Metrics

- [ ] **MON-1:** Add Micrometer metrics
  - **Effort:** 2-3 hours
  - **Metrics:**
    - [ ] Events emitted per second
    - [ ] Active sessions count
    - [ ] EventBus buffer size
    - [ ] Memory usage per session

- [ ] **MON-2:** Expose metrics endpoint
  - **Endpoint:** `/metrics` or `/actuator/metrics`
  - **Effort:** 1 hour

---

### Database Persistence

- [ ] **DB-1:** Design event storage schema
  - **Effort:** 2-3 hours
  - **Tables:**
    - [ ] sessions
    - [ ] events
    - [ ] coroutines (projection)

- [ ] **DB-2:** Implement PostgreSQL EventStore
  - **Effort:** 6-8 hours
  - **Features:**
    - [ ] Replace in-memory EventStore
    - [ ] Support pagination
    - [ ] Support filtering with SQL

- [ ] **DB-3:** Session persistence across restarts
  - **Effort:** 3-4 hours

---

### Advanced Integration

- [ ] **DEBUG-1:** DebugProbes integration
  - **Effort:** 6-8 hours
  - **Features:**
    - [ ] Install DebugProbes
    - [ ] Translate CoroutineInfo to events
    - [ ] Hybrid mode (wrappers + probes)

- [ ] **OTEL-1:** OpenTelemetry exporter
  - **Effort:** 6-8 hours
  - **Features:**
    - [ ] Export events as OTEL spans
    - [ ] Context propagation
    - [ ] Integration with tracing backends

---

## Progress Tracking

### Phase 1A: Core Instrumentation (Week 1-2)
- **Goal:** Unblock frontend development
- **Status:** NOT STARTED
- **Completion:** 0/15 tasks

### Phase 1B: API Enhancement (Week 3)
- **Goal:** Performance & query capabilities
- **Status:** NOT STARTED
- **Completion:** 0/7 tasks

### Phase 2: Advanced Primitives (Week 4-8)
- **Goal:** Flow/Channel/Exception tracking
- **Status:** NOT STARTED
- **Completion:** 0/15 tasks

---

## Notes

### Quick Wins (Can finish in < 2 hours)
- DISP-2: Create DispatcherSelected event
- PROJ-2: Create HierarchyNode data class
- PROJ-3: Create ThreadEvent data class
- SUSP-1: Create SuspensionPoint data class
- API-2: Add thread activity endpoint

### High Impact (Should prioritize)
- DISP-1: InstrumentedDispatcher (unblocks timeline)
- PROJ-1: ProjectionService (unblocks hierarchy)
- API-1: Hierarchy endpoint (frontend needs this)

### Can Defer to Phase 2
- All Flow instrumentation (FLOW-*)
- All Channel instrumentation (CHAN-*)
- All LOW PRIORITY items

---

**End of TODO Tracker**

