package com.jh.proj.coroutineviz.validation.rules

import com.jh.proj.coroutineviz.events.CoroutineEvent
import com.jh.proj.coroutineviz.events.VizEvent
import com.jh.proj.coroutineviz.events.coroutine.CoroutineCreated
import com.jh.proj.coroutineviz.events.coroutine.CoroutineStarted
import com.jh.proj.coroutineviz.events.coroutine.CoroutineSuspended
import com.jh.proj.coroutineviz.events.dispatcher.DispatcherSelected
import com.jh.proj.coroutineviz.validation.RuleFinding
import com.jh.proj.coroutineviz.validation.ValidationCategory
import com.jh.proj.coroutineviz.validation.ValidationRule
import com.jh.proj.coroutineviz.validation.ValidationSeverity

/**
 * Detect long-running work on the Main dispatcher without suspension.
 */
class MainThreadBlockingRule : ValidationRule {
    override val id = "performance.main-thread-blocking"
    override val name = "Main Thread Blocking"
    override val description = "Detect coroutines that block the Main dispatcher for too long"
    override val category = ValidationCategory.PERFORMANCE
    override val severity = ValidationSeverity.ERROR

    companion object {
        const val THRESHOLD_NANOS = 50_000_000L // 50ms
    }

    override fun validate(events: List<VizEvent>): List<RuleFinding> {
        val findings = mutableListOf<RuleFinding>()
        val dispatchers = events.filterIsInstance<DispatcherSelected>()
        val coroutineEvents = events.filterIsInstance<CoroutineEvent>()
        val byCoroutine = coroutineEvents.groupBy { it.coroutineId }

        val mainCoroutines =
            dispatchers
                .filter { it.dispatcherName.contains("Main", ignoreCase = true) }
                .map { it.coroutineId }
                .toSet()

        for (coroutineId in mainCoroutines) {
            val cEvents = byCoroutine[coroutineId] ?: continue
            val started = cEvents.filterIsInstance<CoroutineStarted>().firstOrNull() ?: continue
            val suspensions = cEvents.filterIsInstance<CoroutineSuspended>()
            val terminal = cEvents.firstOrNull { it.kind in setOf("CoroutineCompleted", "CoroutineCancelled", "CoroutineFailed") }

            if (terminal != null && suspensions.isEmpty()) {
                val duration = terminal.tsNanos - started.tsNanos
                if (duration > THRESHOLD_NANOS) {
                    findings.add(
                        RuleFinding(
                            ruleId = id,
                            ruleName = name,
                            severity = severity.name,
                            category = category.name,
                            message = "Coroutine $coroutineId ran ${duration / 1_000_000}ms on Main without suspending",
                            suggestion = "Move CPU-intensive or blocking work to Dispatchers.IO or Dispatchers.Default.",
                            coroutineId = coroutineId,
                            eventSeq = started.seq,
                        ),
                    )
                }
            }
        }

        return findings
    }
}

/**
 * Detect excessive coroutine creation (coroutine explosion).
 */
class ExcessiveCoroutineCreationRule : ValidationRule {
    override val id = "performance.excessive-creation"
    override val name = "Excessive Coroutine Creation"
    override val description = "Detect creation of too many coroutines in a short time window"
    override val category = ValidationCategory.PERFORMANCE
    override val severity = ValidationSeverity.WARNING

    companion object {
        const val THRESHOLD = 100
        const val WINDOW_NANOS = 1_000_000_000L // 1 second
    }

    override fun validate(events: List<VizEvent>): List<RuleFinding> {
        val findings = mutableListOf<RuleFinding>()
        val created = events.filterIsInstance<CoroutineCreated>().sortedBy { it.tsNanos }

        if (created.size < THRESHOLD) return findings

        var start = 0
        for (end in created.indices) {
            while (created[end].tsNanos - created[start].tsNanos > WINDOW_NANOS) start++
            val count = end - start + 1
            if (count >= THRESHOLD) {
                findings.add(
                    RuleFinding(
                        ruleId = id,
                        ruleName = name,
                        severity = severity.name,
                        category = category.name,
                        message = "$count coroutines created within 1 second",
                        suggestion = "Use bounded concurrency (Semaphore, Channel, or flatMapMerge) to limit parallel coroutines.",
                        eventSeq = created[end].seq,
                        affectedEntities = created.subList(start, end + 1).map { it.coroutineId },
                    ),
                )
                break
            }
        }

        return findings
    }
}

/**
 * Detect suspensions that take unusually long.
 */
class SlowSuspensionRule : ValidationRule {
    override val id = "performance.slow-suspension"
    override val name = "Slow Suspension"
    override val description = "Detect coroutine suspensions that take unusually long"
    override val category = ValidationCategory.PERFORMANCE
    override val severity = ValidationSeverity.INFO

    companion object {
        const val THRESHOLD_NANOS = 10_000_000_000L // 10 seconds
    }

    override fun validate(events: List<VizEvent>): List<RuleFinding> {
        val findings = mutableListOf<RuleFinding>()
        val suspensions = events.filterIsInstance<CoroutineSuspended>()

        for (suspension in suspensions) {
            val duration = suspension.durationMillis
            if (duration != null && duration * 1_000_000 > THRESHOLD_NANOS) {
                findings.add(
                    RuleFinding(
                        ruleId = id,
                        ruleName = name,
                        severity = severity.name,
                        category = category.name,
                        message = "Coroutine ${suspension.coroutineId} suspended for ${duration}ms (reason: ${suspension.reason})",
                        suggestion = "Long suspensions may indicate deadlocks, slow I/O, or forgotten delays. Verify this is intentional.",
                        coroutineId = suspension.coroutineId,
                        eventSeq = suspension.seq,
                    ),
                )
            }
        }

        return findings
    }
}
