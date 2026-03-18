package com.jh.proj.coroutineviz.wrappers

import com.jh.proj.coroutineviz.events.coroutine.CoroutineResumed
import com.jh.proj.coroutineviz.events.coroutine.CoroutineSuspended
import com.jh.proj.coroutineviz.events.deferred.DeferredAwaitCompleted
import com.jh.proj.coroutineviz.events.deferred.DeferredAwaitStarted
import com.jh.proj.coroutineviz.events.deferred.DeferredValueAvailable
import com.jh.proj.coroutineviz.session.VizSession
import kotlinx.coroutines.test.runTest
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class InstrumentedDeferredTest {
    private lateinit var session: VizSession

    @BeforeEach
    fun setup() {
        session = VizSession("test-deferred-${System.currentTimeMillis()}")
    }

    // ========================================================================
    // CREATION / VALUE AVAILABLE TESTS
    // ========================================================================

    @Test
    fun `vizAsync creates coroutine with DeferredValueAvailable on completion`() =
        runTest {
            val scope = VizScope(session, coroutineContext)

            val deferred =
                scope.vizAsync("compute") {
                    42
                }

            // Wait for the async block to complete
            deferred.await()

            val allEvents = session.store.all()

            // DeferredValueAvailable should be emitted when the async body completes
            val valueAvailableEvents = allEvents.filterIsInstance<DeferredValueAvailable>()
            assertEquals(1, valueAvailableEvents.size)
            assertEquals("compute", valueAvailableEvents.first().label)
        }

    // ========================================================================
    // AWAIT LIFECYCLE TESTS
    // ========================================================================

    @Test
    fun `await emits DeferredAwaitStarted and DeferredAwaitCompleted`() =
        runTest {
            val scope = VizScope(session, coroutineContext)

            val deferred =
                scope.vizAsync("awaited") {
                    vizDelay(100)
                    99
                }

            val result = deferred.await()
            assertEquals(99, result)

            val allEvents = session.store.all()

            // DeferredAwaitStarted
            val awaitStartedEvents = allEvents.filterIsInstance<DeferredAwaitStarted>()
            assertEquals(1, awaitStartedEvents.size)
            assertEquals("awaited", awaitStartedEvents.first().label)

            // DeferredAwaitCompleted
            val awaitCompletedEvents = allEvents.filterIsInstance<DeferredAwaitCompleted>()
            assertEquals(1, awaitCompletedEvents.size)
            assertEquals("awaited", awaitCompletedEvents.first().label)

            // Same deferredId on both events
            assertEquals(awaitStartedEvents.first().deferredId, awaitCompletedEvents.first().deferredId)
        }

    @Test
    fun `await tracks awaiter coroutine suspension and resumption`() =
        runTest {
            val scope = VizScope(session, coroutineContext)

            // Launch a parent coroutine that will await a deferred
            val job =
                scope.vizLaunch("awaiter") {
                    val deferred =
                        scope.vizAsync("producer") {
                            vizDelay(100)
                            "hello"
                        }

                    // This await call should emit CoroutineSuspended and CoroutineResumed
                    // for the "awaiter" coroutine
                    val result = deferred.await()
                    assertEquals("hello", result)
                }

            job.join()

            val allEvents = session.store.all()

            // The await should emit suspension for the awaiter
            val suspendedEvents = allEvents.filterIsInstance<CoroutineSuspended>()
            val awaitSuspensions = suspendedEvents.filter { it.reason == "await" }
            assertTrue(awaitSuspensions.isNotEmpty(), "Expected at least one await suspension event")

            // The await should emit resumption for the awaiter
            val resumedEvents = allEvents.filterIsInstance<CoroutineResumed>()
            assertTrue(resumedEvents.isNotEmpty(), "Expected at least one resume event after await")
        }

    // ========================================================================
    // COMPLETED DEFERRED TESTS
    // ========================================================================

    @Test
    fun `completed deferred await returns immediately`() =
        runTest {
            val scope = VizScope(session, coroutineContext)

            val deferred =
                scope.vizAsync("fast") {
                    7
                }

            // Wait for the async to fully complete first
            deferred.join()

            // Now await on an already-completed deferred
            val result = deferred.await()
            assertEquals(7, result)

            val allEvents = session.store.all()

            // Await events should still be emitted even if deferred is already complete
            val awaitStartedEvents = allEvents.filterIsInstance<DeferredAwaitStarted>()
            assertTrue(awaitStartedEvents.isNotEmpty(), "DeferredAwaitStarted should be emitted")

            val awaitCompletedEvents = allEvents.filterIsInstance<DeferredAwaitCompleted>()
            assertTrue(awaitCompletedEvents.isNotEmpty(), "DeferredAwaitCompleted should be emitted")
        }

    // ========================================================================
    // RESULT CORRECTNESS TESTS
    // ========================================================================

    @Test
    fun `deferred result is correct`() =
        runTest {
            val scope = VizScope(session, coroutineContext)

            val deferred =
                scope.vizAsync("sum") {
                    (1..10).sum()
                }

            val result = deferred.await()
            assertEquals(55, result)
        }
}
