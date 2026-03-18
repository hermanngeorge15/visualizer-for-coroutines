# Backpressure Strategies in Kotlin Flows

**Version:** 1.0  
**Date:** December 2025  
**Status:** Design Document

---

## Executive Summary

**Backpressure** is what happens when a producer emits data faster than a consumer can process it. Kotlin Flow provides multiple strategies to handle this mismatch. This document visualizes each strategy to help developers understand when to use which.

**Strategies Covered:**
- Default (suspend producer)
- buffer() - Buffered emissions
- conflate() - Keep only latest
- collectLatest() - Cancel slow processing
- debounce() / sample() - Time-based filtering

---

## 1. The Backpressure Problem

### 1.1 What Causes Backpressure?

```
PRODUCER (fast)                    CONSUMER (slow)
     │                                  │
     │  emit(1) ──────────────────────▶ │  process(1)... 500ms
     │  emit(2) 🔴 WAIT!                │  still processing...
     │  emit(3) 🔴 WAIT!                │  still processing...
     │  emit(4) 🔴 WAIT!                │  done!
     │  ─────────────────────────────▶  │  process(2)... 500ms
     │                                  │
     
❌ Producer BLOCKED waiting for slow consumer
```

### 1.2 Real-World Examples

| Scenario | Producer | Consumer |
|----------|----------|----------|
| Sensor data | 1000 readings/sec | DB write (10ms each) |
| Search autocomplete | User types fast | Network API call |
| Log streaming | Rapid log events | UI rendering |
| Stock tickers | 100 updates/sec | Chart update |

---

## 2. Default Behavior (Suspending)

### 2.1 How It Works

By default, Flow **suspends the producer** when the consumer is busy. This is the safest but slowest approach.

```kotlin
flow {
    repeat(1000) { i ->
        emit(i)  // Suspends here until consumed!
    }
}.collect { value ->
    delay(100)  // Slow consumer
    process(value)
}
```

### 2.2 Visualization

```
┌─────────────────────────────────────────────────────────────┐
│           DEFAULT BACKPRESSURE (Suspend)                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Producer              Consumer                              │
│     │                     │                                  │
│  emit(1)─────────────────▶│                                  │
│     │                     │ process(1) ████████████         │
│  💤 suspended             │                                  │
│  💤 waiting...            │                                  │
│  💤 waiting...            │ done!                            │
│     │◀────────────────────│                                  │
│  emit(2)─────────────────▶│                                  │
│     │                     │ process(2) ████████████         │
│  💤 suspended             │                                  │
│     │                     │                                  │
│                                                              │
│  ═══════════════════════════════════════════════════════════ │
│  Pros: ✅ No data loss, ✅ Memory bounded                    │
│  Cons: ❌ Producer throttled, ❌ Slow throughput             │
│  ═══════════════════════════════════════════════════════════ │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. buffer() - Decoupling Producer and Consumer

### 3.1 How It Works

`buffer()` creates a **channel** between producer and consumer, allowing them to run concurrently.

```kotlin
flow {
    repeat(1000) { i ->
        emit(i)  // Doesn't wait for consumer (until buffer full)
    }
}
.buffer(capacity = 64)  // Buffer up to 64 items
.collect { value ->
    delay(100)
    process(value)
}
```

### 3.2 Buffer Strategies

| Strategy | Behavior |
|----------|----------|
| `buffer()` | Default buffer, suspend when full |
| `buffer(64)` | Specific capacity |
| `buffer(UNLIMITED)` | Never suspend (⚠️ OOM risk!) |
| `buffer(CONFLATED)` | Keep only latest |
| `buffer(onBufferOverflow = DROP_OLDEST)` | Drop oldest when full |
| `buffer(onBufferOverflow = DROP_LATEST)` | Drop newest when full |

### 3.3 Visualization

```
┌─────────────────────────────────────────────────────────────┐
│           BUFFERED BACKPRESSURE                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Producer       BUFFER (64)           Consumer               │
│     │           ┌───────────┐            │                  │
│  emit(1)───────▶│ 1         │───────────▶│ process(1)      │
│  emit(2)───────▶│ 1 2       │            │ ████████        │
│  emit(3)───────▶│ 1 2 3     │            │                  │
│  emit(4)───────▶│ 1 2 3 4   │            │                  │
│  emit(5)───────▶│ 1 2 3 4 5 │            │                  │
│     │           │   ↓       │            │ done!            │
│  (continues)    │ 2 3 4 5   │───────────▶│ process(2)      │
│     │           └───────────┘            │ ████████        │
│                                                              │
│  ═══════════════════════════════════════════════════════════ │
│  Buffer fill: [████████░░░░░░░░░░░░░░░░░░░░░░░░] 25%        │
│  ═══════════════════════════════════════════════════════════ │
│                                                              │
│  Pros: ✅ Producer not blocked, ✅ Higher throughput         │
│  Cons: ❌ Memory usage, ❌ Still suspends when full          │
│  ═══════════════════════════════════════════════════════════ │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 3.4 Buffer Overflow Strategies

```
┌─────────────────────────────────────────────────────────────┐
│           BUFFER OVERFLOW HANDLING                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  SUSPEND (default)       DROP_OLDEST          DROP_LATEST   │
│  ─────────────────       ───────────          ───────────   │
│                                                              │
│  Buffer: [1,2,3,4] FULL  Buffer: [1,2,3,4]   Buffer: [1,2,3,4]
│                                                              │
│  emit(5)                 emit(5)              emit(5)        │
│     │                       │                    │           │
│     ▼                       ▼                    ▼           │
│  💤 SUSPEND              [2,3,4,5]           [1,2,3,4]      │
│  (wait for space)        (1 dropped)         (5 dropped)    │
│                                                              │
│  Use when:               Use when:            Use when:      │
│  - All data matters      - Latest matters     - Processing   │
│  - Can slow producer     - Sensor data        - must complete│
│                          - Stock prices       - Events       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. conflate() - Keep Only Latest

### 4.1 How It Works

`conflate()` keeps **only the most recent emission** when the consumer is busy. Older emissions are dropped.

```kotlin
flow {
    repeat(1000) { i ->
        emit(i)
    }
}
.conflate()  // Only latest value kept
.collect { value ->
    delay(100)
    process(value)  // May skip values!
}
```

### 4.2 Visualization

```
┌─────────────────────────────────────────────────────────────┐
│           CONFLATE BACKPRESSURE                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Producer         CONFLATE           Consumer                │
│     │             ┌─────┐               │                   │
│  emit(1)─────────▶│  1  │──────────────▶│ process(1)       │
│  emit(2)─────────▶│  2  │ (overwrites!) │ ████████████     │
│  emit(3)─────────▶│  3  │ (overwrites!) │                   │
│  emit(4)─────────▶│  4  │ (overwrites!) │                   │
│  emit(5)─────────▶│  5  │ (overwrites!) │                   │
│     │             │     │               │ done!             │
│                   │  5  │──────────────▶│ process(5)       │
│     │             └─────┘               │ (skipped 2,3,4!) │
│                                                              │
│  ═══════════════════════════════════════════════════════════ │
│  Emitted: 1000    Processed: ~10    Dropped: ~990           │
│  ═══════════════════════════════════════════════════════════ │
│                                                              │
│  Pros: ✅ Never blocks, ✅ Always latest value               │
│  Cons: ❌ Data loss, ❌ Not for important events             │
│  ═══════════════════════════════════════════════════════════ │
│                                                              │
│  Best for: Sensor readings, UI state, Progress updates      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. collectLatest() - Cancel Slow Processing

### 5.1 How It Works

`collectLatest()` **cancels** the current processing when a new value arrives, and starts processing the new value.

```kotlin
flow {
    emit(1)
    delay(50)
    emit(2)
    delay(50)
    emit(3)
}
.collectLatest { value ->
    println("Processing $value")
    delay(100)  // Takes longer than emission interval!
    println("Completed $value")  // May never print for 1, 2!
}
```

### 5.2 Visualization

```
┌─────────────────────────────────────────────────────────────┐
│           collectLatest() BACKPRESSURE                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Time  0ms      50ms     100ms    150ms    200ms    250ms   │
│  │      │        │        │        │        │        │      │
│                                                              │
│  Producer:                                                   │
│  ────────▶ emit(1)                                          │
│                  ─────────▶ emit(2)                         │
│                                    ─────────▶ emit(3)       │
│                                                              │
│  Consumer:                                                   │
│  ────────▶ start(1)                                         │
│            ██████│                                           │
│                  │ ❌ CANCELLED!                             │
│                  │                                           │
│                  ─────────▶ start(2)                        │
│                             ██████│                          │
│                                    │ ❌ CANCELLED!           │
│                                    │                         │
│                                    ─────────▶ start(3)      │
│                                               ██████████████│
│                                                          ✅ │
│                                                    COMPLETED│
│                                                              │
│  ═══════════════════════════════════════════════════════════ │
│  Values: 1 ❌ cancelled, 2 ❌ cancelled, 3 ✅ completed      │
│  ═══════════════════════════════════════════════════════════ │
│                                                              │
│  Pros: ✅ Always processes latest, ✅ Responsive            │
│  Cons: ❌ Work wasted on cancellation                       │
│  ═══════════════════════════════════════════════════════════ │
│                                                              │
│  Best for: Search autocomplete, Live preview                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 5.3 collectLatest vs conflate

```
┌─────────────────────────────────────────────────────────────┐
│       conflate() vs collectLatest()                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  conflate():                                                 │
│  ─────────────────────────────────────────────────────────  │
│  - Consumer finishes current processing                      │
│  - Then gets latest value (middle values dropped)            │
│  - Processing is NEVER cancelled                             │
│                                                              │
│  Emits: 1, 2, 3, 4, 5                                       │
│  Process: [start 1]...[done 1][start 5]...[done 5]          │
│           (2,3,4 dropped while processing 1)                 │
│                                                              │
│  ─────────────────────────────────────────────────────────  │
│                                                              │
│  collectLatest():                                            │
│  ─────────────────────────────────────────────────────────  │
│  - Consumer CANCELLED when new value arrives                 │
│  - Immediately starts processing new value                   │
│  - Processing CAN be cancelled mid-way                       │
│                                                              │
│  Emits: 1, 2, 3, 4, 5                                       │
│  Process: [start 1]❌[start 2]❌[start 3]❌[start 4]❌[5]✅  │
│           (each cancelled by next emission)                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. Time-Based Strategies

### 6.1 debounce() - Wait for Silence

Only emit after a **quiet period** with no new emissions.

```kotlin
searchQuery
    .debounce(300)  // Wait 300ms of no typing
    .collect { query ->
        searchApi(query)  // Only called when user stops typing
    }
```

```
┌─────────────────────────────────────────────────────────────┐
│           debounce(300ms)                                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  User typing: "kotlin coroutines"                           │
│                                                              │
│  Time ───────────────────────────────────────────────────▶  │
│                                                              │
│  Input:  k─o─t─l─i─n─ ─c─o─r─o─u─t─i─n─e─s─────────        │
│          │ │ │ │ │ │ │ │ │ │ │ │ │ │ │ │ │                  │
│                                                              │
│  Timer:  [==]                                                │
│             [==]                                             │
│                [==]                                          │
│                   [==]  (resets each keystroke)             │
│                                          ...                 │
│                                              [============]  │
│                                              300ms of silence│
│                                                          │   │
│                                                          ▼   │
│  Output:                                            "kotlin coroutines"
│                                                              │
│  Best for: Search input, Window resize, Form validation     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 sample() - Periodic Sampling

Emit **latest value** at fixed intervals.

```kotlin
sensorData
    .sample(1000)  // Sample every second
    .collect { reading ->
        updateDashboard(reading)
    }
```

```
┌─────────────────────────────────────────────────────────────┐
│           sample(1000ms)                                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Time: 0     500    1000   1500   2000   2500   3000        │
│        │      │      │      │      │      │      │          │
│                                                              │
│  Input (sensor at 100hz):                                   │
│        ││││││││││││││││││││││││││││││││││││││││││││││││││││  │
│         1 2 3 4 5 6 7 8 9...                                │
│                                                              │
│  Sample window:                                              │
│        [──────────]      [──────────]      [──────────]     │
│                   │               │               │          │
│                   ▼               ▼               ▼          │
│  Output:          10             20              30          │
│        (latest in window) (latest)        (latest)          │
│                                                              │
│  Best for: Sensor dashboards, Real-time charts, Monitoring  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 6.3 Comparison

| Operator | Behavior | Use Case |
|----------|----------|----------|
| `debounce(ms)` | Wait for silence | User input |
| `sample(ms)` | Periodic latest | Sensor data |
| `throttleFirst(ms)` | First in window | Button clicks |
| `throttleLatest(ms)` | Latest in window | Progress updates |

---

## 7. Events to Track

### 7.1 Backpressure Events

```kotlin
sealed class BackpressureEvent : VizEvent() {
    
    data class BufferCreated(
        val bufferId: String,
        val capacity: Int,
        val overflowStrategy: String,
        val flowId: String
    ) : BackpressureEvent()
    
    data class BufferStateChanged(
        val bufferId: String,
        val size: Int,
        val capacity: Int,
        val utilizationPercent: Int
    ) : BackpressureEvent()
    
    data class EmissionQueued(
        val bufferId: String,
        val value: String,
        val queuePosition: Int,
        val bufferSize: Int
    ) : BackpressureEvent()
    
    data class EmissionDropped(
        val bufferId: String,
        val value: String,
        val reason: String,  // "buffer_full", "conflated", "cancelled"
        val droppedCount: Long
    ) : BackpressureEvent()
    
    data class ProducerSuspended(
        val flowId: String,
        val reason: String,  // "buffer_full", "consumer_slow"
        val suspendedAtMs: Long
    ) : BackpressureEvent()
    
    data class ProducerResumed(
        val flowId: String,
        val suspendDurationMs: Long
    ) : BackpressureEvent()
    
    data class CollectionCancelled(
        val flowId: String,
        val reason: String,  // "collectLatest_new_value"
        val valueBeingProcessed: String,
        val newValue: String
    ) : BackpressureEvent()
}
```

---

## 8. Visualization Design

### 8.1 Backpressure Dashboard

```
┌─────────────────────────────────────────────────────────────┐
│           BACKPRESSURE MONITOR                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Flow: "sensor-data"    Strategy: buffer(64, DROP_OLDEST)   │
│                                                              │
│  ═══════════════════════════════════════════════════════════ │
│                    THROUGHPUT                                │
│  ═══════════════════════════════════════════════════════════ │
│                                                              │
│  Producer: ████████████████████████████████  120 items/sec  │
│  Consumer: ██████████                         40 items/sec  │
│                                                              │
│  Ratio: 3:1 (producer 3x faster)  ⚠️ BACKPRESSURE DETECTED  │
│                                                              │
│  ═══════════════════════════════════════════════════════════ │
│                    BUFFER STATUS                             │
│  ═══════════════════════════════════════════════════════════ │
│                                                              │
│  [████████████████████████████████████████████░░░░░░░░░░░░] │
│   45/64 (70%)                                                │
│                                                              │
│  Fill rate: +80 items/sec                                   │
│  Drain rate: -40 items/sec                                  │
│  Net: +40 items/sec (⚠️ buffer will fill in 0.5s)          │
│                                                              │
│  ═══════════════════════════════════════════════════════════ │
│                    DROPPED VALUES                            │
│  ═══════════════════════════════════════════════════════════ │
│                                                              │
│  Total dropped: 1,247                                       │
│  Drop rate: 80/sec                                          │
│  Last dropped: value=42.5, reason=buffer_full               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 8.2 Strategy Comparison View

```
┌─────────────────────────────────────────────────────────────┐
│           STRATEGY COMPARISON                                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Same flow with different strategies:                        │
│                                                              │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐   │
│  │    DEFAULT    │  │    BUFFER     │  │   CONFLATE    │   │
│  ├───────────────┤  ├───────────────┤  ├───────────────┤   │
│  │               │  │               │  │               │   │
│  │ Processed:100 │  │ Processed:100 │  │ Processed: 10 │   │
│  │ Dropped:    0 │  │ Dropped:    0 │  │ Dropped:   90 │   │
│  │ Time:   10.0s │  │ Time:    3.2s │  │ Time:    1.0s │   │
│  │               │  │               │  │               │   │
│  │ 💤 Slow       │  │ ⚡ Fast       │  │ 🚀 Fastest    │   │
│  │               │  │               │  │               │   │
│  └───────────────┘  └───────────────┘  └───────────────┘   │
│                                                              │
│  ┌───────────────┐  ┌───────────────┐                      │
│  │collectLatest()│  │  debounce()   │                      │
│  ├───────────────┤  ├───────────────┤                      │
│  │               │  │               │                      │
│  │ Started:  100 │  │ Emitted: 100  │                      │
│  │ Completed:  1 │  │ Output:    5  │                      │
│  │ Cancelled: 99 │  │ Time:    2.5s │                      │
│  │               │  │               │                      │
│  │ 🎯 Responsive │  │ ⏱ Batched    │                      │
│  │               │  │               │                      │
│  └───────────────┘  └───────────────┘                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 9. Test Scenarios

### 9.1 Compare All Strategies

```kotlin
@Test
fun `compare backpressure strategies`() = runTest {
    suspend fun fastProducer() = flow {
        repeat(100) {
            emit(it)
            delay(10)  // 100 items/sec
        }
    }
    
    suspend fun slowConsumer(value: Int) {
        delay(100)  // 10 items/sec
    }
    
    // Test each strategy
    val results = mutableMapOf<String, Stats>()
    
    // Default
    results["default"] = measureStrategy {
        fastProducer().collect { slowConsumer(it) }
    }
    
    // Buffer
    results["buffer"] = measureStrategy {
        fastProducer().buffer(64).collect { slowConsumer(it) }
    }
    
    // Conflate
    results["conflate"] = measureStrategy {
        fastProducer().conflate().collect { slowConsumer(it) }
    }
    
    // collectLatest
    results["collectLatest"] = measureStrategy {
        fastProducer().collectLatest { slowConsumer(it) }
    }
    
    // Compare results
    results.forEach { (name, stats) ->
        println("$name: processed=${stats.processed}, dropped=${stats.dropped}, time=${stats.timeMs}")
    }
}
```

---

## 10. Summary

### Strategy Decision Tree

```
                    START
                      │
         ┌────────────┴────────────┐
         │ Do you need ALL data?   │
         └────────────┬────────────┘
              Yes     │     No
               │      │      │
               ▼      │      ▼
         ┌─────────┐  │  ┌─────────────────────┐
         │ buffer()│  │  │ Is LATEST important?│
         └─────────┘  │  └──────────┬──────────┘
                      │       Yes   │    No
                      │        │    │     │
                      │        ▼    │     ▼
                      │  ┌──────────┴┐  ┌──────────┐
                      │  │conflate() │  │sample()  │
                      │  └───────────┘  └──────────┘
                      │
         ┌────────────┴────────────┐
         │ Should cancel slow work?│
         └────────────┬────────────┘
               Yes    │    No
                │     │     │
                ▼     │     ▼
         ┌───────────┐│ ┌───────────┐
         │collectLat-││ │ buffer()  │
         │   est()   ││ │ or default│
         └───────────┘│ └───────────┘
                      │
         ┌────────────┴────────────┐
         │ User input (typing)?    │
         └────────────┬────────────┘
               Yes    │
                │     │
                ▼     │
         ┌───────────┐│
         │debounce() ││
         └───────────┘│
```

### Quick Reference

| Strategy | Data Loss | Producer Blocked | Use Case |
|----------|-----------|------------------|----------|
| default | ❌ No | ✅ Yes | All data matters |
| buffer(n) | ❌ No* | ⚠️ When full | Higher throughput |
| conflate() | ✅ Yes | ❌ No | Latest value only |
| collectLatest() | ✅ Yes | ❌ No | Cancel slow work |
| debounce(ms) | ✅ Yes | ❌ No | User input |
| sample(ms) | ✅ Yes | ❌ No | Periodic updates |

*Unless DROP_OLDEST/DROP_LATEST overflow strategy

---

**End of Document**

