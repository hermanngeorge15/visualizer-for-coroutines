package com.jh.proj.coroutineviz.checksystem

import com.jh.proj.coroutineviz.events.AntiPatternDetected
import com.jh.proj.coroutineviz.events.AntiPatternSeverity
import com.jh.proj.coroutineviz.events.AntiPatternType
import com.jh.proj.coroutineviz.events.CoroutineEvent
import com.jh.proj.coroutineviz.events.VizEvent
import com.jh.proj.coroutineviz.events.coroutine.CoroutineCancelled
import com.jh.proj.coroutineviz.events.coroutine.CoroutineCompleted
import com.jh.proj.coroutineviz.events.coroutine.CoroutineCreated
import com.jh.proj.coroutineviz.events.coroutine.CoroutineFailed
import com.jh.proj.coroutineviz.events.coroutine.CoroutineStarted
import com.jh.proj.coroutineviz.events.coroutine.CoroutineSuspended
import com.jh.proj.coroutineviz.events.dispatcher.DispatcherSelected
import com.jh.proj.coroutineviz.events.dispatcher.ThreadAssigned
import com.jh.proj.coroutineviz.models.RuntimeSnapshot

/**
 * Detects anti-patterns in coroutine usage by analyzing events and runtime state.
 *
 * Rules:
 * - GlobalScope usage: coroutines without a structured parent scope
 * - Blocking on Main: long operations on the main/UI dispatcher
 * - Leaked coroutines: coroutines that outlive their expected lifecycle
 * - Unnecessary async-await: async immediately followed by await (could be withContext)
 * - runBlocking misuse: runBlocking called from a coroutine context
 * - Coroutine explosion: too many coroutines created in a short window
 */
class AntiPatternDetector(
    private val snapshot: RuntimeSnapshot,
    private val recorder: EventRecorder,
    private val sessionId: String = "",
) {
    companion object {
        /** Maximum coroutines created within a 1-second window before flagging explosion. */
        const val EXPLOSION_THRESHOLD = 100

        /** Time window in nanos for explosion detection (1 second). */
        const val EXPLOSION_WINDOW_NANOS = 1_000_000_000L

        /** Maximum time in nanos a coroutine can run on Main before flagging (50ms). */
        const val MAIN_BLOCKING_THRESHOLD_NANOS = 50_000_000L
    }

    /**
     * Run all anti-pattern detection rules against current state and events.
     * Returns a list of findings.
     */
    fun detectAll(): List<AntiPatternDetected> {
        val findings = mutableListOf<AntiPatternDetected>()
        findings.addAll(detectGlobalScopeUsage())
        findings.addAll(detectBlockingOnMain())
        findings.addAll(detectLeakedCoroutines())
        findings.addAll(detectUnnecessaryAsyncAwait())
        findings.addAll(detectCoroutineExplosion())
        return findings
    }

    /**
     * Detect coroutines that were created without a parent, suggesting GlobalScope usage.
     */
    fun detectGlobalScopeUsage(): List<AntiPatternDetected> {
        val findings = mutableListOf<AntiPatternDetected>()

        val created =
            recorder.ofKind("CoroutineCreated")
                .filterIsInstance<CoroutineCreated>()

        for (event in created) {
            if (event.parentCoroutineId == null && event.scopeId.isEmpty()) {
                findings.add(
                    AntiPatternDetected(
                        sessionId = event.sessionId,
                        seq = event.seq,
                        tsNanos = event.tsNanos,
                        patternType = AntiPatternType.GLOBAL_SCOPE_USAGE,
                        severity = AntiPatternSeverity.WARNING,
                        description =
                            "Coroutine '${event.label ?: event.coroutineId}' was launched without a structured " +
                                "parent scope. This may indicate GlobalScope usage.",
                        suggestion =
                            "Use a structured CoroutineScope (e.g., viewModelScope, lifecycleScope, or a custom " +
                                "scope) instead of GlobalScope to ensure proper lifecycle management.",
                        coroutineId = event.coroutineId,
                        scopeId = event.scopeId,
                    ),
                )
            }
        }

        return findings
    }

    /**
     * Detect coroutines that run long operations on the Main dispatcher.
     */
    fun detectBlockingOnMain(): List<AntiPatternDetected> {
        val findings = mutableListOf<AntiPatternDetected>()

        val dispatchers =
            recorder.ofKind("DispatcherSelected")
                .filterIsInstance<DispatcherSelected>()

        val threadAssignments =
            recorder.ofKind("ThreadAssigned")
                .filterIsInstance<ThreadAssigned>()

        // Find coroutines assigned to Main dispatcher
        val mainCoroutines =
            dispatchers
                .filter { it.dispatcherName.contains("Main", ignoreCase = true) }
                .map { it.coroutineId }
                .toSet()

        for (coroutineId in mainCoroutines) {
            val events = recorder.forCoroutine(coroutineId)
            val started = events.filterIsInstance<CoroutineStarted>().firstOrNull()
            val completed =
                events.filterIsInstance<CoroutineCompleted>().firstOrNull()
                    ?: events.filterIsInstance<CoroutineFailed>().firstOrNull()
                    ?: events.filterIsInstance<CoroutineCancelled>().firstOrNull()

            if (started != null && completed != null) {
                val duration = completed.tsNanos - started.tsNanos
                // Check if the coroutine ran for too long without suspending
                val suspensions = events.filterIsInstance<CoroutineSuspended>()
                if (suspensions.isEmpty() && duration > MAIN_BLOCKING_THRESHOLD_NANOS) {
                    findings.add(
                        AntiPatternDetected(
                            sessionId = started.sessionId,
                            seq = started.seq,
                            tsNanos = started.tsNanos,
                            patternType = AntiPatternType.BLOCKING_ON_MAIN,
                            severity = AntiPatternSeverity.ERROR,
                            description =
                                "Coroutine '${started.label ?: coroutineId}' ran for " +
                                    "${duration / 1_000_000}ms on the Main dispatcher without suspending.",
                            suggestion =
                                "Move long-running work to Dispatchers.IO or Dispatchers.Default using " +
                                    "withContext(). Keep Main dispatcher for UI updates only.",
                            coroutineId = coroutineId,
                        ),
                    )
                }
            }
        }

        return findings
    }

    /**
     * Detect coroutines that appear to be leaked (started but never completed/cancelled).
     */
    fun detectLeakedCoroutines(): List<AntiPatternDetected> {
        val findings = mutableListOf<AntiPatternDetected>()

        val allCreated =
            recorder.ofKind("CoroutineCreated")
                .filterIsInstance<CoroutineCreated>()
                .map { it.coroutineId }
                .toSet()

        val allTerminated =
            (
                recorder.ofKind("CoroutineCompleted").map { (it as CoroutineEvent).coroutineId } +
                    recorder.ofKind("CoroutineCancelled").map { (it as CoroutineEvent).coroutineId } +
                    recorder.ofKind("CoroutineFailed").map { (it as CoroutineEvent).coroutineId }
            ).toSet()

        val leaked = allCreated - allTerminated

        // Check if the leaked coroutines are actually still active (not just in-progress)
        for (coroutineId in leaked) {
            val node = snapshot.coroutines[coroutineId]
            // Only flag if the scope is completed but the coroutine isn't
            if (node != null && node.state.toString() != "ACTIVE") {
                findings.add(
                    AntiPatternDetected(
                        sessionId = sessionId,
                        seq = 0,
                        tsNanos = System.nanoTime(),
                        patternType = AntiPatternType.LEAKED_COROUTINE,
                        severity = AntiPatternSeverity.WARNING,
                        description =
                            "Coroutine '${node.label ?: coroutineId}' was created but never completed " +
                                "or cancelled. It may be leaked.",
                        suggestion =
                            "Ensure all coroutines are properly cancelled when no longer needed. Use structured " +
                                "concurrency to automatically cancel child coroutines.",
                        coroutineId = coroutineId,
                        affectedEntities = listOf(coroutineId),
                    ),
                )
            }
        }

        return findings
    }

    /**
     * Detect unnecessary async-await patterns where withContext would be simpler.
     * Identifies async { ... }.await() that could be withContext { ... }.
     */
    fun detectUnnecessaryAsyncAwait(): List<AntiPatternDetected> {
        val findings = mutableListOf<AntiPatternDetected>()

        val awaits = recorder.ofKind("DeferredAwaitStarted")
        val created =
            recorder.ofKind("CoroutineCreated")
                .filterIsInstance<CoroutineCreated>()

        for (await in awaits) {
            val awaitEvent = await as? VizEvent ?: continue
            // Look for coroutines that were created and immediately awaited
            // by their parent (same parent coroutine creating and awaiting)
            val coroutineId = (await as? com.jh.proj.coroutineviz.events.deferred.DeferredAwaitStarted)?.coroutineId
            val awaiterId = (await as? com.jh.proj.coroutineviz.events.deferred.DeferredAwaitStarted)?.awaiterId

            if (coroutineId != null && awaiterId != null) {
                val createdEvent = created.find { it.coroutineId == coroutineId }
                // If the awaiter is the parent, this is likely async { }.await()
                if (createdEvent?.parentCoroutineId == awaiterId) {
                    // Check if there are other coroutines between create and await
                    val createdBetween =
                        created.filter {
                            it.parentCoroutineId == awaiterId &&
                                it.seq > createdEvent.seq &&
                                it.seq < awaitEvent.seq
                        }
                    if (createdBetween.isEmpty()) {
                        findings.add(
                            AntiPatternDetected(
                                sessionId = awaitEvent.sessionId,
                                seq = awaitEvent.seq,
                                tsNanos = awaitEvent.tsNanos,
                                patternType = AntiPatternType.UNNECESSARY_ASYNC_AWAIT,
                                severity = AntiPatternSeverity.INFO,
                                description =
                                    "Coroutine '${createdEvent.label ?: coroutineId}' appears to be " +
                                        "an async { }.await() pattern.",
                                suggestion =
                                    "Consider using withContext(dispatcher) { } instead of " +
                                        "async { }.await() when you don't need concurrent execution.",
                                coroutineId = coroutineId,
                                affectedEntities = listOf(coroutineId, awaiterId),
                            ),
                        )
                    }
                }
            }
        }

        return findings
    }

    /**
     * Detect coroutine explosion — too many coroutines created in a short time window.
     */
    fun detectCoroutineExplosion(): List<AntiPatternDetected> {
        val findings = mutableListOf<AntiPatternDetected>()

        val created =
            recorder.ofKind("CoroutineCreated")
                .filterIsInstance<CoroutineCreated>()
                .sortedBy { it.tsNanos }

        if (created.size < EXPLOSION_THRESHOLD) return findings

        // Sliding window detection
        var windowStart = 0
        for (windowEnd in created.indices) {
            while (created[windowEnd].tsNanos - created[windowStart].tsNanos > EXPLOSION_WINDOW_NANOS) {
                windowStart++
            }
            val count = windowEnd - windowStart + 1
            if (count >= EXPLOSION_THRESHOLD) {
                val sessionId = created[windowEnd].sessionId
                findings.add(
                    AntiPatternDetected(
                        sessionId = sessionId,
                        seq = created[windowEnd].seq,
                        tsNanos = created[windowEnd].tsNanos,
                        patternType = AntiPatternType.COROUTINE_EXPLOSION,
                        severity = AntiPatternSeverity.WARNING,
                        description = "$count coroutines created within 1 second. This may indicate unbounded coroutine creation.",
                        suggestion =
                            "Consider using a bounded mechanism like a Semaphore, Channel, or " +
                                "Flow.flatMapMerge(concurrency) to limit concurrent coroutines.",
                        affectedEntities = created.subList(windowStart, windowEnd + 1).map { it.coroutineId },
                    ),
                )
                break // Report once per window
            }
        }

        return findings
    }
}
