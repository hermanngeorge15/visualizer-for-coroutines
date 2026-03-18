package com.jh.proj.coroutineviz.validation.rules

import com.jh.proj.coroutineviz.events.CoroutineEvent
import com.jh.proj.coroutineviz.events.VizEvent
import com.jh.proj.coroutineviz.events.coroutine.CoroutineCompleted
import com.jh.proj.coroutineviz.events.coroutine.CoroutineCreated
import com.jh.proj.coroutineviz.validation.RuleFinding
import com.jh.proj.coroutineviz.validation.ValidationCategory
import com.jh.proj.coroutineviz.validation.ValidationRule
import com.jh.proj.coroutineviz.validation.ValidationSeverity

private val TERMINAL_KINDS = setOf("CoroutineCompleted", "CoroutineCancelled", "CoroutineFailed")

/**
 * Children must be created after their parent is created.
 */
class ChildCreatedAfterParentRule : ValidationRule {
    override val id = "hierarchy.child-created-after-parent"
    override val name = "Child Created After Parent"
    override val description = "Children must be created after their parent coroutine"
    override val category = ValidationCategory.STRUCTURED_CONCURRENCY
    override val severity = ValidationSeverity.ERROR

    override fun validate(events: List<VizEvent>): List<RuleFinding> {
        val coroutineEvents = events.filterIsInstance<CoroutineEvent>()
        val byCoroutine = coroutineEvents.groupBy { it.coroutineId }
        val createEvents = coroutineEvents.filterIsInstance<CoroutineCreated>()
        val findings = mutableListOf<RuleFinding>()

        for (childCreated in createEvents) {
            val parentId = childCreated.parentCoroutineId ?: continue
            val parentEvents = byCoroutine[parentId]

            if (parentEvents == null) {
                findings.add(
                    RuleFinding(
                        ruleId = id,
                        ruleName = name,
                        severity = severity.name,
                        category = category.name,
                        message = "Child ${childCreated.coroutineId} references non-existent parent $parentId",
                        suggestion = "Verify parent coroutine exists and is properly instrumented.",
                        coroutineId = childCreated.coroutineId,
                        eventSeq = childCreated.seq,
                    ),
                )
                continue
            }

            val parentCreated = parentEvents.filterIsInstance<CoroutineCreated>().firstOrNull()
            if (parentCreated != null && childCreated.seq <= parentCreated.seq) {
                findings.add(
                    RuleFinding(
                        ruleId = id,
                        ruleName = name,
                        severity = severity.name,
                        category = category.name,
                        message =
                            "Child ${childCreated.coroutineId} created (seq=${childCreated.seq}) " +
                                "before parent $parentId (seq=${parentCreated.seq})",
                        suggestion = "This indicates incorrect parent-child relationship or event ordering.",
                        coroutineId = childCreated.coroutineId,
                        eventSeq = childCreated.seq,
                        affectedEntities = listOf(parentId),
                    ),
                )
            }
        }

        return findings
    }
}

/**
 * Parent must not complete before all children have terminated.
 */
class ParentWaitsForChildrenRule : ValidationRule {
    override val id = "hierarchy.parent-waits-for-children"
    override val name = "Parent Waits For Children"
    override val description = "Parent must not complete before all children (structured concurrency)"
    override val category = ValidationCategory.STRUCTURED_CONCURRENCY
    override val severity = ValidationSeverity.ERROR

    override fun validate(events: List<VizEvent>): List<RuleFinding> {
        val coroutineEvents = events.filterIsInstance<CoroutineEvent>()
        val byCoroutine = coroutineEvents.groupBy { it.coroutineId }
        val createEvents = coroutineEvents.filterIsInstance<CoroutineCreated>()
        val findings = mutableListOf<RuleFinding>()

        for (childCreated in createEvents) {
            val parentId = childCreated.parentCoroutineId ?: continue
            val parentEvents = byCoroutine[parentId] ?: continue
            val childEvents = byCoroutine[childCreated.coroutineId] ?: continue

            val parentCompleted = parentEvents.firstOrNull { it is CoroutineCompleted } ?: continue
            val childTerminal = childEvents.firstOrNull { it.kind in TERMINAL_KINDS }

            if (childTerminal == null || parentCompleted.seq < childTerminal.seq) {
                findings.add(
                    RuleFinding(
                        ruleId = id,
                        ruleName = name,
                        severity = severity.name,
                        category = category.name,
                        message =
                            "Parent $parentId completed (seq=${parentCompleted.seq}) before child ${childCreated.coroutineId}" +
                                if (childTerminal != null) " terminated (seq=${childTerminal.seq})" else " terminated",
                        suggestion = "Use structured concurrency (coroutineScope, supervisorScope) to ensure parent waits for children.",
                        coroutineId = childCreated.coroutineId,
                        eventSeq = parentCompleted.seq,
                        affectedEntities = listOf(parentId),
                    ),
                )
            }
        }

        return findings
    }
}
