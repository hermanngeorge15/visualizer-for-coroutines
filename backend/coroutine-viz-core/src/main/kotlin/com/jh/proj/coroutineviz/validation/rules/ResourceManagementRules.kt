package com.jh.proj.coroutineviz.validation.rules

import com.jh.proj.coroutineviz.events.MutexLockAcquired
import com.jh.proj.coroutineviz.events.MutexUnlocked
import com.jh.proj.coroutineviz.events.SemaphorePermitAcquired
import com.jh.proj.coroutineviz.events.SemaphorePermitReleased
import com.jh.proj.coroutineviz.events.VizEvent
import com.jh.proj.coroutineviz.events.channel.ChannelClosed
import com.jh.proj.coroutineviz.events.channel.ChannelCreated
import com.jh.proj.coroutineviz.validation.RuleFinding
import com.jh.proj.coroutineviz.validation.ValidationCategory
import com.jh.proj.coroutineviz.validation.ValidationRule
import com.jh.proj.coroutineviz.validation.ValidationSeverity

/**
 * Detect channels that are created but never closed.
 */
class UnclosedChannelRule : ValidationRule {
    override val id = "resource.unclosed-channel"
    override val name = "Unclosed Channel"
    override val description = "Detect channels that are created but never closed"
    override val category = ValidationCategory.RESOURCE_MANAGEMENT
    override val severity = ValidationSeverity.WARNING

    override fun validate(events: List<VizEvent>): List<RuleFinding> {
        val findings = mutableListOf<RuleFinding>()
        val created = events.filterIsInstance<ChannelCreated>().map { it.channelId }.toSet()
        val closed = events.filterIsInstance<ChannelClosed>().map { it.channelId }.toSet()

        val unclosed = created - closed
        for (channelId in unclosed) {
            findings.add(
                RuleFinding(
                    ruleId = id,
                    ruleName = name,
                    severity = severity.name,
                    category = category.name,
                    message = "Channel $channelId was created but never closed",
                    suggestion = "Always close channels when done. Use channel.close() or the produce { } builder which auto-closes.",
                    affectedEntities = listOf(channelId),
                ),
            )
        }

        return findings
    }
}

/**
 * Detect mutex locks that are acquired but never released.
 */
class MutexLockLeakRule : ValidationRule {
    override val id = "resource.mutex-lock-leak"
    override val name = "Mutex Lock Leak"
    override val description = "Detect mutex locks that are acquired but never released"
    override val category = ValidationCategory.RESOURCE_MANAGEMENT
    override val severity = ValidationSeverity.ERROR

    override fun validate(events: List<VizEvent>): List<RuleFinding> {
        val findings = mutableListOf<RuleFinding>()

        val acquires = events.filterIsInstance<MutexLockAcquired>().groupBy { it.mutexId }
        val releases = events.filterIsInstance<MutexUnlocked>().groupBy { it.mutexId }

        for ((mutexId, acqs) in acquires) {
            val rels = releases[mutexId] ?: emptyList()
            if (acqs.size > rels.size) {
                findings.add(
                    RuleFinding(
                        ruleId = id,
                        ruleName = name,
                        severity = severity.name,
                        category = category.name,
                        message = "Mutex $mutexId has ${acqs.size} acquires but only ${rels.size} releases",
                        suggestion = "Always use mutex.withLock { } instead of manual lock/unlock to prevent leaks from exceptions.",
                        affectedEntities = listOf(mutexId),
                    ),
                )
            }
        }

        return findings
    }
}

/**
 * Detect semaphore permits that are acquired but never released.
 */
class SemaphorePermitLeakRule : ValidationRule {
    override val id = "resource.semaphore-permit-leak"
    override val name = "Semaphore Permit Leak"
    override val description = "Detect semaphore permits that are acquired but never released"
    override val category = ValidationCategory.RESOURCE_MANAGEMENT
    override val severity = ValidationSeverity.ERROR

    override fun validate(events: List<VizEvent>): List<RuleFinding> {
        val findings = mutableListOf<RuleFinding>()

        val acquires = events.filterIsInstance<SemaphorePermitAcquired>().groupBy { it.semaphoreId }
        val releases = events.filterIsInstance<SemaphorePermitReleased>().groupBy { it.semaphoreId }

        for ((semaphoreId, acqs) in acquires) {
            val rels = releases[semaphoreId] ?: emptyList()
            if (acqs.size > rels.size) {
                findings.add(
                    RuleFinding(
                        ruleId = id,
                        ruleName = name,
                        severity = severity.name,
                        category = category.name,
                        message = "Semaphore $semaphoreId has ${acqs.size} acquires but only ${rels.size} releases",
                        suggestion =
                            "Always use semaphore.withPermit { } instead of manual acquire/release " +
                                "to prevent leaks from exceptions.",
                        affectedEntities = listOf(semaphoreId),
                    ),
                )
            }
        }

        return findings
    }
}

/**
 * Detect buffer overflow events indicating silent data loss.
 */
class BufferOverflowSilentRule : ValidationRule {
    override val id = "resource.buffer-overflow-silent"
    override val name = "Silent Buffer Overflow"
    override val description = "Detect Flow buffer overflows that silently drop values"
    override val category = ValidationCategory.RESOURCE_MANAGEMENT
    override val severity = ValidationSeverity.WARNING

    override fun validate(events: List<VizEvent>): List<RuleFinding> {
        val findings = mutableListOf<RuleFinding>()
        val overflows = events.filter { it.kind == "FlowBufferOverflow" }

        if (overflows.isNotEmpty()) {
            val byFlow = overflows.groupBy { (it as? com.jh.proj.coroutineviz.events.flow.FlowBufferOverflow)?.flowId ?: "unknown" }
            for ((flowId, flowOverflows) in byFlow) {
                findings.add(
                    RuleFinding(
                        ruleId = id,
                        ruleName = name,
                        severity = severity.name,
                        category = category.name,
                        message = "Flow $flowId had ${flowOverflows.size} buffer overflow(s) — values may have been silently dropped",
                        suggestion = "Increase buffer size, use a different overflow strategy, or slow down the producer.",
                        affectedEntities = listOf(flowId),
                        eventSeq = flowOverflows.first().seq,
                    ),
                )
            }
        }

        return findings
    }
}
