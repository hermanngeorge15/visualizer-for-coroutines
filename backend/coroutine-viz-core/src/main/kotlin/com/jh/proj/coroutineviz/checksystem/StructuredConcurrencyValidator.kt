package com.jh.proj.coroutineviz.checksystem

import com.jh.proj.coroutineviz.events.CoroutineEvent
import com.jh.proj.coroutineviz.events.VizEvent
import com.jh.proj.coroutineviz.events.coroutine.CoroutineCancelled
import com.jh.proj.coroutineviz.events.coroutine.CoroutineCreated
import com.jh.proj.coroutineviz.events.coroutine.CoroutineFailed

/**
 * Validates structured concurrency rules across an event stream.
 *
 * Rules enforced:
 * - Parent cancellation should cause children to be cancelled
 * - Child failure should propagate to parent (unless SupervisorJob)
 */
object StructuredConcurrencyValidator {
    /**
     * Run all structured concurrency validation rules against the given event list.
     *
     * @param events Full event stream (may contain events for multiple coroutines)
     * @return List of [ValidationResult] -- one per rule per relevant relationship
     */
    fun validate(events: List<VizEvent>): List<ValidationResult> {
        val results = mutableListOf<ValidationResult>()

        val coroutineEvents = events.filterIsInstance<CoroutineEvent>()
        val byCoroutine = coroutineEvents.groupBy { it.coroutineId }

        // Build parent -> children map
        val parentToChildren = mutableMapOf<String, MutableList<String>>()
        val createEvents = coroutineEvents.filterIsInstance<CoroutineCreated>()

        for (created in createEvents) {
            val parentId = created.parentCoroutineId ?: continue
            parentToChildren.getOrPut(parentId) { mutableListOf() }.add(created.coroutineId)
        }

        if (parentToChildren.isEmpty()) {
            results +=
                ValidationResult.Pass(
                    "StructuredConcurrency",
                    "No parent-child relationships to validate",
                )
            return results
        }

        results += checkParentCancellationPropagation(byCoroutine, parentToChildren)
        results += checkChildFailurePropagation(byCoroutine, parentToChildren)

        return results
    }

    private fun checkParentCancellationPropagation(
        byCoroutine: Map<String, List<CoroutineEvent>>,
        parentToChildren: Map<String, List<String>>,
    ): List<ValidationResult> {
        val results = mutableListOf<ValidationResult>()
        val ruleName = "ParentCancellationPropagation"

        for ((parentId, childIds) in parentToChildren) {
            val parentEvents = byCoroutine[parentId] ?: continue
            val parentCancelled = parentEvents.firstOrNull { it is CoroutineCancelled } ?: continue

            for (childId in childIds) {
                val childEvents = byCoroutine[childId] ?: continue
                val childCancelled = childEvents.firstOrNull { it is CoroutineCancelled }
                val childFailed = childEvents.firstOrNull { it is CoroutineFailed }

                // Child should be cancelled or failed (failure could trigger the parent cancel)
                if (childCancelled != null || childFailed != null) {
                    results +=
                        ValidationResult.Pass(
                            ruleName,
                            "Parent $parentId cancelled -> child $childId also terminated",
                        )
                } else {
                    // Check if child completed before parent was cancelled (which is fine)
                    val childTerminal =
                        childEvents.firstOrNull {
                            it.kind in setOf("CoroutineCompleted", "CoroutineCancelled", "CoroutineFailed")
                        }

                    if (childTerminal != null && childTerminal.seq < parentCancelled.seq) {
                        results +=
                            ValidationResult.Pass(
                                ruleName,
                                "Child $childId completed (seq=${childTerminal.seq}) before parent " +
                                    "$parentId cancelled (seq=${parentCancelled.seq})",
                            )
                    } else {
                        results +=
                            ValidationResult.Fail(
                                ruleName,
                                "Parent $parentId cancelled but child $childId was not cancelled",
                                "Parent cancelled at seq=${parentCancelled.seq} but child $childId " +
                                    "has no cancellation or failure event",
                            )
                    }
                }
            }
        }

        if (results.isEmpty()) {
            results += ValidationResult.Pass(ruleName, "No parent cancellations to validate")
        }

        return results
    }

    private fun checkChildFailurePropagation(
        byCoroutine: Map<String, List<CoroutineEvent>>,
        parentToChildren: Map<String, List<String>>,
    ): List<ValidationResult> {
        val results = mutableListOf<ValidationResult>()
        val ruleName = "ChildFailurePropagation"

        for ((parentId, childIds) in parentToChildren) {
            val parentEvents = byCoroutine[parentId] ?: continue

            for (childId in childIds) {
                val childEvents = byCoroutine[childId] ?: continue
                val childFailed = childEvents.firstOrNull { it is CoroutineFailed } ?: continue

                // Child failed -- parent should eventually be cancelled or failed
                // (unless using SupervisorJob)
                val parentTerminal =
                    parentEvents.firstOrNull {
                        it.kind in setOf("CoroutineCancelled", "CoroutineFailed")
                    }

                if (parentTerminal != null) {
                    results +=
                        ValidationResult.Pass(
                            ruleName,
                            "Child $childId failed -> parent $parentId also terminated (${parentTerminal.kind})",
                        )
                } else {
                    // Parent may have completed normally if it's a SupervisorJob
                    val parentCompleted = parentEvents.firstOrNull { it.kind == "CoroutineCompleted" }
                    if (parentCompleted != null) {
                        results +=
                            ValidationResult.Pass(
                                ruleName,
                                "Child $childId failed but parent $parentId completed (likely SupervisorJob)",
                            )
                    } else {
                        results +=
                            ValidationResult.Fail(
                                ruleName,
                                "Child $childId failed but parent $parentId did not terminate",
                                "Child failed at seq=${childFailed.seq} but parent $parentId " +
                                    "has no terminal event (expected cancellation or failure propagation)",
                            )
                    }
                }
            }
        }

        if (results.isEmpty()) {
            results += ValidationResult.Pass(ruleName, "No child failures to validate")
        }

        return results
    }
}
