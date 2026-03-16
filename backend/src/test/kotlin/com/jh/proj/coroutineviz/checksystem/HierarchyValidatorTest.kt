package com.jh.proj.coroutineviz.checksystem

import com.jh.proj.coroutineviz.events.VizEvent
import com.jh.proj.coroutineviz.events.coroutine.CoroutineCompleted
import com.jh.proj.coroutineviz.events.coroutine.CoroutineCreated
import com.jh.proj.coroutineviz.events.coroutine.CoroutineStarted
import org.junit.jupiter.api.Test
import kotlin.test.assertTrue

class HierarchyValidatorTest {

    private fun created(
        coroutineId: String,
        seq: Long,
        parentCoroutineId: String? = null,
        scopeId: String = "scope-1"
    ): CoroutineCreated = CoroutineCreated(
        sessionId = "test-session",
        seq = seq,
        tsNanos = seq * 1000,
        coroutineId = coroutineId,
        jobId = "job-$coroutineId",
        parentCoroutineId = parentCoroutineId,
        scopeId = scopeId,
        label = null
    )

    private fun started(coroutineId: String, seq: Long): CoroutineStarted = CoroutineStarted(
        sessionId = "test-session",
        seq = seq,
        tsNanos = seq * 1000,
        coroutineId = coroutineId,
        jobId = "job-$coroutineId",
        parentCoroutineId = null,
        scopeId = "scope-1",
        label = null
    )

    private fun completed(coroutineId: String, seq: Long): CoroutineCompleted = CoroutineCompleted(
        sessionId = "test-session",
        seq = seq,
        tsNanos = seq * 1000,
        coroutineId = coroutineId,
        jobId = "job-$coroutineId",
        parentCoroutineId = null,
        scopeId = "scope-1",
        label = null
    )

    @Test
    fun `valid hierarchy passes`() {
        val events: List<VizEvent> = listOf(
            created("parent", 1),
            started("parent", 2),
            created("child", 3, parentCoroutineId = "parent"),
            started("child", 4),
            completed("child", 5),
            completed("parent", 6)
        )

        val results = HierarchyValidator.validate(events)
        assertTrue(
            results.all { it is ValidationResult.Pass },
            "Valid hierarchy should pass all checks. Failures: ${results.filterIsInstance<ValidationResult.Fail>()}"
        )
    }

    @Test
    fun `child outliving parent fails`() {
        val events: List<VizEvent> = listOf(
            created("parent", 1),
            started("parent", 2),
            created("child", 3, parentCoroutineId = "parent"),
            started("child", 4),
            completed("parent", 5), // Parent completes before child
            completed("child", 6)
        )

        val results = HierarchyValidator.validate(events)
        val parentBeforeChild = results.filter {
            it.ruleName == "ParentNotCompletedBeforeChildren" && it is ValidationResult.Fail
        }
        assertTrue(
            parentBeforeChild.isNotEmpty(),
            "Should detect parent completing before child"
        )
    }

    @Test
    fun `deeply nested hierarchy validates`() {
        val events: List<VizEvent> = listOf(
            created("root", 1),
            started("root", 2),
            created("mid", 3, parentCoroutineId = "root"),
            started("mid", 4),
            created("leaf", 5, parentCoroutineId = "mid"),
            started("leaf", 6),
            completed("leaf", 7),
            completed("mid", 8),
            completed("root", 9)
        )

        val results = HierarchyValidator.validate(events)
        assertTrue(
            results.all { it is ValidationResult.Pass },
            "Deeply nested hierarchy should pass. Failures: ${results.filterIsInstance<ValidationResult.Fail>()}"
        )
    }

    @Test
    fun `child created before parent fails`() {
        val events: List<VizEvent> = listOf(
            created("child", 1, parentCoroutineId = "parent"),
            created("parent", 2),
            started("parent", 3),
            started("child", 4),
            completed("child", 5),
            completed("parent", 6)
        )

        val results = HierarchyValidator.validate(events)
        val scopeCheck = results.filter {
            it.ruleName == "ChildCreatedWithinParentScope" && it is ValidationResult.Fail
        }
        assertTrue(
            scopeCheck.isNotEmpty(),
            "Should detect child created before parent"
        )
    }
}
