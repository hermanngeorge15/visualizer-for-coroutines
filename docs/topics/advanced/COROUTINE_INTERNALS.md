# Coroutine Internals & State Machine Visualization

**Version:** 1.0  
**Date:** December 2025  
**Status:** Design Document

---

## Executive Summary

This document covers the **internal mechanics of how Kotlin coroutines work** - something rarely visualized but incredibly educational. Understanding the state machine transformation helps developers truly grasp suspension and resumption.

**Key Concepts:**
- Suspend function → State machine transformation
- Continuation passing style (CPS)
- How suspension points work
- Stack unwinding and restoration

---

## 1. The Magic Behind Suspend Functions

### 1.1 What Really Happens

When you write:
```kotlin
suspend fun fetchUserData(): User {
    val token = getToken()        // Suspension point 1
    val profile = getProfile(token)  // Suspension point 2
    return User(profile)
}
```

The compiler transforms it into a **state machine**:

```kotlin
// Simplified compiler output (conceptual)
class FetchUserDataStateMachine(
    completion: Continuation<User>
) : ContinuationImpl(completion) {
    
    var label = 0  // Current state
    var token: String? = null  // Local variables preserved across suspensions
    var result: Any? = null
    
    override fun invokeSuspend(result: Result<Any?>): Any? {
        this.result = result
        
        when (label) {
            0 -> {
                label = 1
                val suspendResult = getToken(this)  // Pass continuation
                if (suspendResult == COROUTINE_SUSPENDED) {
                    return COROUTINE_SUSPENDED  // Bail out!
                }
                token = suspendResult as String
            }
            1 -> {
                token = result.getOrThrow() as String
                label = 2
                val suspendResult = getProfile(token!!, this)
                if (suspendResult == COROUTINE_SUSPENDED) {
                    return COROUTINE_SUSPENDED
                }
            }
            2 -> {
                val profile = result.getOrThrow() as Profile
                return User(profile)  // Final result
            }
        }
        // Continue to next state...
    }
}
```

### 1.2 The State Machine Diagram

```
┌─────────────────────────────────────────────────────────────┐
│           SUSPEND FUNCTION STATE MACHINE                     │
│           "fetchUserData()"                                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐                                           │
│  │   STATE 0    │  Initial state                            │
│  │   (START)    │                                           │
│  └──────┬───────┘                                           │
│         │                                                    │
│         │ Call getToken()                                   │
│         │                                                    │
│         ▼                                                    │
│  ┌──────────────┐                                           │
│  │ SUSPENDED?   │───Yes──▶ 💤 Return COROUTINE_SUSPENDED    │
│  └──────┬───────┘          Stack unwound, waiting...        │
│         │ No                       │                        │
│         ▼                          │                        │
│  ┌──────────────┐                  │                        │
│  │   STATE 1    │◀─────────────────┘                        │
│  │ token ready  │  Resumed with token                       │
│  └──────┬───────┘                                           │
│         │                                                    │
│         │ Call getProfile(token)                            │
│         │                                                    │
│         ▼                                                    │
│  ┌──────────────┐                                           │
│  │ SUSPENDED?   │───Yes──▶ 💤 Return COROUTINE_SUSPENDED    │
│  └──────┬───────┘          Stack unwound, waiting...        │
│         │ No                       │                        │
│         ▼                          │                        │
│  ┌──────────────┐                  │                        │
│  │   STATE 2    │◀─────────────────┘                        │
│  │profile ready │  Resumed with profile                     │
│  └──────┬───────┘                                           │
│         │                                                    │
│         │ return User(profile)                              │
│         │                                                    │
│         ▼                                                    │
│  ┌──────────────┐                                           │
│  │  COMPLETED   │  Final result returned                    │
│  └──────────────┘                                           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Continuation - The Heart of Coroutines

### 2.1 What is a Continuation?

A **Continuation** represents "the rest of the computation" after a suspension point.

```kotlin
public interface Continuation<in T> {
    public val context: CoroutineContext
    public fun resumeWith(result: Result<T>)
}
```

Think of it as:
- A **callback** that knows how to resume
- Contains the **state machine** with saved local variables
- Has the **context** (dispatcher, job, etc.)

### 2.2 Visualization

```
┌─────────────────────────────────────────────────────────────┐
│                    CONTINUATION                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              COROUTINE CONTEXT                          ││
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       ││
│  │  │   Job   │ │Dispatch │ │  Name   │ │  User   │       ││
│  │  │ element │ │   er    │ │ element │ │ element │       ││
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘       ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              STATE MACHINE                               ││
│  │                                                          ││
│  │  label: 1  (currently at suspension point 1)            ││
│  │                                                          ││
│  │  Saved variables:                                        ││
│  │    - token: "abc123"                                     ││
│  │    - userId: 42                                          ││
│  │    - tempResult: null                                    ││
│  │                                                          ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              CALL STACK (saved)                          ││
│  │                                                          ││
│  │  → fetchUserData (state=1)                              ││
│  │    → loadProfile (state=0)                              ││
│  │                                                          ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  resumeWith(Result.success(profileData))                    │
│         │                                                    │
│         ▼                                                    │
│  [Continue execution from state 1]                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Events to Track

### 3.1 State Machine Events

```kotlin
sealed class StateMachineEvent : VizEvent() {
    
    data class SuspendFunctionEntered(
        val functionId: String,
        val functionName: String,
        val coroutineId: String,
        val totalStates: Int,
        val parameters: Map<String, String>
    ) : StateMachineEvent()
    
    data class StateTransition(
        val functionId: String,
        val fromState: Int,
        val toState: Int,
        val suspensionPoint: String?,  // e.g., "getToken()"
        val localVariables: Map<String, String>
    ) : StateMachineEvent()
    
    data class SuspensionOccurred(
        val functionId: String,
        val stateNumber: Int,
        val suspendingCall: String,
        val continuationSaved: Boolean,
        val stackDepth: Int
    ) : StateMachineEvent()
    
    data class ResumptionOccurred(
        val functionId: String,
        val stateNumber: Int,
        val resumedWith: String,  // "success" or "failure"
        val resultPreview: String?,
        val resumedBy: String  // "dispatcher", "callback", etc.
    ) : StateMachineEvent()
    
    data class SuspendFunctionCompleted(
        val functionId: String,
        val finalState: Int,
        val result: String?,
        val totalSuspensions: Int,
        val totalDurationNanos: Long
    ) : StateMachineEvent()
}
```

### 3.2 Continuation Events

```kotlin
sealed class ContinuationEvent : VizEvent() {
    
    data class ContinuationCreated(
        val continuationId: String,
        val forFunction: String,
        val coroutineId: String,
        val contextElements: List<String>
    ) : ContinuationEvent()
    
    data class ContinuationIntercepted(
        val continuationId: String,
        val interceptorName: String,  // Usually dispatcher name
        val wrappedContinuation: String
    ) : ContinuationEvent()
    
    data class ContinuationResumed(
        val continuationId: String,
        val resumedOn: String,  // Thread name
        val dispatcher: String,
        val result: String
    ) : ContinuationEvent()
    
    data class ContinuationStackTrace(
        val continuationId: String,
        val suspendedStack: List<StackFrame>
    ) : ContinuationEvent()
}

data class StackFrame(
    val functionName: String,
    val state: Int,
    val savedVariables: Map<String, String>
)
```

---

## 4. Visualization Design

### 4.1 State Machine Stepper

```
┌─────────────────────────────────────────────────────────────┐
│           STATE MACHINE: fetchUserData()                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  [◀ Prev] [▶ Next] [⏸ Pause] [🔄 Reset]    Speed: [███░░]   │
│                                                              │
│  ═══════════════════════════════════════════════════════════ │
│                    STATE DIAGRAM                             │
│  ═══════════════════════════════════════════════════════════ │
│                                                              │
│     ┌───────┐      ┌───────┐      ┌───────┐      ┌───────┐ │
│     │ S0    │─────▶│  S1   │─────▶│  S2   │─────▶│ DONE  │ │
│     │ START │      │●CURR● │      │       │      │       │ │
│     └───────┘      └───────┘      └───────┘      └───────┘ │
│                         │                                    │
│                    💤 SUSPENDED                              │
│                    waiting for getToken()                    │
│                                                              │
│  ═══════════════════════════════════════════════════════════ │
│                    LOCAL VARIABLES                           │
│  ═══════════════════════════════════════════════════════════ │
│                                                              │
│    token:   ░░░░░░░░░  (not yet assigned)                   │
│    profile: ░░░░░░░░░  (not yet assigned)                   │
│    userId:  42                                               │
│                                                              │
│  ═══════════════════════════════════════════════════════════ │
│                    EXECUTION LOG                             │
│  ═══════════════════════════════════════════════════════════ │
│                                                              │
│  14:32:05.123  Entered fetchUserData(userId=42)             │
│  14:32:05.124  State 0 → calling getToken()                 │
│  14:32:05.124  💤 SUSPENDED - getToken() is async           │
│  14:32:05.235  ▶ RESUMED with token="abc123"                │
│  14:32:05.235  State 1 → calling getProfile()               │
│  14:32:05.235  💤 SUSPENDED - getProfile() is async         │
│                [waiting...]                                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Continuation Chain View

```
┌─────────────────────────────────────────────────────────────┐
│           CONTINUATION CHAIN                                 │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│                    CURRENT STACK                             │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  FRAME 3: getProfile()                                   ││
│  │  State: 0 (initial)                                      ││
│  │  Locals: { token: "abc123" }                            ││
│  │  Status: 💤 SUSPENDED (waiting for HTTP response)       ││
│  └─────────────────────────────────────────────────────────┘│
│                          │                                   │
│                          │ will resume                       │
│                          ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  FRAME 2: fetchUserData()                               ││
│  │  State: 1 (after getToken)                              ││
│  │  Locals: { token: "abc123", userId: 42 }               ││
│  │  Status: waiting for getProfile()                       ││
│  └─────────────────────────────────────────────────────────┘│
│                          │                                   │
│                          │ will resume                       │
│                          ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  FRAME 1: loadUser()                                     ││
│  │  State: 2 (after fetchUserData call)                    ││
│  │  Locals: { requestId: "req-123" }                       ││
│  │  Status: waiting for fetchUserData()                    ││
│  └─────────────────────────────────────────────────────────┘│
│                          │                                   │
│                          │ will resume                       │
│                          ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  ROOT: Dispatcher.Default                                ││
│  │  Will schedule on thread pool                           ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 4.3 Suspension Timeline

```
┌─────────────────────────────────────────────────────────────┐
│           SUSPENSION TIMELINE                                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Time ──────────────────────────────────────────────────▶   │
│  0ms        100ms       200ms       300ms       400ms       │
│  │           │           │           │           │          │
│                                                              │
│  fetchUserData():                                            │
│  ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░████  │
│      │                                               │       │
│      └─ suspended (getToken)                         └─ done │
│         S0→S1                                                │
│                                                              │
│  getToken():                                                 │
│      ████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
│      │                   │                                   │
│      └─ started          └─ completed (returns "abc123")    │
│         HTTP call                                            │
│                                                              │
│  getProfile():                                               │
│                          ██████████████████████████████████  │
│                          │                              │    │
│                          └─ started                     └─ ? │
│                             HTTP call                        │
│                                                              │
│  Legend: ████ = running, ░░░░ = suspended                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Test Scenarios

### 5.1 Single Suspension Point

```kotlin
@Test
fun `visualize single suspension`() = runTest {
    vizLaunch("caller") {
        val result = vizSuspendFunction("simpleDelay") {
            vizDelay(100)
            "done"
        }
    }
}
```

**Expected Events:**
1. `SuspendFunctionEntered(totalStates=2)`
2. `StateTransition(from=0, to=1, suspensionPoint="delay")`
3. `SuspensionOccurred(state=1)`
4. `ResumptionOccurred(state=1, resumedWith="success")`
5. `SuspendFunctionCompleted(totalSuspensions=1)`

### 5.2 Multiple Suspension Points

```kotlin
@Test
fun `visualize multi-step function`() = runTest {
    suspend fun multiStep(): Int = vizSuspendFunction("multiStep") {
        val a = step1()  // Suspends
        val b = step2()  // Suspends
        val c = step3()  // Suspends
        a + b + c
    }
    
    vizLaunch("runner") {
        multiStep()
    }
}
```

**Expected Visualization:**
- State machine with 4 states (0, 1, 2, 3)
- 3 suspension/resumption cycles
- Local variables updated at each state

### 5.3 Nested Suspend Calls

```kotlin
@Test
fun `visualize nested suspensions`() = runTest {
    suspend fun outer() = vizSuspendFunction("outer") {
        println("outer start")
        inner()  // Suspends inside inner
        println("outer end")
    }
    
    suspend fun inner() = vizSuspendFunction("inner") {
        println("inner start")
        vizDelay(100)
        println("inner end")
    }
    
    vizLaunch("caller") {
        outer()
    }
}
```

**Expected Visualization:**
- Continuation chain showing outer → inner
- Inner's suspension propagates to outer
- Resumption unwinds back up

---

## 6. Deep Dive: ContinuationInterceptor

### 6.1 How Dispatchers Work

```kotlin
// Simplified dispatcher implementation
class MyDispatcher : ContinuationInterceptor {
    override val key = ContinuationInterceptor
    
    override fun <T> interceptContinuation(
        continuation: Continuation<T>
    ): Continuation<T> {
        return DispatchedContinuation(this, continuation)
    }
}

class DispatchedContinuation<T>(
    val dispatcher: CoroutineDispatcher,
    val continuation: Continuation<T>
) : Continuation<T> {
    
    override val context = continuation.context
    
    override fun resumeWith(result: Result<T>) {
        // Don't resume directly - dispatch to thread pool!
        dispatcher.dispatch(context, Runnable {
            continuation.resumeWith(result)
        })
    }
}
```

### 6.2 Interceptor Visualization

```
┌─────────────────────────────────────────────────────────────┐
│           CONTINUATION INTERCEPTION                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Original Continuation                                       │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  fetchUserData.StateMachine                             ││
│  │  State: 1                                                ││
│  │  Context: [Job, CoroutineName("fetcher")]               ││
│  └─────────────────────────────────────────────────────────┘│
│                          │                                   │
│                          │ interceptContinuation()           │
│                          ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  DispatchedContinuation (wrapper)                       ││
│  │  Dispatcher: Dispatchers.IO                              ││
│  │  Wrapped: fetchUserData.StateMachine                    ││
│  └─────────────────────────────────────────────────────────┘│
│                          │                                   │
│                          │ resumeWith(result)                │
│                          ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  dispatcher.dispatch(context, Runnable {                ││
│  │      continuation.resumeWith(result)                    ││
│  │  })                                                      ││
│  │                                                          ││
│  │  → Scheduled on IO thread pool                          ││
│  │  → Thread: DefaultDispatcher-worker-3                   ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Introspection Wrapper

### 7.1 Implementation

```kotlin
suspend inline fun <T> VizScope.vizSuspendFunction(
    name: String,
    crossinline block: suspend () -> T
): T {
    val functionId = IdRegistry.nextFunctionId()
    val coroutineId = currentCoroutineId()
    
    session.send(SuspendFunctionEntered(
        functionId = functionId,
        functionName = name,
        coroutineId = coroutineId,
        totalStates = estimateStates(block),  // Heuristic
        parameters = emptyMap()
    ))
    
    var currentState = 0
    val startTime = System.nanoTime()
    var suspensionCount = 0
    
    // Wrap the block to track state transitions
    val result = try {
        block()
    } finally {
        session.send(SuspendFunctionCompleted(
            functionId = functionId,
            finalState = currentState,
            result = null,
            totalSuspensions = suspensionCount,
            totalDurationNanos = System.nanoTime() - startTime
        ))
    }
    
    return result
}
```

### 7.2 DebugProbes Integration

```kotlin
// Use kotlinx-coroutines-debug for stack capture
object CoroutineStackCapture {
    
    fun captureStack(continuation: Continuation<*>): List<StackFrame> {
        // Use DebugProbes if available
        return if (DebugProbes.isInstalled) {
            DebugProbes.dumpCoroutinesInfo()
                .find { it.continuation === continuation }
                ?.let { parseStackFrames(it) }
                ?: emptyList()
        } else {
            emptyList()
        }
    }
    
    private fun parseStackFrames(info: CoroutineInfo): List<StackFrame> {
        return info.lastObservedStackTrace().map { element ->
            StackFrame(
                functionName = "${element.className}.${element.methodName}",
                state = extractState(element),
                savedVariables = emptyMap()  // Would need bytecode analysis
            )
        }
    }
}
```

---

## 8. Educational Value

### 8.1 Common Misconceptions Addressed

| Misconception | Reality Shown |
|---------------|---------------|
| "Coroutines are lightweight threads" | They're **state machines** + **continuations** |
| "Suspension blocks something" | Suspension **releases** the thread |
| "Local variables are lost on suspension" | Variables **saved in state machine** |
| "Resumption continues where it left off" | Actually **re-enters function** at saved state |
| "Each suspension creates new object" | **Same state machine object** reused |

### 8.2 Key Insights to Visualize

1. **No Magic** - It's just callbacks + state tracking
2. **Stack Unwinding** - Function returns COROUTINE_SUSPENDED
3. **State Preservation** - Locals saved as object fields
4. **Efficient** - One object per suspend function call
5. **Composable** - State machines chain together

---

## 9. Summary

### Key Concepts

| Concept | Description |
|---------|-------------|
| **State Machine** | Compiled form of suspend function |
| **Continuation** | "Rest of computation" object |
| **label** | Current state in state machine |
| **COROUTINE_SUSPENDED** | Special marker for suspension |
| **resumeWith** | How to continue after suspension |
| **Interceptor** | How dispatchers inject themselves |

### Implementation Checklist

- [ ] State machine visualization
- [ ] Continuation chain view
- [ ] Local variable tracking
- [ ] Suspension/resumption animation
- [ ] DebugProbes integration
- [ ] Stack frame display
- [ ] State stepper controls
- [ ] Timeline view

---

**End of Document**

