---
sidebar_position: 2
---

# Instrumentation Wrappers

The backend uses wrapper classes to intercept coroutine operations and emit events. These wrappers are the instrumentation layer that makes visualization possible.

## VizScope

Wraps `CoroutineScope` to intercept `launch` and `async` calls.

```kotlin
val scope = VizScope(session, Dispatchers.Default)

scope.launch {
    // This launch is instrumented — emits CoroutineCreated, Started, etc.
    delay(100)
    // Emits CoroutineSuspended, CoroutineResumed
}
```

**Captured events:** `ScopeCreated`, `CoroutineCreated`, `CoroutineStarted`, `CoroutineSuspended`, `CoroutineResumed`, `CoroutineCompleted`, `ScopeCompleted`

## InstrumentedFlow

Wraps Kotlin `Flow` to track emissions and operator applications.

```kotlin
val flow = InstrumentedFlow(session) {
    flowOf(1, 2, 3)
        .map { it * 2 }
        .filter { it > 2 }
}

flow.collect { value ->
    // Each emission tracked
}
```

**Captured events:** `FlowCreated`, `FlowCollectStarted`, `FlowEmission`, `FlowOperatorApplied`, `FlowCompleted`

## VizMutex

Wraps `Mutex` to track lock acquisition and release.

```kotlin
val mutex = VizMutex(session)

mutex.withLock {
    // Critical section — lock/release events emitted
}
```

**Captured events:** `MutexLockAcquired`, `MutexLockReleased`, `MutexLockQueued`

## VizSemaphore

Wraps `Semaphore` to track permit acquisition and release.

```kotlin
val semaphore = VizSemaphore(session, permits = 3)

semaphore.withPermit {
    // Permit acquired and released — events emitted
}
```

**Captured events:** `SemaphoreAcquired`, `SemaphoreReleased`, `SemaphoreQueued`

## VizSelect

Wraps `select` expressions to track clause registration and resolution.

```kotlin
VizSelect(session) {
    channel1.onReceive { value -> /* ... */ }
    channel2.onReceive { value -> /* ... */ }
}
```

**Captured events:** `SelectStarted`, `SelectClauseRegistered`, `SelectClauseSelected`

## VizActor

Wraps the actor pattern for message-passing concurrency.

```kotlin
val actor = VizActor<Message>(session) { message ->
    // Process message — send/receive events emitted
}

actor.send(MyMessage("data"))
```

**Captured events:** `ChannelCreated`, `ChannelSend`, `ChannelReceive`, `ChannelClosed`

## Composition

Wrappers can be composed. A `VizScope` can contain `InstrumentedFlow`, `VizMutex`, and other wrappers. All events share the same session and are correlated by coroutine ID.
