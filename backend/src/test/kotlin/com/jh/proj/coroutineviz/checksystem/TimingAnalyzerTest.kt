package com.jh.proj.coroutineviz.checksystem

import com.jh.proj.coroutineviz.events.VizEvent
import com.jh.proj.coroutineviz.events.coroutine.*
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class TimingAnalyzerTest {

    private fun created(coroutineId: String, seq: Long, tsNanos: Long): CoroutineCreated =
        CoroutineCreated(
            sessionId = "test-session",
            seq = seq,
            tsNanos = tsNanos,
            coroutineId = coroutineId,
            jobId = "job-$coroutineId",
            parentCoroutineId = null,
            scopeId = "scope-1",
            label = null
        )

    private fun started(coroutineId: String, seq: Long, tsNanos: Long): CoroutineStarted =
        CoroutineStarted(
            sessionId = "test-session",
            seq = seq,
            tsNanos = tsNanos,
            coroutineId = coroutineId,
            jobId = "job-$coroutineId",
            parentCoroutineId = null,
            scopeId = "scope-1",
            label = null
        )

    private fun suspended(coroutineId: String, seq: Long, tsNanos: Long): CoroutineSuspended =
        CoroutineSuspended(
            sessionId = "test-session",
            seq = seq,
            tsNanos = tsNanos,
            coroutineId = coroutineId,
            jobId = "job-$coroutineId",
            parentCoroutineId = null,
            scopeId = "scope-1",
            label = null,
            reason = "delay"
        )

    private fun resumed(coroutineId: String, seq: Long, tsNanos: Long): CoroutineResumed =
        CoroutineResumed(
            sessionId = "test-session",
            seq = seq,
            tsNanos = tsNanos,
            coroutineId = coroutineId,
            jobId = "job-$coroutineId",
            parentCoroutineId = null,
            scopeId = "scope-1",
            label = null
        )

    private fun completed(coroutineId: String, seq: Long, tsNanos: Long): CoroutineCompleted =
        CoroutineCompleted(
            sessionId = "test-session",
            seq = seq,
            tsNanos = tsNanos,
            coroutineId = coroutineId,
            jobId = "job-$coroutineId",
            parentCoroutineId = null,
            scopeId = "scope-1",
            label = null
        )

    @Test
    fun `duration calculation correct`() {
        val events: List<VizEvent> = listOf(
            created("c1", 1, tsNanos = 1000),
            started("c1", 2, tsNanos = 2000),
            completed("c1", 3, tsNanos = 5000)
        )

        val report = TimingAnalyzer.analyze(events)

        assertEquals(4000L, report.coroutineDurations["c1"], "Duration should be last - first tsNanos")
        assertEquals(4000L, report.totalDuration, "Total duration should cover entire stream")
    }

    @Test
    fun `suspension durations tracked`() {
        val events: List<VizEvent> = listOf(
            created("c1", 1, tsNanos = 1000),
            started("c1", 2, tsNanos = 2000),
            suspended("c1", 3, tsNanos = 3000),
            resumed("c1", 4, tsNanos = 5000),  // 2000ns suspension
            suspended("c1", 5, tsNanos = 6000),
            resumed("c1", 6, tsNanos = 9000),  // 3000ns suspension
            completed("c1", 7, tsNanos = 10000)
        )

        val report = TimingAnalyzer.analyze(events)

        val suspensions = report.suspensionDurations["c1"]!!
        assertEquals(2, suspensions.size, "Should have 2 suspension periods")
        assertEquals(2000L, suspensions[0], "First suspension should be 2000ns")
        assertEquals(3000L, suspensions[1], "Second suspension should be 3000ns")
    }

    @Test
    fun `report includes all coroutines`() {
        val events: List<VizEvent> = listOf(
            created("c1", 1, tsNanos = 1000),
            started("c1", 2, tsNanos = 2000),
            created("c2", 3, tsNanos = 3000),
            started("c2", 4, tsNanos = 4000),
            completed("c1", 5, tsNanos = 5000),
            completed("c2", 6, tsNanos = 8000)
        )

        val report = TimingAnalyzer.analyze(events)

        assertTrue(report.coroutineDurations.containsKey("c1"), "Report should include c1")
        assertTrue(report.coroutineDurations.containsKey("c2"), "Report should include c2")
        assertEquals(4000L, report.coroutineDurations["c1"], "c1 duration: 5000 - 1000")
        assertEquals(5000L, report.coroutineDurations["c2"], "c2 duration: 8000 - 3000")
        assertEquals(7000L, report.totalDuration, "Total duration: 8000 - 1000")
    }

    @Test
    fun `empty events produce empty report`() {
        val report = TimingAnalyzer.analyze(emptyList())

        assertTrue(report.coroutineDurations.isEmpty(), "No coroutines in empty report")
        assertTrue(report.suspensionDurations.isEmpty(), "No suspensions in empty report")
        assertEquals(0L, report.totalDuration, "Total duration should be 0 for empty events")
    }
}
