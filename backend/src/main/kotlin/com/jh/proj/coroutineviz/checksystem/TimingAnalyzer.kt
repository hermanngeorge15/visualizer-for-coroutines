package com.jh.proj.coroutineviz.checksystem

import com.jh.proj.coroutineviz.events.CoroutineEvent
import com.jh.proj.coroutineviz.events.VizEvent
import com.jh.proj.coroutineviz.events.coroutine.CoroutineCreated
import com.jh.proj.coroutineviz.events.coroutine.CoroutineResumed
import com.jh.proj.coroutineviz.events.coroutine.CoroutineSuspended
import kotlinx.serialization.Serializable

/**
 * Timing report containing duration and suspension analysis.
 *
 * @property coroutineDurations Map of coroutine ID to total duration in nanoseconds
 *                              (from first event to last event)
 * @property suspensionDurations Map of coroutine ID to list of individual suspension
 *                               durations in nanoseconds
 * @property totalDuration Overall duration of the event stream in nanoseconds
 */
@Serializable
data class TimingReport(
    val coroutineDurations: Map<String, Long>,
    val suspensionDurations: Map<String, List<Long>>,
    val totalDuration: Long
)

/**
 * Analyzes timing characteristics of coroutine event streams.
 *
 * Computes:
 * - Per-coroutine durations (first event to last event)
 * - Per-coroutine suspension durations (Suspended to Resumed pairs)
 * - Overall event stream duration
 */
object TimingAnalyzer {

    /**
     * Analyze the given events and produce a [TimingReport].
     *
     * @param events Full event stream (may contain events for multiple coroutines)
     * @return Timing analysis report
     */
    fun analyze(events: List<VizEvent>): TimingReport {
        val coroutineEvents = events.filterIsInstance<CoroutineEvent>()
        val byCoroutine = coroutineEvents.groupBy { it.coroutineId }

        val coroutineDurations = mutableMapOf<String, Long>()
        val suspensionDurations = mutableMapOf<String, List<Long>>()

        for ((coroutineId, cEvents) in byCoroutine) {
            val sorted = cEvents.sortedBy { it.tsNanos }

            // Total duration: first event to last event
            if (sorted.size >= 2) {
                coroutineDurations[coroutineId] = sorted.last().tsNanos - sorted.first().tsNanos
            } else if (sorted.size == 1) {
                coroutineDurations[coroutineId] = 0L
            }

            // Suspension durations: pair Suspended with the next Resumed
            val suspensions = mutableListOf<Long>()
            var lastSuspended: CoroutineSuspended? = null

            for (event in sorted) {
                when (event) {
                    is CoroutineSuspended -> {
                        lastSuspended = event
                    }
                    is CoroutineResumed -> {
                        if (lastSuspended != null) {
                            suspensions.add(event.tsNanos - lastSuspended.tsNanos)
                            lastSuspended = null
                        }
                    }
                    else -> {}
                }
            }

            suspensionDurations[coroutineId] = suspensions
        }

        // Total stream duration
        val totalDuration = if (events.size >= 2) {
            val allTs = events.map { it.tsNanos }
            allTs.max() - allTs.min()
        } else {
            0L
        }

        return TimingReport(
            coroutineDurations = coroutineDurations,
            suspensionDurations = suspensionDurations,
            totalDuration = totalDuration
        )
    }
}
