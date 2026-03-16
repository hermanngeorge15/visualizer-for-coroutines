# Backend Implementation Analysis & Roadmap

**Date:** November 24, 2025  
**Version:** 1.0  
**Status:** Implementation Assessment & Strategic Planning

---

## Executive Summary

### ✅ Overall Assessment: **SOLID FOUNDATION - READY FOR ENHANCEMENT**

Your backend implementation demonstrates a **strong architectural foundation** that aligns well with the business analysis documents. You've successfully implemented the core concepts using a clean, decorator-based approach.

**Key Strengths:**
- ✅ Non-invasive wrapper pattern (VizScope/VizJob) implemented correctly
- ✅ Event sourcing architecture in place (EventBus + EventStore)
- ✅ Session management with proper isolation
- ✅ SSE streaming for real-time events
- ✅ Multiple teaching scenarios already implemented
- ✅ Clean REST API structure

**Critical Gaps (vs Business Requirements):**
- ⚠️ **Dispatcher instrumentation** missing (core requirement for thread visualization)
- ⚠️ **Flow & Channel wrappers** not implemented (major feature gap)
- ⚠️ **Suspension/resumption tracking** incomplete (needed for timeline accuracy)
- ⚠️ **Projection service** missing (frontend needs derived views)
- ⚠️ **Hierarchy tree builder** not implemented (critical for tree visualization)
- ⚠️ Event filtering and querying capabilities limited

---

## 1. Architecture Comparison: Business Requirements vs Current Implementation

### 1.1 Core Components Status

| Component | Business Req | Current Status | Gap Analysis |
|-----------|--------------|----------------|--------------|
| **VisualizerApplication** | Ktor module with DI | ✅ Implemented | Well structured in Application.kt |
| **EventSink/EventBus** | Interface + implementations | ✅ Implemented | Simple but functional, could add filtering |
| **IdRegistry** | ID generation & mapping | ⚠️ Partial | VizSession has `nextSeq()` but no Job-to-ID mapping |
| **InstrumentationContext** | Context element for metadata | ✅ Implemented | VizCoroutineElement exists |
| **TimelineStore** | Event storage with replay | ✅ Implemented | EventStore + RuntimeSnapshot |
| **ProjectionService** | Derived view builder | ❌ Missing | **Critical gap** - frontend needs this |
| **StreamingController** | SSE/WebSocket multiplexing | ✅ Implemented | SSE working, no WebSocket yet |
| **ScenarioRunner** | Teaching scenarios | ✅ Implemented | 6 scenarios available |

### 1.2 Wrapper Implementation Status

| Wrapper | Business Req | Current Status | Gap Analysis |
|---------|--------------|----------------|--------------|
| **InstrumentedScope** | launch/async/withContext | ✅ Implemented | VizScope has vizLaunch, good coverage |
| **InstrumentedDispatcher** | Track thread assignment | ❌ Missing | **High priority** - no dispatcher tracking |
| **InstrumentedFlow** | Flow collection tracking | ❌ Missing | **Medium priority** - needed for advanced scenarios |
| **InstrumentedChannel** | Channel send/receive tracking | ❌ Missing | **Medium priority** - needed for advanced scenarios |
| **Continuation Interceptor** | Suspension point tracking | ⚠️ Partial | Some suspension events exist but incomplete |

### 1.3 Event Model Completeness

| Event Category | Business Req | Current Status | Coverage |
|----------------|--------------|----------------|----------|
| **Lifecycle Events** | Create/Start/Suspend/Resume/Complete | ✅ 90% | Missing: StateChanged event |
| **Dispatcher Events** | DispatcherSelected, ThreadAssigned | ⚠️ 30% | ThreadAssigned exists, but no dispatcher tracking |
| **Flow Events** | Collection/Emission/Completion | ❌ 0% | Not implemented |
| **Channel Events** | Send/Receive with buffer tracking | ❌ 0% | Not implemented |
| **Exception Events** | Thrown/Propagated | ⚠️ 50% | CoroutineFailed exists, no propagation tracking |
| **Job Events** | Join/Cancel tracking | ✅ 100% | JobJoinRequested, JobCancellationRequested implemented |

---

## 2. What You've Done Well

### 2.1 Architectural Decisions ✅

**1. Clean Separation of Concerns**
- Events are separate from session logic
- Wrappers (VizScope/VizJob) are decoupled from event handling
- SessionManager provides global session registry

**2. Event Sourcing Pattern**
- All state changes captured as events
- RuntimeSnapshot rebuilt from events (EventApplier)
- Time-travel debugging possible

**3. Session Isolation**
- Each session has its own EventBus, EventStore, and RuntimeSnapshot
- Multiple scenarios can run in parallel
- Clean API for session lifecycle

**4. Real-Time Streaming**
- SSE implementation for live event streaming
- EventBus uses SharedFlow for fan-out
- Proper error handling in SSE endpoints

### 2.2 Code Quality ✅

**Strengths:**
- Consistent logging throughout
- Proper use of Kotlin coroutines (suspend functions, coroutineScope)
- Serialization with kotlinx.serialization
- Clear naming conventions
- Good separation between API layer and domain logic

### 2.3 Scenario Coverage ✅

You've implemented **6 teaching scenarios** covering:
1. ✅ Nested coroutines (structured concurrency)
2. ✅ Parallel execution
3. ✅ Cancellation propagation
4. ✅ Deep nesting (configurable depth)
5. ✅ Mixed sequential/parallel
6. ✅ Exception handling

This matches the business requirement for **5+ teaching scenarios** in Phase 1.

---

## 3. Critical Gaps & Business Impact

### 3.1 HIGH PRIORITY - Blocking Frontend Development

#### Gap 1: Dispatcher & Thread Tracking ⚠️

**Business Impact:** HIGH  
**Why It Matters:**
- Timeline visualization requires knowing which thread executes each coroutine
- Thread lanes visualization is a **core feature** per business docs
- Users need to see dispatcher behavior to understand performance issues

**What's Missing:**
- `InstrumentedDispatcher` wrapper
- `DispatcherSelected` event (only ThreadAssigned exists)
- Mapping between dispatcher and thread names
- Queue depth tracking

**Frontend Blocker:** Yes - Timeline and Thread Lanes components cannot be built without this data.

---

#### Gap 2: Projection Service / Derived Views ⚠️

**Business Impact:** HIGH  
**Why It Matters:**
- Frontend needs **pre-computed** hierarchies, not raw events
- Performance: Frontend shouldn't rebuild trees for every render
- Required for: HierarchyTree component, ThreadLanes component, Timeline scrubbing

**What's Missing:**
- `ProjectionService` class
- Hierarchy tree builder (parent-child relationships)
- Thread activity aggregator
- Timeline projections per coroutine
- Real-time projection updates

**Frontend Blocker:** Yes - All major visualizations depend on this.

---

#### Gap 3: Suspension Point Tracking ⚠️

**Business Impact:** MEDIUM  
**Why It Matters:**
- Timeline needs to show **exact suspension points** (delay, withContext, etc.)
- Educational value: users need to see where coroutines pause
- Debugging: identify slow operations

**What's Missing:**
- `SuspensionPoint` data structure (function name, line number, reason)
- ContinuationInterceptor integration
- Stack trace capture at suspension

**Frontend Blocker:** Partial - Basic timeline works, but lacks detail.

---

### 3.2 MEDIUM PRIORITY - Feature Gaps

#### Gap 4: Flow & Channel Instrumentation

**Business Impact:** MEDIUM  
**Why It Matters:**
- Advanced scenarios require Flow/Channel tracking
- Backpressure visualization is a **differentiator** per business docs
- Producer-consumer patterns need channel visibility

**What's Missing:**
- `InstrumentedFlow` wrapper
- `InstrumentedChannel` wrapper
- Flow events (FlowCollectionStarted, ValueEmitted, etc.)
- Channel events (Send/Receive, buffer depth)

**Frontend Blocker:** No - Can be added in Phase 2.

---

#### Gap 5: Event Filtering & Querying

**Business Impact:** MEDIUM  
**Why It Matters:**
- Large scenarios generate thousands of events
- Frontend needs filtered views (by coroutine, by scope, by type)
- Performance: streaming all events is wasteful

**What's Missing:**
- `EventFilter` class (partially exists in routing)
- Query DSL for events (e.g., "coroutineId:A AND kind:Suspended")
- Paginated event access with `sinceStep` (API exists but needs work)
- Server-side aggregation

**Frontend Blocker:** No - But will cause performance issues at scale.

---

### 3.3 LOW PRIORITY - Nice-to-Have

#### Gap 6: DebugProbes Integration

**Business Impact:** LOW  
**Suggested Timeline:** Phase 4 (Production Features)

#### Gap 7: OpenTelemetry Export

**Business Impact:** LOW  
**Suggested Timeline:** Phase 4 (Production Features)

#### Gap 8: Event Persistence (Database)

**Business Impact:** LOW  
**Current:** In-memory only  
**Suggested Timeline:** Phase 4 (Production Features)

---

## 4. Immediate Next Steps (Prioritized)

### Phase 1A: Complete Core Instrumentation (Weeks 1-2)

**Goal:** Unblock frontend development for timeline and hierarchy visualizations.

#### Task 1.1: Implement InstrumentedDispatcher ⭐⭐⭐
**Estimated Effort:** 6-8 hours  
**Dependencies:** None  
**Output:**
- `InstrumentedDispatcher.kt` wrapper class
- `DispatcherSelected` event
- Integration with VizScope (pass instrumented dispatchers)
- Update VizJob to emit dispatcher events on dispatch()

**Why First:** Dispatcher tracking is fundamental to all timeline visualizations.

---

#### Task 1.2: Build ProjectionService ⭐⭐⭐
**Estimated Effort:** 8-12 hours  
**Dependencies:** None  
**Output:**
- `ProjectionService.kt` class
- `HierarchyTree` builder (consumes CoroutineCreated events)
- `ThreadActivity` aggregator (consumes ThreadAssigned, CoroutineStarted/Completed)
- Real-time updates via EventBus subscription
- API endpoints: `GET /api/hierarchy`, `GET /api/threads`

**Why Second:** Frontend needs structured data, not raw event streams.

---

#### Task 1.3: Enhance Suspension Tracking ⭐⭐
**Estimated Effort:** 4-6 hours  
**Dependencies:** None  
**Output:**
- `SuspensionPoint` data class (function, file, line, reason)
- Update CoroutineSuspended event to include SuspensionPoint
- Capture stack trace snippet in VizScope.vizDelay() and similar

**Why Third:** Improves timeline detail for educational scenarios.

---

### Phase 1B: API Enhancements (Week 3)

#### Task 1.4: Event Filtering & Pagination ⭐⭐
**Estimated Effort:** 4-6 hours  
**Dependencies:** None  
**Output:**
- `EventFilter` class with DSL (e.g., `EventFilter.parse("coroutineId:A")`)
- Update `/api/sessions/{id}/events` to support `?filter=...&limit=100&sinceStep=50`
- SSE filtering support

**Why:** Performance optimization before frontend integration.

---

#### Task 1.5: Timeline Query Endpoint ⭐
**Estimated Effort:** 2-3 hours  
**Dependencies:** Task 1.2 (ProjectionService)  
**Output:**
- `GET /api/coroutines/{id}/timeline` (already exists in routing, needs ProjectionService backing)
- Return timeline with computed durations, thread assignments, parent/child links

**Why:** Frontend timeline component needs this specific view.

---

### Phase 2: Advanced Primitives (Weeks 4-6)

#### Task 2.1: Implement InstrumentedFlow ⭐⭐
**Estimated Effort:** 8-10 hours  
**Output:**
- `InstrumentedFlow.kt` wrapper
- Flow events: `FlowCollectionStarted`, `FlowValueEmitted`, `FlowCollectionCompleted`
- Integration with VizScope (e.g., `vizFlow()` builder)
- Scenario: `runFlowBackpressureScenario()`

---

#### Task 2.2: Implement InstrumentedChannel ⭐⭐
**Estimated Effort:** 8-10 hours  
**Output:**
- `InstrumentedChannel.kt` wrapper
- Channel events: `ChannelSendRequested`, `ChannelReceiveCompleted`, buffer depth tracking
- Scenario: `runProducerConsumerScenario()`

---

#### Task 2.3: Exception Propagation Tracking ⭐
**Estimated Effort:** 4-6 hours  
**Output:**
- `ExceptionPropagated` event
- Track exception flow through parent-child hierarchy
- Update EventApplier to build exception chain

---

### Phase 3: Production Readiness (Weeks 7-9)

#### Task 3.1: Performance Optimization
- Event batching for high-throughput scenarios
- Reservoir sampling for very large event streams
- Compression for SSE streams

#### Task 3.2: WebSocket Support
- Implement `/ws/events` endpoint (not just SSE)
- Bi-directional communication (client can request replays)

#### Task 3.3: Monitoring & Metrics
- Micrometer integration (already installed)
- Expose metrics: events/sec, active sessions, memory usage

---

## 5. Detailed TODO List

### 🔴 CRITICAL (Do First - Weeks 1-2)

- [ ] **DISP-1:** Create `InstrumentedDispatcher` class
  - [ ] Wrap `CoroutineDispatcher.dispatch()`
  - [ ] Emit `DispatcherSelected` event before dispatch
  - [ ] Wrap Runnable to emit ThreadAssigned on execution
  - [ ] Implement for Default, IO, Main dispatchers
  
- [ ] **DISP-2:** Add dispatcher tracking to VizScope
  - [ ] Pass instrumented dispatchers to vizLaunch()
  - [ ] Update VizJob to track dispatcher switches
  - [ ] Emit events on withContext(dispatcher) calls

- [ ] **PROJ-1:** Create ProjectionService class
  - [ ] Subscribe to EventBus in constructor
  - [ ] Build hierarchy tree from CoroutineCreated events
  - [ ] Maintain parent-child relationships in memory
  - [ ] Expose `getHierarchyTree(scopeId)` method

- [ ] **PROJ-2:** Add HierarchyNode data structure
  - [ ] Fields: id, parentId, children[], name, state, timestamps
  - [ ] Tree builder algorithm (recursive or iterative)
  - [ ] Handle orphaned nodes gracefully

- [ ] **PROJ-3:** Add ThreadActivity projection
  - [ ] Track which coroutine is on which thread at what time
  - [ ] Compute thread occupancy timeline
  - [ ] Expose `getThreadActivity()` method

- [ ] **API-1:** Add hierarchy endpoint
  - [ ] `GET /api/sessions/{id}/hierarchy`
  - [ ] Return tree structure (not flat list)
  - [ ] Include current state for each node

- [ ] **API-2:** Add thread activity endpoint
  - [ ] `GET /api/sessions/{id}/threads`
  - [ ] Return per-thread timeline data
  - [ ] Include dispatcher information

- [ ] **SUSP-1:** Enhance SuspensionPoint tracking
  - [ ] Add `SuspensionPoint` data class to events package
  - [ ] Capture function name, line number in CoroutineSuspended
  - [ ] Use `Throwable().stackTrace` to get call site info
  - [ ] Add "reason" field (delay, withContext, join, etc.)

---

### 🟡 HIGH PRIORITY (Weeks 3-4)

- [ ] **FILTER-1:** Implement EventFilter class
  - [ ] Parse filter strings (e.g., "coroutineId:A AND kind:Suspended")
  - [ ] Support operators: AND, OR, NOT, equals, contains
  - [ ] Apply filters to event streams

- [ ] **FILTER-2:** Add filtering to API endpoints
  - [ ] Update `/api/sessions/{id}/events?filter=...`
  - [ ] Update SSE endpoint to support filtering
  - [ ] Add unit tests for filter parsing

- [ ] **PAGE-1:** Implement proper pagination
  - [ ] Cursor-based pagination using stepIndex
  - [ ] `?sinceStep=X&limit=100` support
  - [ ] Return `nextStep` token in response

- [ ] **TIMELINE-1:** Enhanced timeline endpoint
  - [ ] Return events grouped by coroutine
  - [ ] Include computed durations
  - [ ] Add parent/child relationship links

---

### 🟢 MEDIUM PRIORITY (Weeks 5-8)

- [ ] **FLOW-1:** Implement InstrumentedFlow wrapper
  - [ ] Create wrapper class
  - [ ] Track collection start/end
  - [ ] Emit ValueEmitted events with sequence numbers
  - [ ] Add vizFlow() builder to VizScope

- [ ] **FLOW-2:** Add Flow events to event model
  - [ ] FlowCollectionStarted
  - [ ] FlowValueEmitted (with valuePreview)
  - [ ] FlowCollectionCompleted
  - [ ] FlowCollectionFailed

- [ ] **FLOW-3:** Create Flow scenario
  - [ ] runFlowBackpressureScenario()
  - [ ] Demonstrate slow collector
  - [ ] Show buffer behavior

- [ ] **CHAN-1:** Implement InstrumentedChannel wrapper
  - [ ] Wrap SendChannel and ReceiveChannel
  - [ ] Track buffer depth
  - [ ] Emit send/receive pairs with correlation IDs

- [ ] **CHAN-2:** Add Channel events to event model
  - [ ] ChannelSendRequested/Completed
  - [ ] ChannelReceiveRequested/Completed
  - [ ] Include buffer size and suspended status

- [ ] **CHAN-3:** Create Channel scenario
  - [ ] runProducerConsumerScenario()
  - [ ] Demonstrate rendezvous vs buffered
  - [ ] Show backpressure

- [ ] **EXC-1:** Implement exception propagation tracking
  - [ ] Add ExceptionPropagated event
  - [ ] Track exception flow through hierarchy
  - [ ] Update EventApplier to maintain exception chain

---

### 🔵 LOW PRIORITY (Weeks 9+)

- [ ] **PERF-1:** Event batching for high throughput
- [ ] **PERF-2:** Reservoir sampling for large streams
- [ ] **PERF-3:** SSE compression

- [ ] **WS-1:** Implement WebSocket endpoint
- [ ] **WS-2:** Add replay request protocol

- [ ] **MON-1:** Add Micrometer metrics
- [ ] **MON-2:** Expose /metrics endpoint

- [ ] **DB-1:** Event persistence (PostgreSQL)
- [ ] **DB-2:** Session persistence across restarts

- [ ] **DEBUG-1:** DebugProbes integration
- [ ] **OTEL-1:** OpenTelemetry exporter

---

## 6. Implementation Strategy Recommendations

### 6.1 Approach for Dispatcher Instrumentation

**Why This is Simple:**
- Dispatchers in Kotlin have a well-defined interface (`CoroutineDispatcher`)
- You only need to wrap the `dispatch()` method
- Thread assignment is captured by checking `Thread.currentThread()` inside the dispatched runnable

**Step-by-Step Approach:**

1. **Create wrapper class** that extends `CoroutineDispatcher`
2. **Delegate to real dispatcher** (Default, IO, etc.)
3. **Emit event before dispatch** (DispatcherSelected)
4. **Wrap the Runnable** to emit ThreadAssigned when it executes
5. **Integrate with VizScope** - provide instrumented dispatchers via `vizLaunch(dispatcher = ...)`

**Minimal Example Pattern:**
```
class InstrumentedDispatcher(delegate, session) : CoroutineDispatcher() {
    override fun dispatch(context, block) {
        // Emit DispatcherSelected event
        delegate.dispatch(context) {
            // Emit ThreadAssigned event
            block.run()
        }
    }
}
```

**Testing Strategy:**
- Create scenario with explicit dispatcher switches
- Verify DispatcherSelected events appear in timeline
- Verify thread IDs change correctly

---

### 6.2 Approach for ProjectionService

**Why This is Straightforward:**
- You already have EventBus with SharedFlow
- You already have event-driven architecture
- Just subscribe to events and build derived structures

**Step-by-Step Approach:**

1. **Subscribe to EventBus** in ProjectionService constructor
2. **Maintain in-memory maps:**
   - `coroutines: Map<String, HierarchyNode>`
   - `threads: Map<String, List<ThreadEvent>>`
3. **Process events incrementally:**
   - On CoroutineCreated → add to hierarchy
   - On ThreadAssigned → add to thread timeline
   - On CoroutineCompleted → update node state
4. **Build tree on query:**
   - Start from root nodes (parentId == null)
   - Recursively attach children
   - Return tree structure

**Key Insight:**
- This is just an event consumer that maintains derived state
- No complex algorithms needed - just event handlers
- Similar to your EventApplier pattern

**Testing Strategy:**
- Run nested scenario
- Query /api/hierarchy
- Verify parent-child relationships are correct
- Verify all coroutines present

---

### 6.3 Approach for Suspension Point Tracking

**Why This is Achievable:**
- Kotlin's suspend functions can capture stack traces
- You already have CoroutineSuspended event
- Just need to enrich it with call site information

**Step-by-Step Approach:**

1. **Create SuspensionPoint data class** (function, file, line, reason)
2. **Capture stack trace** when emitting CoroutineSuspended
3. **Parse stack trace** to extract relevant frame (usually first non-coroutines frame)
4. **Add reason field** based on context (delay vs withContext vs join)
5. **Update EventApplier** to store suspension points

**Stack Trace Capture:**
```
val stackTrace = Throwable().stackTrace
val suspensionPoint = SuspensionPoint(
    function = stackTrace[1].methodName,
    file = stackTrace[1].fileName,
    line = stackTrace[1].lineNumber,
    reason = "delay"  // or passed as parameter
)
```

**Testing Strategy:**
- Run scenario with delays
- Check events for suspension point data
- Verify line numbers match source code

---

## 7. What to Focus On (Priority Order)

### Week 1: Dispatcher Instrumentation
**Why:** Unblocks frontend timeline & thread lanes  
**Effort:** 6-8 hours  
**Risk:** Low - clean abstraction  
**Impact:** HIGH

### Week 2: ProjectionService
**Why:** Frontend needs hierarchy trees, not raw events  
**Effort:** 8-12 hours  
**Risk:** Low - event-driven pattern you already use  
**Impact:** HIGH

### Week 3: API Enhancement & Filtering
**Why:** Performance optimization before frontend load  
**Effort:** 4-6 hours  
**Risk:** Low - mostly HTTP layer changes  
**Impact:** MEDIUM

### Week 4-6: Flow & Channel (if needed for demo)
**Why:** Advanced scenarios, nice-to-have for Phase 1  
**Effort:** 16-20 hours  
**Risk:** Medium - more complex primitives  
**Impact:** MEDIUM (can defer to Phase 2)

---

## 8. Success Criteria

### Phase 1 Complete When:
- ✅ Dispatcher events are emitted for all coroutine dispatches
- ✅ ProjectionService builds hierarchy trees correctly
- ✅ Frontend can query `/api/hierarchy` and get tree structure
- ✅ Frontend can query `/api/threads` and get timeline data
- ✅ SSE streaming includes dispatcher information
- ✅ At least 6 teaching scenarios work with full instrumentation

### Ready for Frontend Integration When:
- ✅ All events include dispatcher and thread information
- ✅ Hierarchy tree includes current state for all nodes
- ✅ Timeline data includes suspension points
- ✅ Event filtering works via query parameters
- ✅ API documentation is complete

---

## 9. Risk Assessment

### Low Risk Items (Safe to Implement)
- ✅ Dispatcher wrapper (clean abstraction)
- ✅ ProjectionService (familiar pattern)
- ✅ Event filtering (HTTP layer only)
- ✅ Additional scenarios (same pattern as existing)

### Medium Risk Items (Require Testing)
- ⚠️ Flow instrumentation (complex semantics)
- ⚠️ Channel instrumentation (buffer tracking)
- ⚠️ Suspension point accuracy (stack trace parsing)

### High Risk Items (Defer to Later)
- ⚠️ Event persistence (database schema, migrations)
- ⚠️ DebugProbes integration (JVM-specific, fragile)
- ⚠️ OpenTelemetry (external dependency, complex setup)

---

## 10. Business Alignment Check

### Business Analysis Requirements vs Current State

| Requirement | Target (Business Doc) | Current State | Status |
|-------------|----------------------|---------------|--------|
| Core event model | Lifecycle + Dispatcher + Flow + Channel | Lifecycle ✅, Others ❌ | 40% |
| Wrapper coverage | Scope/Dispatcher/Flow/Channel | Scope ✅, Others ❌ | 25% |
| Teaching scenarios | 5-10 scenarios | 6 scenarios ✅ | 120% ✅ |
| Real-time streaming | SSE/WebSocket | SSE ✅, WS ❌ | 50% |
| Session management | Multi-session support | ✅ Implemented | 100% ✅ |
| API completeness | REST + streaming | REST ✅, streaming partial | 70% |
| Projection views | Hierarchy + Threads + Timeline | ❌ Missing | 0% |

**Overall Completion:** ~50% of Phase 1 requirements

**Business Impact:**
- ✅ Can demo basic scenarios to stakeholders
- ✅ Architecture is sound for investor pitch
- ⚠️ Cannot launch frontend until dispatcher + projections done
- ⚠️ Advanced scenarios (Flow/Channel) needed for differentiation

---

## 11. Recommendations for You

### What to Do Next (Pragmatic Order)

1. **Start with Dispatcher** (Week 1)
   - Highest impact for lowest effort
   - Unblocks frontend immediately
   - Clean implementation path

2. **Then ProjectionService** (Week 2)
   - Frontend dependency
   - Leverage existing event-driven architecture
   - Enables tree & timeline visualizations

3. **Then API Polish** (Week 3)
   - Filtering & pagination
   - Documentation
   - Testing

4. **Evaluate** (End of Week 3)
   - Can you demo timeline + hierarchy to frontend team?
   - Do you need Flow/Channel for MVP?
   - Is performance acceptable?

5. **Phase 2 Decision** (Week 4)
   - If frontend integration goes well → add Flow/Channel
   - If blocked on frontend → optimize performance
   - If ahead of schedule → add DebugProbes mode

### Learning Path Recommendations

**To Understand Dispatchers Better:**
- Read: `kotlinx-coroutines-core/jvm/src/Dispatchers.kt` (lines 14-65)
- Experiment: Create scenarios with explicit dispatcher switches
- Reference: Your business doc section 11.4 (lines 484-496)

**To Understand Projection Pattern:**
- Look at: Your own `EventApplier.kt` - ProjectionService is similar
- Pattern: Event → Update State → Query State
- Reference: Business doc section 6.5 (lines 928-980)

**To Understand Suspension Tracking:**
- Read: `kotlinx-coroutines-core/common/src/CancellableContinuation.kt`
- Experiment: Capture stack traces in suspend functions
- Reference: Business doc section 11.7 (lines 543-547)

---

## 12. Final Assessment

### You Are Here: ⭐⭐⭐ (3/5 stars)

**Strong foundation, ready for critical enhancements.**

**What's Working:**
- Architecture is correct
- Event model is extensible
- Scenarios are excellent
- Session management is solid

**What Needs Work:**
- Dispatcher instrumentation (critical gap)
- Projection service (frontend blocker)
- Flow/Channel wrappers (feature gap)

**Verdict:** 
- ✅ You can successfully continue with this codebase
- ✅ No major refactoring needed
- ✅ Clear path to completion
- ⚠️ Need 2-3 weeks to reach "frontend-ready" state

### Business Viability: ✅ PROCEED

Your implementation demonstrates:
- Technical competence (clean Kotlin, good architecture)
- Understanding of coroutines (wrappers work correctly)
- Pragmatic approach (working scenarios, not over-engineered)

**Recommendation:** Execute Phase 1A (Dispatcher + Projections) immediately, then coordinate with frontend team.

---

**End of Analysis**

*For questions or clarifications, refer to specific TODO items by ID (e.g., DISP-1, PROJ-2)*

