# Backend Implementation Tasks

> Based on: BUSINESS_ANALYSIS_V2.md, coroutine-visualizer-backend-chap51.md, COROUTINE-VISUALIZER-BUSINESS-ANALYSIS.md

## Phase 1: Foundation (Weeks 1-8)

### Core Event Model & Infrastructure

- [ ] **Event Model Design**
  - [ ] Define sealed interface hierarchy for `VisualizerEvent`
  - [ ] Implement `CoroutineLifecycleEvent` subtypes (Created, Started, Suspended, Resumed, Completed, Cancelled, Failed)
  - [ ] Implement `DispatcherEvent` subtypes (Selected, ThreadAssigned)
  - [ ] Implement `FlowEvent` subtypes (CollectionStarted, ValueEmitted, CollectionCompleted)
  - [ ] Implement `ChannelEvent` subtypes (SendRequested, SendCompleted, ReceiveRequested, ReceiveCompleted)
  - [ ] Implement `ExceptionEvent` subtypes (Thrown, Propagated)
  - [ ] Add `stepIndex` (monotonic counter) to all events for deterministic replay
  - [ ] Add kotlinx.serialization annotations to all event classes

- [ ] **ID Registry & Context**
  - [ ] Implement `IdRegistry` with ULID generation
  - [ ] Create bidirectional mapping: Job ↔ coroutineId, Scope ↔ scopeId
  - [ ] Implement `InstrumentationContext` as `CoroutineContext.Element`
  - [ ] Add context propagation utilities
  - [ ] Implement parent-child ID tracking

- [ ] **Event Bus Implementation**
  - [ ] Create `EventSink` interface with `publish(event)` method
  - [ ] Implement `InMemoryEventBus` using `SharedFlow`
  - [ ] Add replay buffer (configurable size, default 1000)
  - [ ] Implement buffer overflow strategy (DROP_OLDEST)
  - [ ] Add atomic step counter for `stepIndex` assignment
  - [ ] Implement `subscribe(filter)` with filter support

- [ ] **Timeline Storage**
  - [ ] Implement `TimelineStore` with ring buffer
  - [ ] Add event indexing by coroutineId, scopeId, threadId, dispatcherId
  - [ ] Implement `getEvents(sinceStep, limit, filter)`
  - [ ] Implement `getCoroutineTimeline(coroutineId)`
  - [ ] Add snapshot persistence capability (optional)
  - [ ] Implement cursor-based pagination

### Instrumentation Wrappers (Core)

- [ ] **InstrumentedScope**
  - [ ] Implement `CoroutineScope` delegation pattern
  - [ ] Create `launch()` wrapper with event emission
  - [ ] Create `async()` wrapper with event emission
  - [ ] Implement lifecycle probe using `invokeOnCompletion`
  - [ ] Add coroutine naming support
  - [ ] Track parent-child relationships
  - [ ] Emit CoroutineCreated on launch
  - [ ] Emit CoroutineCompleted/Cancelled/Failed on completion
  - [ ] Wrap user block with try/catch for exception events

- [ ] **InstrumentedDispatcher**
  - [ ] Extend `CoroutineDispatcher`
  - [ ] Override `dispatch()` to emit DispatcherSelected
  - [ ] Wrap Runnable to emit ThreadAssigned
  - [ ] Preserve `isDispatchNeeded()` semantics
  - [ ] Estimate queue depth (dispatcher-specific)
  - [ ] Create factory for Default, IO, Unconfined dispatchers

- [ ] **Suspension Point Tracking**
  - [ ] Implement `ContinuationInterceptor` wrapper
  - [ ] Override `interceptContinuation()` to wrap continuations
  - [ ] Emit CoroutineSuspended before suspension
  - [ ] Emit CoroutineResumed on resumption
  - [ ] Capture suspension point metadata (function, file, line)
  - [ ] Differentiate suspension reasons (delay, withContext, channel.receive, etc.)

### Ktor Application Setup

- [ ] **Application Module**
  - [ ] Configure ContentNegotiation with kotlinx.serialization JSON
  - [ ] Install WebSockets plugin with configuration
  - [ ] Install CORS for frontend access
  - [ ] Set up dependency injection for core services
  - [ ] Configure logging (Logback)
  - [ ] Add error handling middleware

- [ ] **REST API Routes**
  - [ ] `GET /api/events?sinceStep={step}&limit={limit}&filter={filter}`
  - [ ] `GET /api/hierarchy?scopeId={id}` - coroutine tree
  - [ ] `GET /api/coroutines/{id}` - coroutine details
  - [ ] `GET /api/coroutines/{id}/timeline` - event timeline
  - [ ] `GET /api/threads` - thread activity overview
  - [ ] `GET /api/dispatchers` - dispatcher statistics
  - [ ] `GET /api/health` - health check endpoint
  - [ ] Add request validation and error responses

- [ ] **WebSocket/SSE Streaming**
  - [ ] Implement `GET /sse/events` with Server-Sent Events
  - [ ] Implement `WebSocket /ws/events` for live streaming
  - [ ] Add filter query parameter support
  - [ ] Implement graceful connection handling
  - [ ] Add heartbeat/ping mechanism
  - [ ] Handle backpressure with buffer overflow

### Projection Service

- [ ] **Hierarchy Projection**
  - [ ] Build parent-child tree from CoroutineCreated events
  - [ ] Implement `getHierarchyTree(scopeId)` query
  - [ ] Add node state tracking (active, completed, cancelled, failed)
  - [ ] Calculate subtree statistics (total children, active count)

- [ ] **Thread Activity Projection**
  - [ ] Track thread assignment events
  - [ ] Build thread timelines
  - [ ] Calculate thread occupancy/utilization
  - [ ] Detect thread starvation patterns

- [ ] **Dispatcher Statistics**
  - [ ] Track queue depth over time
  - [ ] Calculate average wait time
  - [ ] Identify hot dispatchers
  - [ ] Detect starvation conditions

---

## Phase 2: Concurrency Primitives (Weeks 9-14)

### Advanced Wrappers

- [ ] **InstrumentedFlow**
  - [ ] Implement `Flow<T>` delegation
  - [ ] Override `collect()` to track collection lifecycle
  - [ ] Wrap `FlowCollector` to intercept emissions
  - [ ] Emit FlowCollectionStarted with collectorId
  - [ ] Emit FlowValueEmitted for each value (with sequence number)
  - [ ] Emit FlowCollectionCompleted/Failed
  - [ ] Handle backpressure transparently
  - [ ] Preserve SafeCollector semantics

- [ ] **InstrumentedChannel**
  - [ ] Implement `Channel<E>` delegation (SendChannel + ReceiveChannel)
  - [ ] Wrap `send()` to emit ChannelSendRequested/Completed
  - [ ] Wrap `receive()` to emit ChannelReceiveRequested/Completed
  - [ ] Track suspension on send/receive
  - [ ] Estimate buffer size using `trySend().isSuccess`
  - [ ] Handle rendezvous vs buffered semantics
  - [ ] Add correlation IDs for send/receive pairs

- [ ] **withContext Wrapper**
  - [ ] Track dispatcher switches
  - [ ] Emit context change events
  - [ ] Preserve exception handling
  - [ ] Track nested withContext calls

- [ ] **coroutineScope/supervisorScope Wrappers**
  - [ ] Track scope boundaries
  - [ ] Emit ScopeCreated/ScopeClosed events
  - [ ] Handle structured concurrency semantics
  - [ ] Track supervisor boundaries for exception isolation

### Exception & Cancellation Tracking

- [ ] **Exception Propagation**
  - [ ] Track exception origin (coroutineId)
  - [ ] Build propagation chain (child → parent)
  - [ ] Differentiate CancellationException vs failures
  - [ ] Emit ExceptionThrown and ExceptionPropagated events
  - [ ] Highlight supervisor boundaries in events

- [ ] **Cancellation Tracking**
  - [ ] Hook into `invokeOnCompletion(onCancelling=true)`
  - [ ] Track cancellation cause and origin
  - [ ] Track cancellation propagation to children
  - [ ] Emit CoroutineCancelled with propagation info
  - [ ] Detect timeout cancellations specifically

### Filter & Query System

- [ ] **EventFilter Implementation**
  - [ ] Parse filter strings (e.g., "coroutineId:A")
  - [ ] Support multiple filter criteria (AND/OR)
  - [ ] Filter by coroutineId, scopeId, eventType, threadId, dispatcherId
  - [ ] Support wildcard patterns
  - [ ] Add filter validation

- [ ] **Advanced Queries**
  - [ ] Find all children of coroutine X
  - [ ] Find all coroutines on thread Y
  - [ ] Find all events between timestamps
  - [ ] Find exceptions by type
  - [ ] Find long-running coroutines

---

## Phase 3: Teaching Scenarios & Diagnostics (Weeks 15-20)

### Scenario Runner

- [ ] **Scenario Framework**
  - [ ] Create `Scenario` interface
  - [ ] Implement `ScenarioRunner` service
  - [ ] Add scenario registration system
  - [ ] Implement `POST /api/scenarios/{name}/run`
  - [ ] Implement `GET /api/scenarios/{runId}/status`
  - [ ] Add scenario lifecycle management (start, stop, reset)

- [ ] **Built-in Teaching Scenarios**
  - [ ] Race Condition: Shared mutable state without synchronization
  - [ ] Starvation: Blocking calls on limited dispatcher
  - [ ] Deadlock: Circular channel dependencies
  - [ ] Structured Concurrency: Parent-child cancellation
  - [ ] Exception Propagation: SupervisorJob vs regular Job
  - [ ] Flow Backpressure: Fast producer, slow collector
  - [ ] Channel Buffering: Rendezvous vs buffered channels
  - [ ] Dispatcher Switching: withContext(IO) → Default
  - [ ] Lazy Coroutines: CoroutineStart.LAZY behavior
  - [ ] Timeout & Cancellation: withTimeout scenarios

### DebugProbes Integration

- [ ] **DebugProbes Bridge**
  - [ ] Implement opt-in DebugProbes installation
  - [ ] Call `DebugProbes.dumpCoroutinesInfo()` periodically
  - [ ] Convert `CoroutineInfo` to VisualizerEvents
  - [ ] Tag events with `source = "debug-probes"`
  - [ ] Merge probe snapshots with wrapper events
  - [ ] Add configuration for sampling interval

- [ ] **Mode Toggle**
  - [ ] Define `InstrumentationMode` enum (Teaching, Diagnostics, Hybrid)
  - [ ] Implement mode switching API
  - [ ] Teaching: Full wrappers, verbose events
  - [ ] Diagnostics: DebugProbes + thin wrappers
  - [ ] Hybrid: Wrappers for user code, probes for libraries

### OpenTelemetry Integration

- [ ] **OTel Exporter**
  - [ ] Add OpenTelemetry SDK dependency
  - [ ] Create `OTelCoroutineTracer`
  - [ ] Convert events to OTLP spans
  - [ ] Implement span context propagation
  - [ ] Start span on CoroutineCreated
  - [ ] End span on CoroutineCompleted
  - [ ] Add span attributes (coroutineId, dispatcherId, etc.)
  - [ ] Configure OTLP exporter endpoint

---

## Phase 4: Production Features (Weeks 21-26)

### Persistence Layer

- [ ] **Event Store**
  - [ ] Choose persistence backend (SQLite, PostgreSQL, or file-based)
  - [ ] Implement `PersistentEventStore`
  - [ ] Create database schema for events
  - [ ] Add batch insert optimization
  - [ ] Implement event replay from storage
  - [ ] Add retention policy (time-based or count-based)

- [ ] **Snapshot Storage**
  - [ ] Save timeline snapshots for completed scenarios
  - [ ] Implement snapshot retrieval API
  - [ ] Add snapshot comparison feature
  - [ ] Export snapshots as JSON

### Performance Optimization

- [ ] **Overhead Reduction**
  - [ ] Add sampling mode (emit 1/N events)
  - [ ] Implement lazy event serialization
  - [ ] Use object pooling for event instances
  - [ ] Add performance benchmarks
  - [ ] Measure instrumentation overhead (< 5% target)

- [ ] **Scalability**
  - [ ] Implement server-side event aggregation
  - [ ] Add rate limiting for WebSocket connections
  - [ ] Compress event payloads
  - [ ] Add pagination for large result sets
  - [ ] Implement reservoir sampling for high-volume scenarios

### Advanced Features

- [ ] **Event Replay & Time Travel**
  - [ ] Implement deterministic replay from stepIndex
  - [ ] Add playback speed control (real-time, 2x, 0.5x)
  - [ ] Support pause/resume during replay
  - [ ] Add step-through debugging mode

- [ ] **Comparison & Diffing**
  - [ ] Compare two scenario runs side-by-side
  - [ ] Highlight differences in execution paths
  - [ ] Show timing deltas

- [ ] **Custom Visualization API**
  - [ ] Allow plugins to define custom event types
  - [ ] Provide extension points for custom projections
  - [ ] Document plugin API

### Security & Authentication

- [ ] **Authentication**
  - [ ] Add JWT-based authentication for API endpoints
  - [ ] Implement session management for WebSocket connections
  - [ ] Add role-based access control (viewer, runner, admin)

- [ ] **Security Hardening**
  - [ ] Input validation for all endpoints
  - [ ] Rate limiting per user/IP
  - [ ] Sanitize value previews (prevent injection)
  - [ ] Add HTTPS enforcement option
  - [ ] Implement CORS whitelist configuration

---

## Phase 5: Enterprise & Ecosystem (Post-MVP)

### Enterprise Features

- [ ] **Multi-tenancy**
  - [ ] Isolate scenarios by tenant/workspace
  - [ ] Add workspace management API
  - [ ] Implement resource quotas per workspace

- [ ] **Team Collaboration**
  - [ ] Share scenarios via links
  - [ ] Add comments/annotations on events
  - [ ] Implement real-time collaborative viewing

- [ ] **Analytics Dashboard**
  - [ ] Aggregate metrics across multiple runs
  - [ ] Show trends over time (performance, error rates)
  - [ ] Generate reports (PDF, CSV)

### CI/CD Integration

- [ ] **Test Integration**
  - [ ] JUnit integration: Run scenarios in tests
  - [ ] Assert on expected event sequences
  - [ ] Detect concurrency regression
  - [ ] Generate test reports with visualizations

- [ ] **CLI Tool**
  - [ ] Command-line scenario runner
  - [ ] Export results to file
  - [ ] Integration with CI pipelines

### Documentation

- [ ] **API Documentation**
  - [ ] Generate OpenAPI/Swagger spec
  - [ ] Add endpoint examples
  - [ ] Document event schema
  - [ ] Add integration guide

- [ ] **Architecture Documentation**
  - [ ] Component diagrams
  - [ ] Sequence diagrams for key flows
  - [ ] Extension/plugin guide
  - [ ] Performance tuning guide

---

## Testing & Quality Assurance

### Unit Tests

- [ ] Test `InstrumentedScope` wrapper behavior
- [ ] Test `InstrumentedDispatcher` delegation
- [ ] Test `InstrumentedFlow` emission tracking
- [ ] Test `InstrumentedChannel` send/receive pairing
- [ ] Test `EventBus` subscription and filtering
- [ ] Test `TimelineStore` indexing and queries
- [ ] Test `ProjectionService` hierarchy building

### Integration Tests

- [ ] Test end-to-end scenario execution
- [ ] Test WebSocket event streaming
- [ ] Test REST API pagination
- [ ] Test filter combinations
- [ ] Test concurrent scenario runs
- [ ] Test persistence and replay

### Performance Tests

- [ ] Benchmark instrumentation overhead
- [ ] Load test with 1000+ coroutines
- [ ] Stress test event bus throughput
- [ ] Measure WebSocket latency
- [ ] Profile memory usage

---

## Deployment & Operations

- [ ] **Containerization**
  - [ ] Create Dockerfile
  - [ ] Add docker-compose for local development
  - [ ] Optimize image size

- [ ] **Configuration Management**
  - [ ] Externalize configuration (application.yaml)
  - [ ] Add environment-specific configs (dev, prod)
  - [ ] Document configuration options

- [ ] **Monitoring**
  - [ ] Add health check endpoint
  - [ ] Expose metrics (Prometheus format)
  - [ ] Add structured logging
  - [ ] Implement error tracking (Sentry integration)

- [ ] **Deployment Guide**
  - [ ] Write deployment instructions
  - [ ] Provide Kubernetes manifests
  - [ ] Add reverse proxy configuration (Nginx)





