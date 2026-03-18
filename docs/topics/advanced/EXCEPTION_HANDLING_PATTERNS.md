# Exception Handling Patterns in Coroutines

**Version:** 1.0  
**Date:** December 2025  
**Status:** Design Document

---

## Executive Summary

Exception handling in coroutines is **fundamentally different** from traditional try-catch due to structured concurrency. This document covers all exception patterns with visualizations showing propagation paths.

**Key Concepts:**
- Exception propagation in hierarchy
- CancellationException special handling
- CoroutineExceptionHandler
- SupervisorJob isolation
- Exception aggregation

---

## 1. Exception Propagation Rules

### 1.1 The Core Rule

> When a child coroutine fails, it **cancels its parent**, which then **cancels all siblings**.

```
                    ┌──────────┐
                    │  Parent  │
                    │   Job    │
                    └────┬─────┘
            ┌───────────┼───────────┐
            │           │           │
       ┌────▼────┐ ┌────▼────┐ ┌────▼────┐
       │ Child 1 │ │ Child 2 │ │ Child 3 │
       │   OK    │ │  FAIL!  │ │   OK    │
       └─────────┘ └────┬────┘ └─────────┘
                        │
                        │ Exception thrown!
                        ▼
       ┌─────────────────────────────────┐
       │ 1. Child 2 fails                │
       │ 2. Parent receives exception    │
       │ 3. Parent cancels Child 1 & 3   │
       │ 4. Parent fails with exception  │
       └─────────────────────────────────┘
```

### 1.2 Code Example

```kotlin
// ❌ All children cancelled when one fails
coroutineScope {
    launch { 
        delay(1000)
        println("Child 1 - never prints!") 
    }
    launch { 
        delay(100)
        throw RuntimeException("Boom!") 
    }
    launch { 
        delay(500)
        println("Child 3 - never prints!") 
    }
}
// CoroutineScope fails, exception propagates up
```

---

## 2. CancellationException - The Special One

### 2.1 Why It's Special

`CancellationException` is **normal completion**, not failure:
- Does NOT propagate to parent as failure
- Does NOT trigger sibling cancellation
- Parent waits for children, doesn't fail
- Must be re-thrown when caught!

```kotlin
// ❌ WRONG - Swallowing CancellationException
launch {
    try {
        suspendingWork()
    } catch (e: Exception) {
        log(e)  // Also catches CancellationException!
    }
}

// ✅ RIGHT - Re-throw CancellationException
launch {
    try {
        suspendingWork()
    } catch (e: CancellationException) {
        throw e  // Must re-throw!
    } catch (e: Exception) {
        handleError(e)
    }
}

// ✅ BEST - Use ensureActive or check isActive
launch {
    while (isActive) {
        work()
    }
}
```

### 2.2 Visualization

```
┌─────────────────────────────────────────────────────────────┐
│           CANCELLATION vs FAILURE                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  CANCELLATION (CancellationException)                       │
│  ─────────────────────────────────────                      │
│                                                              │
│       Parent                                                 │
│         │                                                    │
│    ┌────┴────┐                                              │
│    │         │                                               │
│  Child1   Child2                                             │
│  (cancel)   │                                                │
│      │      │                                                │
│      ▼      │                                                │
│  🟡 CANCELLED  ✅ CONTINUES                                  │
│                                                              │
│  → Parent NOT affected                                       │
│  → Siblings NOT affected                                     │
│  → Normal completion path                                    │
│                                                              │
│  ════════════════════════════════════════════════════════   │
│                                                              │
│  FAILURE (RuntimeException, etc.)                           │
│  ────────────────────────────────                           │
│                                                              │
│       Parent                                                 │
│         │                                                    │
│    ┌────┴────┐                                              │
│    │         │                                               │
│  Child1   Child2                                             │
│  (throws)    │                                               │
│      │       │                                               │
│      ▼       ▼                                               │
│  🔴 FAILED  🟡 CANCELLED                                     │
│      │                                                       │
│      └────▶ Parent 🔴 CANCELLED                             │
│                                                              │
│  → Parent IS affected (cancels)                             │
│  → Siblings ARE cancelled                                   │
│  → Exception propagates up                                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. CoroutineExceptionHandler

### 3.1 What It Does

A **global handler** for uncaught exceptions in root coroutines. Like Thread.uncaughtExceptionHandler but for coroutines.

```kotlin
val handler = CoroutineExceptionHandler { context, exception ->
    println("Caught: $exception")
    // Log, report to crash analytics, etc.
}

// Only works on ROOT coroutines launched with launch
GlobalScope.launch(handler) {
    throw RuntimeException("Uncaught!")
}  // Handler receives exception

// Does NOT work with async (returns exception in Deferred)
GlobalScope.async(handler) {
    throw RuntimeException("Won't reach handler!")
}.await()  // Exception thrown at await()
```

### 3.2 Rules

| Scenario | Handler Called? |
|----------|-----------------|
| Root `launch` | ✅ Yes |
| Child `launch` | ❌ No (propagates to parent) |
| `async` anywhere | ❌ No (exception in Deferred) |
| `coroutineScope` | ❌ No (rethrows) |
| `supervisorScope` + child `launch` | ✅ Yes |

### 3.3 Events to Track

```kotlin
sealed class ExceptionHandlingEvent : VizEvent() {
    
    data class ExceptionThrown(
        val coroutineId: String,
        val exceptionType: String,
        val message: String,
        val stackTrace: String,
        val isCancellation: Boolean
    ) : ExceptionHandlingEvent()
    
    data class ExceptionPropagating(
        val exceptionId: String,
        val fromCoroutineId: String,
        val toCoroutineId: String,
        val willCancelTarget: Boolean
    ) : ExceptionHandlingEvent()
    
    data class ExceptionHandledBy(
        val exceptionId: String,
        val handlerType: String,  // "CoroutineExceptionHandler", "tryCatch", "supervisor"
        val handlerId: String,
        val wasRethrown: Boolean
    ) : ExceptionHandlingEvent()
    
    data class SiblingsCancelled(
        val causingCoroutineId: String,
        val cancelledSiblings: List<String>,
        val exceptionType: String
    ) : ExceptionHandlingEvent()
    
    data class ExceptionAggregated(
        val parentExceptionId: String,
        val suppressedExceptions: List<String>,
        val totalExceptions: Int
    ) : ExceptionHandlingEvent()
}
```

---

## 4. SupervisorJob - Failure Isolation

### 4.1 How It Works

`SupervisorJob` breaks the propagation rule - child failures don't affect parent or siblings.

```kotlin
// Regular Job - one failure kills all
val normalScope = CoroutineScope(Job())
normalScope.launch { /* fails */ }  // Cancels scope!

// SupervisorJob - failures isolated
val supervisorScope = CoroutineScope(SupervisorJob())
supervisorScope.launch { throw Exception() }  // Only this child fails
supervisorScope.launch { delay(1000); println("I continue!") }  // Runs fine!
```

### 4.2 Visualization

```
┌─────────────────────────────────────────────────────────────┐
│           REGULAR JOB vs SUPERVISOR JOB                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  REGULAR JOB                      SUPERVISOR JOB            │
│  ────────────                     ──────────────            │
│                                                              │
│       ┌───────┐                        ┌───────┐            │
│       │ Scope │                        │ Scope │            │
│       │  Job  │                        │ Super │            │
│       └───┬───┘                        └───┬───┘            │
│      ┌────┼────┐                      ┌────┼────┐           │
│      │    │    │                      │    │    │           │
│      ▼    ▼    ▼                      ▼    ▼    ▼           │
│     C1   C2   C3                     C1   C2   C3           │
│     🟢   🔴   🟢                     🟢   🔴   🟢           │
│      │    │    │                           │                │
│      │ FAIL│    │                        FAIL               │
│      │    │    │                           │                │
│      ▼    ▼    ▼                           ▼                │
│     🟡   🔴   🟡                     🟢   🔴   🟢           │
│   CANCEL FAIL CANCEL               RUNS  FAIL  RUNS         │
│      │                                                       │
│      ▼                                                       │
│   SCOPE                            SCOPE                     │
│   🟡 CANCELLED                     🟢 CONTINUES             │
│                                                              │
│  Exception propagates UP           Exception stays DOWN     │
│                                    (need handler!)          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 4.3 supervisorScope vs coroutineScope

```kotlin
// coroutineScope - any child failure fails the scope
suspend fun processAll() = coroutineScope {
    launch { api1.fetch() }  // If fails, everything fails
    launch { api2.fetch() }
}

// supervisorScope - children are isolated
suspend fun processAllSafe() = supervisorScope {
    launch { api1.fetch() }  // If fails, only this child fails
    launch { api2.fetch() }  // Continues running
}
```

---

## 5. Exception Aggregation

### 5.1 Multiple Children Failing

When multiple children fail, exceptions are **aggregated** using `suppressed` exceptions.

```kotlin
supervisorScope {
    launch { throw Exception("Error 1") }
    launch { throw Exception("Error 2") }
    launch { throw Exception("Error 3") }
}

// Result (conceptual):
// Exception("Error 1")
//   suppressed: [Exception("Error 2"), Exception("Error 3")]
```

### 5.2 Visualization

```
┌─────────────────────────────────────────────────────────────┐
│           EXCEPTION AGGREGATION                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Multiple failures in supervisor:                            │
│                                                              │
│     ┌────────┐   ┌────────┐   ┌────────┐                   │
│     │ Task 1 │   │ Task 2 │   │ Task 3 │                   │
│     │  🔴    │   │  🔴    │   │  🔴    │                   │
│     └────┬───┘   └────┬───┘   └────┬───┘                   │
│          │            │            │                         │
│          ▼            ▼            ▼                         │
│     IOException   TimeoutEx    NPE                          │
│          │            │            │                         │
│          └────────────┼────────────┘                        │
│                       │                                      │
│                       ▼                                      │
│          ┌─────────────────────────┐                        │
│          │  Aggregated Exception   │                        │
│          ├─────────────────────────┤                        │
│          │ Primary: IOException    │                        │
│          │ Suppressed:             │                        │
│          │   - TimeoutException    │                        │
│          │   - NullPointerException│                        │
│          └─────────────────────────┘                        │
│                                                              │
│  Access with: exception.suppressed                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. Patterns & Best Practices

### 6.1 Pattern: Safe Launch with Handler

```kotlin
fun CoroutineScope.safeLaunch(
    block: suspend CoroutineScope.() -> Unit
): Job = launch {
    try {
        block()
    } catch (e: CancellationException) {
        throw e  // Don't swallow!
    } catch (e: Exception) {
        // Log, report, handle
        logError(e)
    }
}
```

### 6.2 Pattern: Result Wrapper

```kotlin
sealed class Result<out T> {
    data class Success<T>(val value: T) : Result<T>()
    data class Error(val exception: Exception) : Result<Nothing>()
}

suspend fun <T> safeCall(block: suspend () -> T): Result<T> {
    return try {
        Result.Success(block())
    } catch (e: CancellationException) {
        throw e  // Always re-throw!
    } catch (e: Exception) {
        Result.Error(e)
    }
}

// Usage
val result = safeCall { api.fetchUser(id) }
when (result) {
    is Result.Success -> showUser(result.value)
    is Result.Error -> showError(result.exception)
}
```

### 6.3 Pattern: Retry with Exception Filtering

```kotlin
suspend fun <T> retryOnSpecificErrors(
    times: Int = 3,
    retryOn: (Exception) -> Boolean,
    block: suspend () -> T
): T {
    var lastException: Exception? = null
    repeat(times) {
        try {
            return block()
        } catch (e: CancellationException) {
            throw e  // Never retry cancellation!
        } catch (e: Exception) {
            if (!retryOn(e)) throw e  // Don't retry this type
            lastException = e
        }
    }
    throw lastException!!
}

// Usage
retryOnSpecificErrors(
    times = 3,
    retryOn = { it is IOException }  // Only retry IO errors
) {
    api.fetchData()
}
```

### 6.4 Pattern: Parallel with Independent Failures

```kotlin
suspend fun fetchAllIndependent(ids: List<String>): List<Result<Data>> {
    return supervisorScope {
        ids.map { id ->
            async {
                safeCall { api.fetch(id) }
            }
        }.awaitAll()
    }
}
// Returns list of Success/Error, doesn't fail if some fail
```

---

## 7. Test Scenarios

### 7.1 Basic Exception Propagation

```kotlin
@Test
fun `exception propagates up and cancels siblings`() = runTest {
    var child1Cancelled = false
    var child3Cancelled = false
    
    assertFailsWith<RuntimeException> {
        vizCoroutineScope("parent") {
            vizLaunch("child-1") {
                try {
                    vizDelay(5000)
                } catch (e: CancellationException) {
                    child1Cancelled = true
                    throw e
                }
            }
            
            vizLaunch("child-2") {
                vizDelay(100)
                throw RuntimeException("Boom!")
            }
            
            vizLaunch("child-3") {
                try {
                    vizDelay(5000)
                } catch (e: CancellationException) {
                    child3Cancelled = true
                    throw e
                }
            }
        }
    }
    
    assertTrue(child1Cancelled)
    assertTrue(child3Cancelled)
}
```

**Expected Visualization:**
1. Child-2 throws exception
2. Parent receives exception
3. Parent cancels child-1 and child-3
4. Exception propagates from parent

### 7.2 SupervisorScope Isolation

```kotlin
@Test
fun `supervisor isolates failures`() = runTest {
    var child1Completed = false
    var child3Completed = false
    
    vizSupervisorScope("supervisor") {
        vizLaunch("child-1") {
            vizDelay(200)
            child1Completed = true
        }
        
        vizLaunch("child-2") {
            vizDelay(100)
            throw RuntimeException("Boom!")
        }
        
        vizLaunch("child-3") {
            vizDelay(300)
            child3Completed = true
        }
    }
    
    assertTrue(child1Completed)
    assertTrue(child3Completed)
}
```

### 7.3 CancellationException Re-throw

```kotlin
@Test
fun `cancellation exception must be rethrown`() = runTest {
    val job = vizLaunch("worker") {
        try {
            vizDelay(10000)
        } catch (e: Exception) {
            // ❌ WRONG - swallows CancellationException
            println("Caught: $e")
        }
        // This runs even after cancellation!
        doSomething()
    }
    
    vizDelay(100)
    job.cancel()
    job.join()
    
    // Should have detected anti-pattern!
    val warnings = recorder.ofKind("CancellationExceptionCaught")
    assertTrue(warnings.isNotEmpty())
}
```

---

## 8. Visualization Components

### 8.1 Exception Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│           EXCEPTION FLOW                                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                    SCOPE                              │   │
│  │                      │                                │   │
│  │          ┌───────────┼───────────┐                   │   │
│  │          │           │           │                    │   │
│  │     ┌────▼────┐ ┌────▼────┐ ┌────▼────┐              │   │
│  │     │ Worker1 │ │ Worker2 │ │ Worker3 │              │   │
│  │     │   🟢    │ │   🔴    │ │   🟢    │              │   │
│  │     └─────────┘ └────┬────┘ └─────────┘              │   │
│  │                      │                                │   │
│  │              RuntimeException                         │   │
│  │              "Database error"                         │   │
│  │                      │                                │   │
│  └──────────────────────┼───────────────────────────────┘   │
│                         │                                    │
│    ┌────────────────────▼────────────────────┐              │
│    │         PROPAGATION PATH                 │              │
│    │                                          │              │
│    │  1. Worker2 throws                       │              │
│    │     └─▶ 2. Scope receives                │              │
│    │          └─▶ 3. Worker1 cancelled        │              │
│    │          └─▶ 4. Worker3 cancelled        │              │
│    │          └─▶ 5. Scope fails              │              │
│    │               └─▶ 6. Handler invoked     │              │
│    │                                          │              │
│    └──────────────────────────────────────────┘              │
│                                                              │
│  Exception: RuntimeException                                 │
│  Message: "Database error"                                   │
│  Origin: Worker2                                             │
│  Affected: Worker1, Worker3, Scope                          │
│  Handler: CoroutineExceptionHandler (logged)                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 8.2 TypeScript Component

```typescript
interface ExceptionFlowState {
  exceptionId: string;
  type: string;
  message: string;
  originCoroutine: string;
  propagationPath: PropagationStep[];
  affectedCoroutines: string[];
  handler: HandlerInfo | null;
  isCancellation: boolean;
}

interface PropagationStep {
  from: string;
  to: string;
  action: 'throw' | 'propagate' | 'cancel' | 'handle';
  timestamp: number;
}

const ExceptionFlowVisualization: React.FC<{ flow: ExceptionFlowState }> = ({ flow }) => {
  return (
    <Card className={flow.isCancellation ? 'border-yellow-500' : 'border-red-500'}>
      <CardHeader>
        <AlertTriangle className={flow.isCancellation ? 'text-yellow-500' : 'text-red-500'} />
        <span>{flow.type}</span>
        {flow.isCancellation && <Badge>Cancellation</Badge>}
      </CardHeader>
      
      <CardContent>
        <div className="exception-details">
          <p><strong>Message:</strong> {flow.message}</p>
          <p><strong>Origin:</strong> {flow.originCoroutine}</p>
        </div>
        
        <div className="propagation-path">
          <h4>Propagation Path</h4>
          {flow.propagationPath.map((step, i) => (
            <PropagationStepView key={i} step={step} />
          ))}
        </div>
        
        <div className="affected-coroutines">
          <h4>Affected Coroutines ({flow.affectedCoroutines.length})</h4>
          <CoroutineList coroutines={flow.affectedCoroutines} />
        </div>
        
        {flow.handler && (
          <div className="handler-info">
            <h4>Handled By</h4>
            <HandlerBadge handler={flow.handler} />
          </div>
        )}
      </CardContent>
    </Card>
  );
};
```

---

## 9. Summary

### Exception Handling Rules

| Scenario | Behavior |
|----------|----------|
| Child throws exception | Parent cancelled, siblings cancelled |
| Child throws CancellationException | Only that child cancelled |
| SupervisorJob child throws | Only that child fails |
| async throws | Exception stored in Deferred |
| Exception in handler | Logged, not propagated |

### Best Practices

1. ✅ **Always re-throw CancellationException**
2. ✅ **Use SupervisorJob for independent tasks**
3. ✅ **Add CoroutineExceptionHandler for logging**
4. ✅ **Use Result wrapper for recoverable errors**
5. ❌ **Never catch Exception without checking for cancellation**
6. ❌ **Don't use try-catch for cancellation handling**

### Implementation Checklist

- [ ] Exception propagation visualization
- [ ] CancellationException detection
- [ ] Supervisor isolation animation
- [ ] Exception aggregation view
- [ ] Handler invocation tracking
- [ ] Anti-pattern detection
- [ ] Test scenarios

---

**End of Document**

