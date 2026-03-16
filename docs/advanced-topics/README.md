# Advanced Coroutine Topics for Visualizer

This directory contains detailed design documents for advanced coroutine concepts to be visualized in the Kotlin Coroutines Visualizer platform.

## 📚 Topics Overview

### Synchronization & Concurrency

| Document | Description | Complexity |
|----------|-------------|------------|
| [🔒 Mutex, Semaphore & Sync](./MUTEX_SEMAPHORE_SYNC.md) | Mutual exclusion, resource limiting, deadlock detection | ⭐⭐⭐ |
| [🎭 Actor Pattern](./ACTOR_PATTERN.md) | Message-passing concurrency, state encapsulation | ⭐⭐⭐⭐ |
| [🔄 Select Expression](./SELECT_EXPRESSION.md) | Multiplexing, racing operations, timeouts | ⭐⭐⭐⭐ |

### Error Handling & Safety

| Document | Description | Complexity |
|----------|-------------|------------|
| [⚠️ Exception Handling](./EXCEPTION_HANDLING_PATTERNS.md) | Propagation, CancellationException, SupervisorJob | ⭐⭐⭐ |
| [🚨 Performance Anti-Patterns](./PERFORMANCE_ANTIPATTERNS.md) | Thread starvation, memory leaks, blocking issues | ⭐⭐ |

### Data Flow & Backpressure

| Document | Description | Complexity |
|----------|-------------|------------|
| [💧 Backpressure Strategies](./BACKPRESSURE_STRATEGIES.md) | buffer, conflate, collectLatest, debounce | ⭐⭐⭐ |

### Production Patterns

| Document | Description | Complexity |
|----------|-------------|------------|
| [🌍 Real-World Patterns](./REAL_WORLD_PATTERNS.md) | Retry, rate limiting, circuit breaker, caching | ⭐⭐⭐ |

### Internals & Testing

| Document | Description | Complexity |
|----------|-------------|------------|
| [🔬 Coroutine Internals](./COROUTINE_INTERNALS.md) | State machines, continuations, how suspension works | ⭐⭐⭐⭐⭐ |
| [⏱️ Testing Virtual Time](./TESTING_VIRTUAL_TIME.md) | TestDispatcher, advanceTimeBy, deterministic tests | ⭐⭐⭐ |

---

## 🎯 Topic Details

### 🔒 Mutex, Semaphore & Synchronization
- Mutex with lock/unlock visualization
- Semaphore permit pool visualization  
- Wait queue tracking
- **Deadlock detection** with circular wait graphs
- 6 test scenarios

### 🎭 Actor Pattern
- Actor lifecycle events
- Message mailbox visualization
- Request-response pattern
- Actor pools and load balancing
- State machine actors

### 🌍 Real-World Patterns
- **Retry with exponential backoff** - attempt timeline
- **Rate limiting** - permit/throttle visualization
- **Debouncing** - input coalescing
- **Circuit breaker** - state machine (closed/open/half-open)
- **Parallel decomposition** - worker lanes
- **Repository caching** - hit/miss tracking

### ⚠️ Performance Anti-Patterns
- **Thread starvation** detection on Default/Main
- **Main thread blocking** - frame drop visualization
- **Memory leaks** - GlobalScope warnings
- **Excessive concurrency** - coroutine explosion alerts
- **Missing cancellation** - non-cooperative detection
- **runBlocking misuse** - context checking

### 🔄 Select Expression
- Select clause tracking (onReceive, onAwait, onTimeout)
- Race visualization with progress bars
- Channel multiplexing diagrams
- Biased vs unbiased selection

### ⚠️ Exception Handling Patterns
- Exception propagation visualization
- CancellationException special handling
- SupervisorJob isolation animation
- Exception aggregation view
- CoroutineExceptionHandler tracking

### 🔬 Coroutine Internals
- **State machine transformation** - how suspend functions compile
- **Continuation chain** - call stack visualization
- **Suspension points** - where and why code suspends
- **Resumption** - how coroutines continue
- Educational "demystifying coroutines"

### ⏱️ Testing Virtual Time
- Virtual clock visualization
- Task scheduler queue
- **advanceTimeBy** animation
- Deterministic test execution
- Time jump visualization

### 💧 Backpressure Strategies
- **Default** - suspend producer
- **buffer()** - decoupling with buffer
- **conflate()** - keep only latest
- **collectLatest()** - cancel slow work
- **debounce/sample** - time-based
- Strategy comparison view

---

## 📊 Implementation Priority Matrix

| Phase | Topics | Priority |
|-------|--------|----------|
| **Phase 3** | Mutex/Semaphore, Exception Handling, Anti-Patterns | 🔴 High |
| **Phase 4** | Actor Pattern, Select Expression, Real-World Patterns | 🟡 Medium |
| **Phase 5** | Coroutine Internals, Testing, Backpressure | 🟢 Later |

### Recommended Implementation Order

```
Phase 3 (High Educational Value, Medium Complexity):
├── 1. Exception Handling Patterns
├── 2. Performance Anti-Patterns (detection system)
├── 3. Mutex & Semaphore
└── 4. Backpressure Strategies

Phase 4 (Production Patterns):
├── 5. Real-World Patterns (Retry, Circuit Breaker)
├── 6. Actor Pattern
└── 7. Select Expression

Phase 5 (Deep Dive):
├── 8. Coroutine Internals (state machine viz)
└── 9. Testing Virtual Time
```

---

## 📁 File Summary

| File | Lines | Events | Test Scenarios |
|------|-------|--------|----------------|
| `MUTEX_SEMAPHORE_SYNC.md` | ~700 | 12 types | 6 |
| `ACTOR_PATTERN.md` | ~550 | 9 types | 5 |
| `REAL_WORLD_PATTERNS.md` | ~850 | 20+ types | 8 patterns |
| `PERFORMANCE_ANTIPATTERNS.md` | ~750 | 15 types | 8 anti-patterns |
| `SELECT_EXPRESSION.md` | ~550 | 6 types | 5 |
| `EXCEPTION_HANDLING_PATTERNS.md` | ~600 | 6 types | 4 |
| `COROUTINE_INTERNALS.md` | ~650 | 9 types | 4 |
| `TESTING_VIRTUAL_TIME.md` | ~550 | 7 types | 5 |
| `BACKPRESSURE_STRATEGIES.md` | ~600 | 7 types | 6 strategies |

**Total: ~5,800 lines of documentation**

---

## 🎓 Educational Impact

These topics address common developer questions:

| Question | Answered By |
|----------|-------------|
| "Why did my app freeze?" | Performance Anti-Patterns |
| "How do I prevent race conditions?" | Mutex/Semaphore |
| "Why did all my coroutines cancel?" | Exception Handling |
| "How do I handle API failures?" | Real-World Patterns |
| "How do coroutines actually work?" | Coroutine Internals |
| "How do I test delays without waiting?" | Testing Virtual Time |
| "My Flow is dropping values, why?" | Backpressure Strategies |
| "How do I manage complex state?" | Actor Pattern |

---

## 🚀 Getting Started

1. **For implementers**: Start with `PERFORMANCE_ANTIPATTERNS.md` - easy to implement, high value
2. **For educators**: Check `COROUTINE_INTERNALS.md` - deep understanding content
3. **For production code**: See `REAL_WORLD_PATTERNS.md` - practical patterns

Each document includes:
- ✅ Concept explanation with diagrams
- ✅ Event types to track
- ✅ ASCII visualization mockups
- ✅ Test scenarios with expected events
- ✅ Wrapper implementation code
- ✅ Frontend component designs

---

**Last Updated:** December 2025
**Total Documents:** 9
**Total Lines:** ~5,800
