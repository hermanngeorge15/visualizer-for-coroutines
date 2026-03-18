# Coroutine Visualizer — User Guide

A real-time tool for visualizing Kotlin coroutine execution, flow operators, synchronization primitives, and structured concurrency.

## Getting Started

### Running the Application

```bash
# Docker (recommended)
docker compose up
# Frontend: http://localhost:3000
# Backend:  http://localhost:8080

# Local development
cd backend && ./gradlew run      # starts on :8080
cd frontend && pnpm dev           # starts on :3000
```

### First Steps

1. Open `http://localhost:3000` in your browser
2. Navigate to **Scenarios** to browse available demos
3. Pick a scenario (e.g., "Nested Coroutines") and click **Prepare Scenario**
4. Watch the visualization panels populate in real time

---

## Pages

### Home

Overview of the project with feature highlights and quick links to recent sessions.

### Scenarios

Browse pre-built scenarios organized by category:

| Category | Scenarios | Purpose |
|----------|-----------|---------|
| **Basic** | Nested, Parallel, Cancellation, Deep Nesting, Mixed, Exception | Core coroutine lifecycle |
| **Channels** | Rendezvous, Buffered, Fan-Out | Channel send/receive patterns |
| **Flows** | Simple, Operators, StateFlow, SharedFlow | Flow emission and collection |
| **Patterns** | Retry, Producer-Consumer, Fan-Out/Fan-In, Supervisor, Circuit Breaker | Real-world concurrency patterns |
| **Real-World** | Order Processing, User Registration, Report Generation | Realistic service simulations |
| **Sync** | Mutex Counter, Bank Transfer, Cache, Deadlock, Connection Pool, Rate Limiter, File Processor, Resource Timeout, Producer-Consumer, E-Commerce Combined | Synchronization primitives |

### Sessions

Browse all active sessions, create empty sessions, or delete old ones.

### Session Details (Main Dashboard)

The primary visualization page. After running a scenario, this page shows tabbed panels with live data streaming via SSE.

### Gallery

Curated scenarios with difficulty labels (beginner / intermediate / advanced) for learning.

---

## Visualization Panels

### Coroutine Tree

Hierarchical list of coroutines showing parent-child relationships.

- **States**: CREATED, ACTIVE, SUSPENDED, WAITING_FOR_CHILDREN, COMPLETED, CANCELLED, FAILED
- Color-coded badges per state
- Pulsing animation on ACTIVE coroutines
- Shake animation on FAILED/CANCELLED
- Indentation reflects nesting depth

### Coroutine Graph

Interactive DAG (directed acyclic graph) of the coroutine hierarchy.

- **Pan & Zoom**: Drag to pan, scroll to zoom
- **Lock toggle**: Prevents accidental pan/zoom
- **Reset View**: Re-center the graph
- Active coroutine counter in the header

### Events List

Reverse-chronological log of all events emitted during the session.

- **Filter/Search**: By event kind, coroutine ID, or label
- Service icons auto-detected from labels (Email, Database, API, Cloud, Analytics)
- Timestamps with relative formatting
- Newest events appear at the top

### Thread Lanes

Thread activity organized by dispatcher with utilization metrics.

- **Overview bar**: Average utilization %, max utilization %, dispatcher count
- **Per-dispatcher lanes**: Active threads over time
- **Utilization gauges**: Visual fill bars per thread
- Color-coded by dispatcher (Main, Default, IO, Unconfined)

### Dispatcher Overview

Summary cards for each active dispatcher showing thread pool size, thread IDs, and queue depth.

### Channel Panel

Per-channel visualization of send/receive operations.

- **Buffer Gauge**: Visual bar showing buffer capacity vs. current usage
- **Channel Timeline**: Chronological send/receive events with suspension markers
- **Producer/Consumer view**: Which coroutines are sending and receiving
- Tracks buffer state changes and channel close events

### Flow Panel

Cold and hot flow visualization with operator chains.

- **Summary stats**: Total flows, operators, emissions, backpressure events
- **Operator Chain**: Visual pipeline of `.map()`, `.filter()`, `.transform()` operators
- **Value Trace**: Path of emitted values through operator pipeline
- **Backpressure Indicator**: Animated warning when backpressure detected
- SharedFlow subscription tracking, StateFlow value changes

### Sync Panel

Mutex and Semaphore state with deadlock detection.

- **Deadlock Warning**: Highlighted alert if deadlock detected or potential deadlock
- **Mutex State**: Locked/unlocked, current owner, wait queue length
- **Wait Queue**: List of coroutines waiting to acquire the lock
- **Semaphore Gauge**: Permits available vs. total (progress bar)
- Color-coded: green = unlocked, yellow = locked, red = deadlock

### Job Panel

Job lifecycle and structured concurrency tracking.

- **Summary**: Total jobs, active, completed, cancelled (color-coded counters)
- **Waiting For Children**: Cards showing parent jobs awaiting child completion
- **Job Hierarchy**: Parent-child job tree
- State badges with transition animations

### Validation Panel

Run structural and timing validation against a session.

- Click **Run Validation** to analyze the session
- **Validation Score**: 0-100 based on findings
- **Severity Filters**: Error, Warning, Info toggles
- **Category Groups**: Findings by rule type (lifecycle, structured concurrency, threading, resource, exception)
- Each finding includes severity, description, and remediation suggestion

### Actor Panel

Actor lifecycle and mailbox monitoring (when using actor pattern).

- Actor count (active vs. closed)
- Per-actor cards with mailbox size, capacity, message count
- Last 10 messages with type preview

### Select Expression Panel

Visualization of `select { }` clause racing.

- Per-select card showing clauses, winner, and duration
- Clause bars showing type (send/receive/onTimeout), channel/deferred ID
- Winner highlight with animation

---

## Controls

| Control | Icon | Action |
|---------|------|--------|
| **Live Stream** | Radio | Toggle real-time SSE event streaming |
| **Run Scenario** | Play | Execute the scenario and populate events |
| **View Mode** | List/Branch | Switch between tree list and graph views |
| **Reset Session** | Rotate | Clear all data and start fresh |

Auto-refresh runs at 500ms intervals when SSE streaming is active.

---

## Event Types

The visualizer tracks 48+ event types across these categories:

- **Coroutine Lifecycle** (8): Created, Started, Suspended, Resumed, BodyCompleted, Completed, Cancelled, Failed
- **Job** (4): StateChanged, JoinRequested, JoinCompleted, CancellationRequested
- **Channel** (9): Created, SendStarted, SendSuspended, SendCompleted, ReceiveStarted, ReceiveSuspended, ReceiveCompleted, Closed, BufferStateChanged
- **Flow** (10): Created, CollectionStarted, CollectionCompleted, CollectionCancelled, ValueEmitted, ValueTransformed, ValueFiltered, OperatorApplied, Backpressure, BufferOverflow
- **Reactive** (3): StateFlowValueChanged, SharedFlowEmission, SharedFlowSubscription
- **Deferred** (3): AwaitStarted, AwaitCompleted, ValueAvailable
- **Sync** (14): Mutex (Created, LockRequested, LockAcquired, Unlocked, TryLockFailed, QueueChanged), Semaphore (Created, AcquireRequested, PermitAcquired, PermitReleased, TryAcquireFailed, StateChanged), DeadlockDetected, PotentialDeadlockWarning
- **Dispatcher** (2): DispatcherSelected, ThreadAssigned
- **Select** (4): Started, ClauseRegistered, ClauseWon, Completed
- **Actor** (7): Created, MessageSent, MessageProcessing, MessageProcessed, StateChanged, MailboxChanged, Closed
- **Other**: WaitingForChildren, SuspensionPoint, AntiPatternDetected, ValidationFindingEmitted

---

## Tips

- **Start simple**: Run the "Nested" scenario first to understand the tree and event panels
- **Watch the threads**: The Thread Lanes view shows how coroutines map to actual threads
- **Try deadlock detection**: Run the "Deadlock Demo" sync scenario to see the warning system
- **Use validation**: After a scenario completes, run validation to check for anti-patterns
- **Compare scenarios**: Open multiple sessions side-by-side to compare patterns
- **Filter events**: Use the search bar in the Events panel to focus on specific coroutines
