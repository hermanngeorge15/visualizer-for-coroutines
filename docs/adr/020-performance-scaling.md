# ADR-020: Performance Scaling

## Status
Accepted

## Date
2026-03-18

## Context
The backend has no load testing, no observability metrics, no event sampling, and no resource bounds on the event store. A high-volume scenario (hundreds of coroutines emitting thousands of events per second) could exhaust memory and crash the server. SSE connections are unbounded, and there is no way to measure system health under load. Before production deployment, we need bounded resources, observability, and a way to validate performance characteristics.

## Decision
Address performance across six areas: bounded storage, metrics, sampling, load testing, SSE optimization, and event batching.

### 1. Bounded Event Store
Add a configurable maximum events per session:

```kotlin
class BoundedEventStore(
    private val maxEventsPerSession: Int = 100_000
) : EventStoreInterface {
    override suspend fun append(sessionId: String, event: VizEvent) {
        if (count(sessionId) >= maxEventsPerSession) {
            // Drop event and increment dropped counter
            metrics.counter("events.dropped").increment()
            return
        }
        delegate.append(sessionId, event)
    }
}
```

When the limit is reached, new events are dropped (not oldest-evicted) to preserve the session's initial state and event ordering. A warning event is injected to notify the frontend that events are being dropped.

### 2. Micrometer Metrics
Integrate Micrometer with Prometheus registry for observability:

| Metric | Type | Description |
|---|---|---|
| `events.emitted` | Counter | Total events emitted across all sessions |
| `events.dropped` | Counter | Events dropped due to bounds or sampling |
| `events.buffer.size` | Gauge | Current event count per session (tagged by session_id) |
| `sse.clients.active` | Gauge | Number of active SSE connections |
| `sessions.active` | Gauge | Number of active sessions |
| `scenario.duration` | Timer | Time to complete scenario execution |
| `event.processing.duration` | Timer | Time to process and broadcast a single event |

Expose metrics at `GET /metrics` in Prometheus exposition format.

```kotlin
install(MicrometerMetrics) {
    registry = PrometheusMeterRegistry(PrometheusConfig.DEFAULT)
    meterBinders = listOf(
        JvmMemoryMetrics(),
        JvmGcMetrics(),
        ProcessorMetrics()
    )
}
```

### 3. Per-Event-Type Sampling
Allow sampling rates per event type to reduce volume for noisy events while preserving critical lifecycle events:

```yaml
sampling:
  default: 1.0                    # pass everything by default
  overrides:
    ThreadAssigned: 0.1           # sample 10% of thread assignments
    DispatcherSelected: 0.1       # sample 10% of dispatcher selections
    ChannelBufferStateChanged: 0.5 # sample 50% of buffer state changes
  alwaysPass:                     # these are never sampled
    - CoroutineCreated
    - CoroutineCompleted
    - CoroutineFailed
    - CoroutineCancelled
    - FlowCollectionStarted
    - FlowCollectionCompleted
```

Sampling is applied at the `EventBus` level before broadcasting. A deterministic hash of `(sessionId, seq)` ensures reproducible sampling behavior.

### 4. Load Test Harness
A synthetic event producer for validating performance characteristics:

```kotlin
class LoadTestProducer(
    private val numCoroutines: Int,
    private val eventsPerSecond: Int,
    private val durationSeconds: Int
) {
    suspend fun run(session: VizSession) {
        // Launch numCoroutines, each emitting events at the configured rate
        // Measure throughput, latency percentiles, memory usage
    }
}
```

Exposed via a dev-only route:
```
POST /api/dev/load-test
{
  "coroutines": 100,
  "eventsPerSecond": 500,
  "durationSeconds": 30
}

Response 200:
{
  "totalEvents": 15000,
  "eventsDropped": 0,
  "p50LatencyMs": 2,
  "p99LatencyMs": 18,
  "peakMemoryMb": 256
}
```

This route is only registered when `COROUTINE_VIZ_DEV=true` environment variable is set.

### 5. SSE Compression
Enable gzip compression for SSE responses to reduce bandwidth for remote clients:

```kotlin
install(Compression) {
    gzip {
        matchContentType(ContentType.Text.EventStream)
        minimumSize(1024)
        priority = 1.0
    }
}
```

Additionally, set `Cache-Control: no-cache` and `X-Accel-Buffering: no` headers to prevent reverse proxies from buffering SSE streams.

### 6. Event Batching
Batch events before broadcasting over SSE to reduce the number of messages:

```kotlin
class BatchingEventBus(
    private val batchSize: Int = 50,
    private val batchTimeoutMs: Long = 100
) {
    // Accumulate events up to batchSize or batchTimeoutMs, then flush as a JSON array
    // Single events below the timeout threshold are sent immediately
}
```

The frontend SSE handler already processes events individually — it needs to be updated to handle JSON arrays and unpack batched events.

### Configuration
```yaml
performance:
  maxEventsPerSession: 100000
  sse:
    compression: true
    batchSize: 50
    batchTimeoutMs: 100
  sampling:
    default: 1.0
    overrides: {}
  loadTest:
    enabled: false    # only in dev
```

## Alternatives Considered

### Kafka for Event Streaming
Apache Kafka provides excellent event streaming with partitioning, retention, and replay. However, it is a major external dependency requiring dedicated infrastructure, and our event volumes (thousands/sec, not millions) do not justify the operational complexity.

### Redis as Event Store
Redis Streams could serve as a bounded event store with built-in consumer groups. However, Redis adds an external service dependency and requires careful memory management. The in-memory + PostgreSQL approach from ADR-015 covers our needs without additional infrastructure.

### Client-Side Sampling
Perform sampling in the frontend rather than the backend. This does not reduce server memory pressure or SSE bandwidth, which are the primary concerns. Backend sampling is more effective.

## Consequences

### Positive
- Bounded event store prevents OOM crashes from runaway scenarios
- Micrometer metrics enable monitoring, alerting, and capacity planning
- Sampling reduces noise for high-frequency events while preserving critical lifecycle events
- Load test harness validates performance characteristics before production deployment
- SSE compression reduces bandwidth by 60-80% for text-heavy event streams
- Event batching reduces SSE message overhead and browser event processing load

### Negative
- Sampling means some events are permanently lost — debugging may miss sampled-out events
- Bounded store drops tail events, potentially hiding issues that occur late in execution
- Metrics collection adds small per-event overhead
- Batching adds latency (up to batchTimeoutMs) to event delivery
- Load test harness could be accidentally enabled in production if env vars are misconfigured

## Related
- ADR-015: Persistence Strategy (retention policy complements bounded event store)
- ADR-013: Core Library Extraction (metrics live in the backend module, not core)
