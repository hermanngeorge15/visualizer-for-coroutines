package com.jh.proj.coroutineviz.validation.rules

import com.jh.proj.coroutineviz.events.CoroutineEvent
import com.jh.proj.coroutineviz.events.VizEvent
import com.jh.proj.coroutineviz.events.coroutine.CoroutineCancelled
import com.jh.proj.coroutineviz.events.coroutine.CoroutineCreated
import com.jh.proj.coroutineviz.events.coroutine.CoroutineFailed
import com.jh.proj.coroutineviz.validation.RuleFinding
import com.jh.proj.coroutineviz.validation.ValidationCategory
import com.jh.proj.coroutineviz.validation.ValidationRule
import com.jh.proj.coroutineviz.validation.ValidationSeverity

/**
 * Detect coroutines that swallow CancellationException (cancel then complete instead of cancel).
 */
class SwallowedCancellationRule : ValidationRule {
    override val id = "exception.swallowed-cancellation"
    override val name = "Swallowed Cancellation"
    override val description = "Detect coroutines that may be swallowing CancellationException"
    override val category = ValidationCategory.EXCEPTION_HANDLING
    override val severity = ValidationSeverity.WARNING

    override fun validate(events: List<VizEvent>): List<RuleFinding> {
        val findings = mutableListOf<RuleFinding>()
        val coroutineEvents = events.filterIsInstance<CoroutineEvent>()
        val byCoroutine = coroutineEvents.groupBy { it.coroutineId }

        // Find coroutines where cancellation was requested but coroutine completed normally
        val cancellationRequested =
            events
                .filter { it.kind == "JobCancellationRequested" }
                .filterIsInstance<CoroutineEvent>()
                .map { it.coroutineId }
                .toSet()

        for (coroutineId in cancellationRequested) {
            val cEvents = byCoroutine[coroutineId] ?: continue
            val completed = cEvents.any { it.kind == "CoroutineCompleted" }
            val cancelled = cEvents.any { it is CoroutineCancelled }

            if (completed && !cancelled) {
                findings.add(
                    RuleFinding(
                        ruleId = id,
                        ruleName = name,
                        severity = severity.name,
                        category = category.name,
                        message = "Coroutine $coroutineId had cancellation requested but completed normally",
                        suggestion =
                            "Avoid catching CancellationException without rethrowing. " +
                                "Use try { } catch (e: Exception) { if (e is CancellationException) throw e }.",
                        coroutineId = coroutineId,
                    ),
                )
            }
        }

        return findings
    }
}

/**
 * Detect unhandled exceptions in launch coroutines (no CoroutineExceptionHandler).
 */
class UncaughtExceptionInLaunchRule : ValidationRule {
    override val id = "exception.uncaught-in-launch"
    override val name = "Uncaught Exception in Launch"
    override val description = "Detect launch coroutines that fail without exception handling"
    override val category = ValidationCategory.EXCEPTION_HANDLING
    override val severity = ValidationSeverity.WARNING

    override fun validate(events: List<VizEvent>): List<RuleFinding> {
        val findings = mutableListOf<RuleFinding>()
        val coroutineEvents = events.filterIsInstance<CoroutineEvent>()
        val byCoroutine = coroutineEvents.groupBy { it.coroutineId }
        val createEvents = events.filterIsInstance<CoroutineCreated>()

        for (created in createEvents) {
            val cEvents = byCoroutine[created.coroutineId] ?: continue
            val failed = cEvents.filterIsInstance<CoroutineFailed>().firstOrNull() ?: continue

            // If this is a root coroutine (no parent) that failed, it likely crashed
            if (created.parentCoroutineId == null) {
                findings.add(
                    RuleFinding(
                        ruleId = id,
                        ruleName = name,
                        severity = severity.name,
                        category = category.name,
                        message =
                            "Root coroutine '${created.label ?: created.coroutineId}' failed with " +
                                "${failed.exceptionType ?: "unknown exception"}: ${failed.message ?: "no message"}",
                        suggestion =
                            "Add a CoroutineExceptionHandler to the scope or use supervisorScope to prevent " +
                                "unhandled exceptions from crashing the application.",
                        coroutineId = created.coroutineId,
                        eventSeq = failed.seq,
                    ),
                )
            }
        }

        return findings
    }
}
