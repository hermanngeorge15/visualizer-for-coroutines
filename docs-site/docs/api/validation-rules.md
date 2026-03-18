---
sidebar_position: 3
---

# Validation Rules

The validation engine ships with 20 built-in rules that detect common coroutine anti-patterns and bugs.

## Lifecycle Rules

### `LeakedCoroutine`
**Severity:** Critical
Detects coroutines that were created but never reached a terminal state (completed, cancelled, or failed) within the session.

### `OrphanedChild`
**Severity:** Critical
Detects child coroutines that outlived their parent scope, indicating a structured concurrency violation.

### `MissingCancellationCheck`
**Severity:** Warning
Flags long-running coroutines that never call `ensureActive()` or check `isActive`.

### `UnusedDeferred`
**Severity:** Warning
Detects `async` blocks whose `Deferred` result is never awaited.

## Error Handling Rules

### `UnhandledException`
**Severity:** Critical
Detects exceptions that propagated without being caught by a `CoroutineExceptionHandler` or `supervisorScope`.

### `SwallowedException`
**Severity:** Warning
Flags exceptions that were caught but neither logged nor rethrown.

### `MissingSupervisor`
**Severity:** Warning
Warns when parallel coroutines are launched without a `supervisorScope` for failure isolation.

### `CancellationExceptionMisuse`
**Severity:** Info
Detects `CancellationException` being caught and swallowed instead of rethrown.

## Performance Rules

### `DispatcherMisuse`
**Severity:** Warning
Detects CPU-intensive work on `Dispatchers.IO` or blocking I/O on `Dispatchers.Default`.

### `ExcessiveContextSwitching`
**Severity:** Info
Flags coroutines that switch dispatchers more than a configurable threshold.

### `UnboundedConcurrency`
**Severity:** Warning
Warns when a large number of coroutines are launched without concurrency limiting.

### `ExcessiveSuspensions`
**Severity:** Info
Detects coroutines that suspend and resume an unusually high number of times.

## Synchronization Rules

### `MutexDeadlockRisk`
**Severity:** Critical
Detects nested mutex acquisitions that could lead to deadlocks.

### `SemaphoreStarvation`
**Severity:** Critical
Flags semaphore permits that are acquired but never released.

### `ChannelLeak`
**Severity:** Warning
Detects channels that are created and used but never closed.

### `SelectWithSingleClause`
**Severity:** Info
Flags `select` expressions with only one clause (unnecessary select).

## Flow Rules

### `UncollectedFlow`
**Severity:** Warning
Detects flows that are created but never collected.

### `MissingFlowCatch`
**Severity:** Warning
Flags flow chains without a `catch` operator.

### `UnboundedFlowBuffer`
**Severity:** Warning
Detects flows with `buffer(UNLIMITED)` that could cause memory issues.

### `FlowInGlobalScope`
**Severity:** Critical
Flags flow collection happening in `GlobalScope` instead of a structured scope.

## Rule Configuration

Each rule can be configured:

```kotlin
ValidationConfig {
    rule(LeakedCoroutine) {
        enabled = true
        severity = Severity.CRITICAL
        timeout = 30.seconds
    }
}
```

See [Extending Validation](../advanced/extending-validation) for creating custom rules.
