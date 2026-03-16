# Design: Instrument flatMapConcat, flatMapMerge, flatMapLatest

## Problem

The three `vizFlatMap*` operators in `InstrumentedFlow.kt` currently only emit a `FlowOperatorApplied` event and delegate to Kotlin stdlib. The inner flows created by the user's transform function are completely invisible — no events for inner flow creation, emissions, completion, or cancellation.

This makes it impossible to visualize the key differences:
- **flatMapConcat**: sequential inner flows (one at a time)
- **flatMapMerge**: concurrent inner flows (up to N at a time)
- **flatMapLatest**: cancel-on-new (previous inner flow cancelled when new upstream value arrives)

## Solution: Wrap the Transform Function

The core technique is intercepting the user's `transform: suspend (T) -> Flow<R>` to track inner flows:

```
Upstream value arrives
    |
    v
[FlatMapInnerFlowStarted]  -- emit event with input value + innerFlowId
    |
    v
Call user's transform(value) -> get inner Flow<R>
    |
    v
Wrap inner flow to track:
    - Each emission -> [FlowValueEmitted] with innerFlowId
    - Normal completion -> [FlatMapInnerFlowCompleted]
    - Cancellation -> [FlatMapInnerFlowCancelled]
```

A shared private helper `instrumentFlatMapTransform()` does this wrapping. All 3 flatMap variants reuse it.

---

## TODO Checklist

### Step 1: Create `FlatMapInnerFlowStarted` event
- [ ] Create `src/main/kotlin/com/jh/proj/coroutineviz/events/flow/FlatMapInnerFlowStarted.kt`
- Fields: `flowId` (parent flatMap), `innerFlowId`, `inputValuePreview`, `inputValueType`, `inputIndex` (0-based), `operatorName`, `coroutineId?`, `label?`
- Follow pattern: `@Serializable`, `@SerialName("FlatMapInnerFlowStarted")`, implement `VizEvent`

### Step 2: Create `FlatMapInnerFlowCompleted` event
- [ ] Create `src/main/kotlin/com/jh/proj/coroutineviz/events/flow/FlatMapInnerFlowCompleted.kt`
- Fields: `flowId`, `innerFlowId`, `inputIndex`, `emittedCount`, `durationNanos`, `coroutineId?`

### Step 3: Create `FlatMapInnerFlowCancelled` event
- [ ] Create `src/main/kotlin/com/jh/proj/coroutineviz/events/flow/FlatMapInnerFlowCancelled.kt`
- Fields: `flowId`, `innerFlowId`, `inputIndex`, `emittedCount`, `reason?`, `coroutineId?`

### Step 4: Add FlowEventContext helper extensions
- [ ] Edit `src/main/kotlin/com/jh/proj/coroutineviz/session/FlowEventContext.kt`
- Add 3 imports for new event classes
- Add 3 extension functions after the "Flow Operator Events" section (after line 224):
  - `flatMapInnerFlowStarted(innerFlowId, inputValue, inputIndex, operatorName)`
  - `flatMapInnerFlowCompleted(innerFlowId, inputIndex, emittedCount, durationNanos)`
  - `flatMapInnerFlowCancelled(innerFlowId, inputIndex, emittedCount, reason)`

### Step 5: Add `instrumentFlatMapTransform` helper to InstrumentedFlow
- [ ] Edit `src/main/kotlin/com/jh/proj/coroutineviz/wrappers/InstrumentedFlow.kt`
- Add new imports: `flow`, `AtomicInteger`, 3 new FlowEventContext extensions
- Add private method `instrumentFlatMapTransform()` inside the class
- Uses `AtomicInteger` for thread-safe `inputIndex` counter (needed for flatMapMerge concurrency)
- Wraps transform to emit inner flow lifecycle events

### Step 6: Rewrite 3 flatMap operators in InstrumentedFlow
- [ ] Rewrite `vizFlatMapConcat` (line ~893) to use `instrumentFlatMapTransform`
- [ ] Rewrite `vizFlatMapMerge` (line ~915) to use `instrumentFlatMapTransform`
- [ ] Rewrite `vizFlatMapLatest` (line ~940) to use `instrumentFlatMapTransform`
- [ ] Compile check: `./gradlew compileKotlin`

### Step 7: Create flatMap scenario examples
- [ ] Create `src/main/kotlin/com/jh/proj/coroutineviz/examples/flatMapScenarios.kt`
- `flatMapConcatScenario` — 3 upstream values, each spawns inner flow with 2 emissions + delays
- `flatMapMergeScenario` — 4 upstream values, concurrency=2, varying processing times
- `flatMapLatestScenario` — 5 rapid search terms (150ms apart), search takes 300ms, most get cancelled

### Step 8: Wire up scenarios (ScenarioRunner + Routes)
- [ ] Edit `ScenarioRunner.kt` — add 3 imports + 3 runner methods
- [ ] Edit `ScenarioRunnerRoutes.kt` — add 3 POST routes + 3 scenario list entries
- [ ] Compile check: `./gradlew compileKotlin`

### Step 9: Test
- [ ] Start server: `./gradlew run`
- [ ] `POST /api/scenarios/flatmap-concat` — verify sequential inner flows
- [ ] `POST /api/scenarios/flatmap-merge` — verify concurrent inner flows
- [ ] `POST /api/scenarios/flatmap-latest` — verify cancellation of previous inner flows

---

## New Event Classes Detail

### FlatMapInnerFlowStarted
```kotlin
@Serializable
@SerialName("FlatMapInnerFlowStarted")
data class FlatMapInnerFlowStarted(
    override val sessionId: String,
    override val seq: Long,
    override val tsNanos: Long,
    val flowId: String,           // parent flatMap operator flow ID
    val innerFlowId: String,      // unique ID for this inner flow
    val inputValuePreview: String, // the upstream value that triggered this
    val inputValueType: String,
    val inputIndex: Int,          // 0-based index of upstream value
    val operatorName: String,     // "flatMapConcat", "flatMapMerge(2)", "flatMapLatest"
    val coroutineId: String? = null,
    val label: String? = null
) : VizEvent {
    override val kind: String get() = "FlatMapInnerFlowStarted"
}
```

### FlatMapInnerFlowCompleted
```kotlin
@Serializable
@SerialName("FlatMapInnerFlowCompleted")
data class FlatMapInnerFlowCompleted(
    override val sessionId: String,
    override val seq: Long,
    override val tsNanos: Long,
    val flowId: String,
    val innerFlowId: String,
    val inputIndex: Int,
    val emittedCount: Int,        // how many values the inner flow emitted
    val durationNanos: Long,      // time from start to completion
    val coroutineId: String? = null
) : VizEvent {
    override val kind: String get() = "FlatMapInnerFlowCompleted"
}
```

### FlatMapInnerFlowCancelled
```kotlin
@Serializable
@SerialName("FlatMapInnerFlowCancelled")
data class FlatMapInnerFlowCancelled(
    override val sessionId: String,
    override val seq: Long,
    override val tsNanos: Long,
    val flowId: String,
    val innerFlowId: String,
    val inputIndex: Int,
    val emittedCount: Int,        // how many values emitted before cancellation
    val reason: String?,          // cancellation reason
    val coroutineId: String? = null
) : VizEvent {
    override val kind: String get() = "FlatMapInnerFlowCancelled"
}
```

---

## instrumentFlatMapTransform Helper (Pseudocode)

```kotlin
private fun <R> instrumentFlatMapTransform(
    operatorName: String,
    newFlowId: String,
    transform: suspend (T) -> Flow<R>
): suspend (T) -> Flow<R> {
    val inputCounter = AtomicInteger(0)

    return { value: T ->
        val innerFlowId = "flow-inner-${session.nextSeq()}"
        val inputIndex = inputCounter.getAndIncrement()
        val coroutineId = currentCoroutineContext()[VizCoroutineElement]?.coroutineId
        val operatorCtx = ctx.copy(flowId = newFlowId, coroutineId = coroutineId)

        // 1. Emit: inner flow starting
        session.send(operatorCtx.flatMapInnerFlowStarted(innerFlowId, value, inputIndex, operatorName))

        // 2. Call user's transform
        val innerFlow = transform(value)

        // 3. Wrap inner flow to track emissions + termination
        var emittedCount = 0
        val startTime = System.nanoTime()

        flow<R> {
            try {
                innerFlow.collect { innerValue ->
                    // Track emission with FlowValueEmitted (reuse existing event)
                    session.send(FlowValueEmitted(...flowId = innerFlowId...))
                    emittedCount++
                    emit(innerValue)
                }
                // 4a. Success
                session.send(operatorCtx.flatMapInnerFlowCompleted(innerFlowId, inputIndex, emittedCount, duration))
            } catch (e: CancellationException) {
                // 4b. Cancelled (critical for flatMapLatest)
                session.send(operatorCtx.flatMapInnerFlowCancelled(innerFlowId, inputIndex, emittedCount, reason))
                throw e  // MUST re-throw
            }
        }
    }
}
```

---

## Expected Event Flow Examples

### flatMapConcat (sequential)
```
FlowOperatorApplied         {operatorName: "flatMapConcat"}
FlatMapInnerFlowStarted     {inputValue: "1", inputIndex: 0}
FlowValueEmitted            {flowId: inner-0, value: "Item-1-detail-A"}
FlowValueEmitted            {flowId: inner-0, value: "Item-1-detail-B"}
FlatMapInnerFlowCompleted   {inputIndex: 0, emittedCount: 2}
FlatMapInnerFlowStarted     {inputValue: "2", inputIndex: 1}    <-- only starts after 0 completes
FlowValueEmitted            {flowId: inner-1, value: "Item-2-detail-A"}
FlowValueEmitted            {flowId: inner-1, value: "Item-2-detail-B"}
FlatMapInnerFlowCompleted   {inputIndex: 1, emittedCount: 2}
```

### flatMapMerge (concurrent, concurrency=2)
```
FlowOperatorApplied         {operatorName: "flatMapMerge(2)"}
FlatMapInnerFlowStarted     {inputValue: "1", inputIndex: 0}
FlatMapInnerFlowStarted     {inputValue: "2", inputIndex: 1}    <-- starts concurrently with 0
FlowValueEmitted            {flowId: inner-0, value: "Result-1-part1"}
FlatMapInnerFlowCompleted   {inputIndex: 0, emittedCount: 2}
FlatMapInnerFlowStarted     {inputValue: "3", inputIndex: 2}    <-- slot freed, 3 starts
FlowValueEmitted            {flowId: inner-1, value: "Result-2-part1"}
...interleaved...
```

### flatMapLatest (cancel-on-new)
```
FlowOperatorApplied         {operatorName: "flatMapLatest"}
FlatMapInnerFlowStarted     {inputValue: "k",   inputIndex: 0}
FlatMapInnerFlowCancelled   {inputIndex: 0, emittedCount: 0}    <-- cancelled by "ko"
FlatMapInnerFlowStarted     {inputValue: "ko",  inputIndex: 1}
FlatMapInnerFlowCancelled   {inputIndex: 1, emittedCount: 0}    <-- cancelled by "kot"
...
FlatMapInnerFlowStarted     {inputValue: "kotlin", inputIndex: 4}
FlowValueEmitted            {flowId: inner-4, value: "Results for 'kotlin'..."}
FlowValueEmitted            {flowId: inner-4, value: "Suggestions for 'kotlin'..."}
FlatMapInnerFlowCompleted   {inputIndex: 4, emittedCount: 2}    <-- only this one completes
```

---

## Reference Files

| File | Role |
|------|------|
| `wrappers/InstrumentedFlow.kt` | Main file to modify — flatMap operators + helper |
| `session/FlowEventContext.kt` | Add helper extension functions |
| `events/flow/FlowValueEmitted.kt` | Pattern to follow for new events |
| `events/flow/FlowOperatorApplied.kt` | Existing event (no changes needed) |
| `examples/flowBackpressureScenario.kt` | Pattern to follow for scenarios |
| `scenarios/ScenarioRunner.kt` | Add runner methods |
| `routes/ScenarioRunnerRoutes.kt` | Add HTTP routes |
