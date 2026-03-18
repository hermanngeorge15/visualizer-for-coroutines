package com.jh.proj.coroutineviz.session

import com.jh.proj.coroutineviz.events.CoroutineEvent
import com.jh.proj.coroutineviz.events.VizEvent
import java.util.concurrent.CopyOnWriteArrayList

/**
 * Append-only event log for persisting visualization events.
 *
 * The EventStore provides durable storage of all events emitted during
 * a session. Events are stored in emission order and can be replayed
 * to reconstruct state or for debugging purposes.
 *
 * This implementation uses [CopyOnWriteArrayList] for thread-safe
 * concurrent access. For production use with large event volumes,
 * consider replacing with a persistent store (database, file, etc.).
 *
 * Implements [EventStoreInterface] so callers can depend on the abstraction
 * rather than this concrete class.
 *
 * Usage:
 * ```kotlin
 * store.append(event)
 * val allEvents = store.all()
 * ```
 */
class EventStore : EventStoreInterface {
    private val events = CopyOnWriteArrayList<VizEvent>()

    /**
     * Append an event to the store.
     *
     * @param event The event to store
     */
    fun append(event: VizEvent) {
        events.add(event)
    }

    /**
     * Record (append) an event to the store.
     * Alias for [append] that satisfies the [EventStoreInterface] contract.
     *
     * @param event The event to store
     */
    override fun record(event: VizEvent) {
        append(event)
    }

    /**
     * Retrieve all stored events in emission order.
     *
     * @return Immutable view of all events
     */
    override fun all(): List<VizEvent> = events

    /**
     * Retrieve events with sequence number strictly greater than [seq].
     *
     * @param seq The exclusive lower bound on sequence numbers
     * @return Events with seq > [seq], in emission order
     */
    override fun since(seq: Long): List<VizEvent> = events.filter { it.seq > seq }

    /**
     * Retrieve all events associated with a specific coroutine.
     *
     * Filters for events implementing [CoroutineEvent] whose
     * [CoroutineEvent.coroutineId] matches [coroutineId].
     *
     * @param coroutineId The coroutine identifier to filter by
     * @return Matching events in emission order
     */
    override fun byCoroutine(coroutineId: String): List<VizEvent> = events.filter { it is CoroutineEvent && it.coroutineId == coroutineId }

    /**
     * Current number of stored events.
     * Satisfies the [EventStoreInterface.count] contract.
     */
    override fun count(): Int = events.size

    /**
     * Remove all stored events.
     */
    override fun clear() {
        events.clear()
    }
}
