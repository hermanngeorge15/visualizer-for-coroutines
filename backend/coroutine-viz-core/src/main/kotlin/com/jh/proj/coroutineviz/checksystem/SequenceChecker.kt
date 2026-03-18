package com.jh.proj.coroutineviz.checksystem

import com.jh.proj.coroutineviz.events.VizEvent

/**
 * Validates event ordering and sequence number integrity.
 *
 * Checks that events appear in the expected order and that
 * sequence numbers are unique across the event stream.
 */
object SequenceChecker {
    /**
     * Check that event types appear in the expected order within the event list.
     *
     * This does not require the events to be strictly contiguous -- other event
     * types may appear between the expected ones. It only verifies that the
     * relative order of the specified kinds is preserved.
     *
     * @param events The event list to check (should be sorted by sequence number)
     * @param expectedSequence List of event kind strings in expected order
     * @return [ValidationResult.Pass] if order is correct, [ValidationResult.Fail] otherwise
     */
    fun checkOrdering(
        events: List<VizEvent>,
        expectedSequence: List<String>,
    ): ValidationResult {
        val ruleName = "EventOrdering"

        if (expectedSequence.isEmpty()) {
            return ValidationResult.Pass(ruleName, "Empty expected sequence, nothing to check")
        }

        val sortedEvents = events.sortedBy { it.seq }
        var expectedIndex = 0

        for (event in sortedEvents) {
            if (expectedIndex < expectedSequence.size && event.kind == expectedSequence[expectedIndex]) {
                expectedIndex++
            }
        }

        return if (expectedIndex == expectedSequence.size) {
            ValidationResult.Pass(
                ruleName,
                "All ${expectedSequence.size} expected event types found in correct order",
            )
        } else {
            val missing = expectedSequence.subList(expectedIndex, expectedSequence.size)
            ValidationResult.Fail(
                ruleName,
                "Event ordering violation",
                "Expected event types not found in order. " +
                    "Matched $expectedIndex/${expectedSequence.size}. " +
                    "Missing or out-of-order: $missing",
            )
        }
    }

    /**
     * Check that no two events share the same sequence number.
     *
     * Duplicate sequence numbers indicate a bug in the event emission logic,
     * as each event should have a globally unique sequence number within a session.
     *
     * @param events The event list to check
     * @return [ValidationResult.Pass] if all sequence numbers are unique,
     *         [ValidationResult.Fail] if duplicates are found
     */
    fun checkNoDuplicateSequenceNumbers(events: List<VizEvent>): ValidationResult {
        val ruleName = "NoDuplicateSequenceNumbers"

        val seqCounts = events.groupBy { it.seq }.filter { it.value.size > 1 }

        return if (seqCounts.isEmpty()) {
            ValidationResult.Pass(
                ruleName,
                "All ${events.size} events have unique sequence numbers",
            )
        } else {
            val duplicates =
                seqCounts.map { (seq, evts) ->
                    "seq=$seq appears ${evts.size} times (kinds: ${evts.map { it.kind }})"
                }
            ValidationResult.Fail(
                ruleName,
                "Duplicate sequence numbers detected",
                "Found ${seqCounts.size} duplicate sequence number(s): ${duplicates.joinToString("; ")}",
            )
        }
    }
}
