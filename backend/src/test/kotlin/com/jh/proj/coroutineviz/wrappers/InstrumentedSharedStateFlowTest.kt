package com.jh.proj.coroutineviz.wrappers

import com.jh.proj.coroutineviz.events.flow.FlowCreated
import com.jh.proj.coroutineviz.events.flow.SharedFlowEmission
import com.jh.proj.coroutineviz.events.flow.SharedFlowSubscription
import com.jh.proj.coroutineviz.events.flow.StateFlowValueChanged
import com.jh.proj.coroutineviz.session.VizSession
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.runTest
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class InstrumentedSharedStateFlowTest {
    private lateinit var session: VizSession

    @BeforeEach
    fun setup() {
        session = VizSession("test-hot-flow-${System.currentTimeMillis()}")
    }

    // ========================================================================
    // SHARED FLOW CREATION TESTS
    // ========================================================================

    @Test
    fun `shared flow creation emits FlowCreated with SharedFlow type`() {
        val sharedFlow = session.vizSharedFlow<Int>(replay = 1, label = "testShared")

        val createdEvents = session.store.all().filterIsInstance<FlowCreated>()
        assertEquals(1, createdEvents.size)
        assertEquals("SharedFlow", createdEvents.first().flowType)
        assertEquals("testShared", createdEvents.first().label)
    }

    // ========================================================================
    // SHARED FLOW EMISSION TESTS
    // ========================================================================

    @Test
    fun `shared flow emit emits SharedFlowEmission event`() =
        runTest {
            val sharedFlow = session.vizSharedFlow<Int>(replay = 1, label = "emitShared")

            sharedFlow.emit(42)

            val allEvents = session.store.all()
            val emissionEvents = allEvents.filterIsInstance<SharedFlowEmission>()
            assertEquals(1, emissionEvents.size)
            assertEquals("42", emissionEvents.first().valuePreview)
            assertEquals("Integer", emissionEvents.first().valueType)
            assertEquals("emitShared", emissionEvents.first().label)
        }

    // ========================================================================
    // SHARED FLOW SUBSCRIPTION TESTS
    // ========================================================================

    @Test
    fun `shared flow subscription tracking`() =
        runTest {
            val sharedFlow = session.vizSharedFlow<Int>(replay = 1, label = "subShared")

            // Emit a value to replay cache so collector gets it quickly
            sharedFlow.emit(100)

            // Start collecting in a child coroutine
            val collectorJob =
                launch {
                    sharedFlow.collect {
                        // Collect one value then cancel
                    }
                }

            // Give the collector time to subscribe
            delay(50)

            // Cancel the collector
            collectorJob.cancelAndJoin()

            val allEvents = session.store.all()

            // SharedFlowSubscription with "subscribed" action
            val subscriptionEvents = allEvents.filterIsInstance<SharedFlowSubscription>()
            val subscribedEvents = subscriptionEvents.filter { it.action == "subscribed" }
            assertTrue(subscribedEvents.isNotEmpty(), "Expected at least one 'subscribed' event")
            assertEquals(1, subscribedEvents.first().subscriberCount)

            // SharedFlowSubscription with "unsubscribed" action after cancellation
            val unsubscribedEvents = subscriptionEvents.filter { it.action == "unsubscribed" }
            assertTrue(unsubscribedEvents.isNotEmpty(), "Expected at least one 'unsubscribed' event")
        }

    // ========================================================================
    // STATE FLOW CREATION TESTS
    // ========================================================================

    @Test
    fun `state flow creation emits FlowCreated with StateFlow type`() {
        val stateFlow = session.vizStateFlow(initialValue = 0, label = "testState")

        val createdEvents = session.store.all().filterIsInstance<FlowCreated>()
        assertEquals(1, createdEvents.size)
        assertEquals("StateFlow", createdEvents.first().flowType)
        assertEquals("testState", createdEvents.first().label)
    }

    // ========================================================================
    // STATE FLOW VALUE CHANGE TESTS
    // ========================================================================

    @Test
    fun `state flow value change emits StateFlowValueChanged`() {
        val stateFlow = session.vizStateFlow(initialValue = 0, label = "changeState")

        stateFlow.value = 42

        val allEvents = session.store.all()
        val changedEvents = allEvents.filterIsInstance<StateFlowValueChanged>()
        assertEquals(1, changedEvents.size)
        assertEquals("0", changedEvents.first().oldValuePreview)
        assertEquals("42", changedEvents.first().newValuePreview)
        assertEquals("changeState", changedEvents.first().label)
    }

    @Test
    fun `state flow compareAndSet emits event on success`() {
        val stateFlow = session.vizStateFlow(initialValue = 10, label = "casState")

        val result = stateFlow.compareAndSet(10, 20)
        assertTrue(result, "compareAndSet should succeed when expected value matches")
        assertEquals(20, stateFlow.value)

        val allEvents = session.store.all()
        val changedEvents = allEvents.filterIsInstance<StateFlowValueChanged>()
        assertEquals(1, changedEvents.size)
        assertEquals("10", changedEvents.first().oldValuePreview)
        assertEquals("20", changedEvents.first().newValuePreview)
    }

    @Test
    fun `state flow does not emit when value unchanged`() {
        val stateFlow = session.vizStateFlow(initialValue = 5, label = "noChangeState")

        // Set the same value
        stateFlow.value = 5

        val allEvents = session.store.all()
        val changedEvents = allEvents.filterIsInstance<StateFlowValueChanged>()
        assertEquals(0, changedEvents.size, "No StateFlowValueChanged should be emitted when value is unchanged")
    }
}
