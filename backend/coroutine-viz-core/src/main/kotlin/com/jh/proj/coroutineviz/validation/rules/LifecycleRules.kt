package com.jh.proj.coroutineviz.validation.rules

import com.jh.proj.coroutineviz.events.CoroutineEvent
import com.jh.proj.coroutineviz.events.VizEvent
import com.jh.proj.coroutineviz.events.coroutine.CoroutineCreated
import com.jh.proj.coroutineviz.events.coroutine.CoroutineStarted
import com.jh.proj.coroutineviz.validation.RuleFinding
import com.jh.proj.coroutineviz.validation.ValidationCategory
import com.jh.proj.coroutineviz.validation.ValidationRule
import com.jh.proj.coroutineviz.validation.ValidationSeverity

private val TERMINAL_KINDS = setOf("CoroutineCompleted", "CoroutineCancelled", "CoroutineFailed")

/**
 * Every CoroutineCreated must have a matching CoroutineStarted.
 */
class CreatedHasStartedRule : ValidationRule {
    override val id = "lifecycle.created-has-started"
    override val name = "Created Has Started"
    override val description = "Every CoroutineCreated must have a matching CoroutineStarted"
    override val category = ValidationCategory.LIFECYCLE
    override val severity = ValidationSeverity.ERROR

    override fun validate(events: List<VizEvent>): List<RuleFinding> {
        val byCoroutine = events.filterIsInstance<CoroutineEvent>().groupBy { it.coroutineId }
        val findings = mutableListOf<RuleFinding>()

        for ((coroutineId, coroutineEvents) in byCoroutine) {
            val hasCreated = coroutineEvents.any { it is CoroutineCreated }
            val hasStarted = coroutineEvents.any { it is CoroutineStarted }

            if (hasCreated && !hasStarted) {
                val createSeq = coroutineEvents.first { it is CoroutineCreated }.seq
                findings.add(
                    RuleFinding(
                        ruleId = id,
                        ruleName = name,
                        severity = severity.name,
                        category = category.name,
                        message = "Coroutine $coroutineId was created but never started",
                        suggestion = "Ensure the coroutine scope is not cancelled before the coroutine can start.",
                        coroutineId = coroutineId,
                        eventSeq = createSeq,
                    ),
                )
            }
        }

        return findings
    }
}

/**
 * Every started coroutine must reach a terminal state.
 */
class StartedHasTerminalRule : ValidationRule {
    override val id = "lifecycle.started-has-terminal"
    override val name = "Started Has Terminal"
    override val description = "Every started coroutine must reach Completed, Cancelled, or Failed"
    override val category = ValidationCategory.LIFECYCLE
    override val severity = ValidationSeverity.WARNING

    override fun validate(events: List<VizEvent>): List<RuleFinding> {
        val byCoroutine = events.filterIsInstance<CoroutineEvent>().groupBy { it.coroutineId }
        val findings = mutableListOf<RuleFinding>()

        for ((coroutineId, coroutineEvents) in byCoroutine) {
            val hasStarted = coroutineEvents.any { it is CoroutineStarted }
            val hasTerminal = coroutineEvents.any { it.kind in TERMINAL_KINDS }

            if (hasStarted && !hasTerminal) {
                findings.add(
                    RuleFinding(
                        ruleId = id,
                        ruleName = name,
                        severity = severity.name,
                        category = category.name,
                        message = "Coroutine $coroutineId was started but never terminated",
                        suggestion = "This may indicate a leaked coroutine. Ensure structured concurrency or explicit cancellation.",
                        coroutineId = coroutineId,
                    ),
                )
            }
        }

        return findings
    }
}

/**
 * No events should appear for a coroutine after its terminal event.
 */
class NoEventsAfterTerminalRule : ValidationRule {
    override val id = "lifecycle.no-events-after-terminal"
    override val name = "No Events After Terminal"
    override val description = "No lifecycle events should appear after a coroutine's terminal event"
    override val category = ValidationCategory.LIFECYCLE
    override val severity = ValidationSeverity.ERROR

    override fun validate(events: List<VizEvent>): List<RuleFinding> {
        val byCoroutine = events.filterIsInstance<CoroutineEvent>().groupBy { it.coroutineId }
        val findings = mutableListOf<RuleFinding>()

        for ((coroutineId, coroutineEvents) in byCoroutine) {
            val sorted = coroutineEvents.sortedBy { it.seq }
            val terminalEvent = sorted.firstOrNull { it.kind in TERMINAL_KINDS } ?: continue
            val eventsAfter = sorted.filter { it.seq > terminalEvent.seq }

            if (eventsAfter.isNotEmpty()) {
                findings.add(
                    RuleFinding(
                        ruleId = id,
                        ruleName = name,
                        severity = severity.name,
                        category = category.name,
                        message = "Coroutine $coroutineId has ${eventsAfter.size} event(s) after terminal state (${terminalEvent.kind})",
                        suggestion = "This indicates a bug in event ordering or duplicate event emission.",
                        coroutineId = coroutineId,
                        eventSeq = terminalEvent.seq,
                        affectedEntities = eventsAfter.map { "${it.kind}@seq=${it.seq}" },
                    ),
                )
            }
        }

        return findings
    }
}
