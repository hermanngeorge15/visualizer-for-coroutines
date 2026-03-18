package com.jh.proj.coroutineviz.validation.rules

import com.jh.proj.coroutineviz.events.VizEvent
import com.jh.proj.coroutineviz.validation.RuleFinding
import com.jh.proj.coroutineviz.validation.ValidationCategory
import com.jh.proj.coroutineviz.validation.ValidationRule
import com.jh.proj.coroutineviz.validation.ValidationSeverity

/**
 * No two events should share the same sequence number.
 */
class NoDuplicateSequenceNumbersRule : ValidationRule {
    override val id = "sequence.no-duplicates"
    override val name = "No Duplicate Sequence Numbers"
    override val description = "No two events should share the same sequence number"
    override val category = ValidationCategory.LIFECYCLE
    override val severity = ValidationSeverity.ERROR

    override fun validate(events: List<VizEvent>): List<RuleFinding> {
        val findings = mutableListOf<RuleFinding>()
        val seenSeqs = mutableMapOf<Long, VizEvent>()

        for (event in events) {
            val existing = seenSeqs[event.seq]
            if (existing != null) {
                findings.add(
                    RuleFinding(
                        ruleId = id,
                        ruleName = name,
                        severity = severity.name,
                        category = category.name,
                        message = "Duplicate sequence number ${event.seq}: ${existing.kind} and ${event.kind}",
                        suggestion = "Ensure the sequence generator is thread-safe (AtomicLong). This may indicate a concurrency bug.",
                        eventSeq = event.seq,
                    ),
                )
            } else {
                seenSeqs[event.seq] = event
            }
        }

        return findings
    }
}

/**
 * Events should have monotonically increasing timestamps within a session.
 */
class MonotonicTimestampsRule : ValidationRule {
    override val id = "sequence.monotonic-timestamps"
    override val name = "Monotonic Timestamps"
    override val description = "Event timestamps should be monotonically increasing"
    override val category = ValidationCategory.LIFECYCLE
    override val severity = ValidationSeverity.WARNING

    override fun validate(events: List<VizEvent>): List<RuleFinding> {
        val findings = mutableListOf<RuleFinding>()
        val sorted = events.sortedBy { it.seq }

        for (i in 1 until sorted.size) {
            if (sorted[i].tsNanos < sorted[i - 1].tsNanos) {
                findings.add(
                    RuleFinding(
                        ruleId = id,
                        ruleName = name,
                        severity = severity.name,
                        category = category.name,
                        message =
                            "Event seq=${sorted[i].seq} (${sorted[i].kind}) has earlier timestamp " +
                                "than seq=${sorted[i - 1].seq} (${sorted[i - 1].kind})",
                        suggestion =
                            "Timestamps should increase with sequence numbers. This may indicate events " +
                                "were processed out of order.",
                        eventSeq = sorted[i].seq,
                    ),
                )
            }
        }

        return findings
    }
}
