package com.jh.proj.coroutineviz.validation.rules

import com.jh.proj.coroutineviz.events.VizEvent
import com.jh.proj.coroutineviz.events.dispatcher.DispatcherSelected
import com.jh.proj.coroutineviz.events.dispatcher.ThreadAssigned
import com.jh.proj.coroutineviz.validation.RuleFinding
import com.jh.proj.coroutineviz.validation.ValidationCategory
import com.jh.proj.coroutineviz.validation.ValidationRule
import com.jh.proj.coroutineviz.validation.ValidationSeverity

/**
 * Detect coroutines that may be running on an inappropriate dispatcher.
 * E.g., I/O work on Default, or CPU work on IO.
 */
class WrongDispatcherRule : ValidationRule {
    override val id = "threading.wrong-dispatcher"
    override val name = "Wrong Dispatcher"
    override val description = "Detect coroutines that may be on an inappropriate dispatcher"
    override val category = ValidationCategory.THREADING
    override val severity = ValidationSeverity.INFO

    override fun validate(events: List<VizEvent>): List<RuleFinding> {
        // This rule needs semantic information about what the coroutine does,
        // which we don't have from events alone. We can flag heuristics:
        // - Multiple dispatcher switches for a single coroutine (unnecessary withContext)
        val findings = mutableListOf<RuleFinding>()
        val dispatchers = events.filterIsInstance<DispatcherSelected>()
        val byCoroutine = dispatchers.groupBy { it.coroutineId }

        for ((coroutineId, dispatcherEvents) in byCoroutine) {
            val uniqueDispatchers = dispatcherEvents.map { it.dispatcherName }.distinct()
            if (uniqueDispatchers.size > 3) {
                findings.add(
                    RuleFinding(
                        ruleId = id,
                        ruleName = name,
                        severity = severity.name,
                        category = category.name,
                        message =
                            "Coroutine $coroutineId switched between ${uniqueDispatchers.size} " +
                                "dispatchers: ${uniqueDispatchers.joinToString()}",
                        suggestion = "Frequent dispatcher switching adds overhead. Consider consolidating work on fewer dispatchers.",
                        coroutineId = coroutineId,
                    ),
                )
            }
        }

        return findings
    }
}

/**
 * Detect potential shared mutable state access from multiple dispatchers.
 */
class SharedMutableStateRule : ValidationRule {
    override val id = "threading.shared-mutable-state"
    override val name = "Shared Mutable State Risk"
    override val description = "Detect coroutines accessing shared state from different threads"
    override val category = ValidationCategory.THREADING
    override val severity = ValidationSeverity.WARNING

    override fun validate(events: List<VizEvent>): List<RuleFinding> {
        // Heuristic: if multiple coroutines share the same scope but run on different threads,
        // they may have shared state issues
        val findings = mutableListOf<RuleFinding>()
        val threadAssignments = events.filterIsInstance<ThreadAssigned>()
        val byScopeId = threadAssignments.groupBy { it.scopeId }

        for ((scopeId, assignments) in byScopeId) {
            val uniqueThreads = assignments.map { it.threadId }.distinct()
            val uniqueCoroutines = assignments.map { it.coroutineId }.distinct()

            if (uniqueThreads.size > 1 && uniqueCoroutines.size > 2) {
                findings.add(
                    RuleFinding(
                        ruleId = id,
                        ruleName = name,
                        severity = severity.name,
                        category = category.name,
                        message = "Scope $scopeId has ${uniqueCoroutines.size} coroutines across ${uniqueThreads.size} threads",
                        suggestion =
                            "If coroutines in this scope share mutable state, consider using Mutex, atomic " +
                                "operations, or confining state to a single thread " +
                                "(Dispatchers.Main or newSingleThreadContext).",
                        affectedEntities = uniqueCoroutines,
                    ),
                )
            }
        }

        return findings
    }
}
