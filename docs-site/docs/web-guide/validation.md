---
sidebar_position: 4
---

# Validation

The validation engine analyzes captured events in real time to detect coroutine anti-patterns, potential bugs, and best-practice violations.

## Validation Dashboard

The validation tab in the session dashboard shows:

- **Overall score** — A percentage based on how many rules pass
- **Rule results** — Each rule with its status (pass, warning, fail)
- **Details** — Specific events that triggered a violation
- **Suggestions** — Recommended fixes for each violation

## Real-time Validation

Validation runs continuously as events stream in. Results update live, so you can see violations appear as soon as they occur.

## Built-in Rules

The engine includes 20+ rules across several categories:

### Lifecycle Rules
- **Leaked Coroutine** — Coroutine started but never completed or cancelled
- **Orphaned Child** — Child outlived its parent scope
- **Missing Cancellation** — Long-running coroutine without cancellation check

### Error Handling Rules
- **Unhandled Exception** — Exception not caught by handler or supervisor
- **Swallowed Exception** — Exception caught but not logged or rethrown
- **Missing Supervisor** — Parallel work without failure isolation

### Performance Rules
- **Dispatcher Misuse** — CPU-bound work on `Dispatchers.IO` or I/O on `Default`
- **Excessive Context Switching** — Too many dispatcher switches
- **Unbounded Concurrency** — Large number of coroutines without limiting

### Synchronization Rules
- **Mutex Deadlock Risk** — Nested mutex acquisitions
- **Semaphore Starvation** — Permit never released
- **Channel Leak** — Channel opened but never closed

### Flow Rules
- **Uncollected Flow** — Flow created but never collected
- **Missing Catch** — Flow without error handling
- **Unbounded Buffer** — Channel/flow buffer growing without bound

## Score Calculation

The score is a weighted average of all rule results:

- **Pass** = 100 points
- **Warning** = 50 points
- **Fail** = 0 points

Rules are weighted by severity (critical rules have higher weight).

## Custom Rules

You can add your own validation rules. See [Extending Validation](../advanced/extending-validation).
