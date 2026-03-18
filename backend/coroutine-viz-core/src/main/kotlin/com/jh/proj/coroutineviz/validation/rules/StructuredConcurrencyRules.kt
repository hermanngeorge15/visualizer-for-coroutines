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
 * Parent cancellation should propagate to children.
 */
class CancellationPropagationRule : ValidationRule {
    override val id = "structured-concurrency.cancellation-propagation"
    override val name = "Cancellation Propagation"
    override val description = "Parent cancellation should cause children to be cancelled"
    override val category = ValidationCategory.STRUCTURED_CONCURRENCY
    override val severity = ValidationSeverity.WARNING

    override fun validate(events: List<VizEvent>): List<RuleFinding> {
        val coroutineEvents = events.filterIsInstance<CoroutineEvent>()
        val byCoroutine = coroutineEvents.groupBy { it.coroutineId }
        val createEvents = coroutineEvents.filterIsInstance<CoroutineCreated>()
        val findings = mutableListOf<RuleFinding>()

        // Find cancelled parents
        val cancelledParents =
            coroutineEvents
                .filterIsInstance<CoroutineCancelled>()
                .map { it.coroutineId }
                .toSet()

        // Build parent -> children map
        val childrenOf = mutableMapOf<String, MutableList<String>>()
        for (created in createEvents) {
            val parentId = created.parentCoroutineId ?: continue
            childrenOf.getOrPut(parentId) { mutableListOf() }.add(created.coroutineId)
        }

        for (parentId in cancelledParents) {
            val children = childrenOf[parentId] ?: continue
            for (childId in children) {
                val childEvents = byCoroutine[childId] ?: continue
                val childCancelled = childEvents.any { it is CoroutineCancelled }
                val childFailed = childEvents.any { it is CoroutineFailed }

                if (!childCancelled && !childFailed) {
                    findings.add(
                        RuleFinding(
                            ruleId = id,
                            ruleName = name,
                            severity = severity.name,
                            category = category.name,
                            message = "Parent $parentId was cancelled but child $childId was not cancelled",
                            suggestion =
                                "Ensure children respect cancellation. This may indicate the child is running " +
                                    "in a non-cooperative way (e.g., blocking without checking isActive).",
                            coroutineId = childId,
                            affectedEntities = listOf(parentId, childId),
                        ),
                    )
                }
            }
        }

        return findings
    }
}

/**
 * Child failure should propagate to parent (unless SupervisorJob).
 */
class ChildFailurePropagationRule : ValidationRule {
    override val id = "structured-concurrency.child-failure-propagation"
    override val name = "Child Failure Propagation"
    override val description = "Child failure should propagate to parent (unless SupervisorJob)"
    override val category = ValidationCategory.STRUCTURED_CONCURRENCY
    override val severity = ValidationSeverity.INFO

    override fun validate(events: List<VizEvent>): List<RuleFinding> {
        val coroutineEvents = events.filterIsInstance<CoroutineEvent>()
        val byCoroutine = coroutineEvents.groupBy { it.coroutineId }
        val createEvents = coroutineEvents.filterIsInstance<CoroutineCreated>()
        val findings = mutableListOf<RuleFinding>()

        // Find failed children
        val failedChildren =
            coroutineEvents
                .filterIsInstance<CoroutineFailed>()
                .map { it.coroutineId }
                .toSet()

        for (created in createEvents) {
            if (created.coroutineId !in failedChildren) continue
            val parentId = created.parentCoroutineId ?: continue
            val parentEvents = byCoroutine[parentId] ?: continue

            val parentFailed = parentEvents.any { it is CoroutineFailed }
            val parentCancelled = parentEvents.any { it is CoroutineCancelled }

            // If parent didn't fail or get cancelled, it might be using SupervisorJob
            if (!parentFailed && !parentCancelled) {
                findings.add(
                    RuleFinding(
                        ruleId = id,
                        ruleName = name,
                        severity = severity.name,
                        category = category.name,
                        message =
                            "Child ${created.coroutineId} failed but parent $parentId was not affected. " +
                                "Parent may be using SupervisorJob.",
                        suggestion =
                            "If this is intentional (SupervisorJob), this is expected. Otherwise, ensure " +
                                "exception propagation is working correctly.",
                        coroutineId = created.coroutineId,
                        affectedEntities = listOf(parentId, created.coroutineId),
                    ),
                )
            }
        }

        return findings
    }
}
