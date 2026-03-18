package com.jh.proj.coroutineviz.session

import com.jh.proj.coroutineviz.events.VizEvent

/**
 * Abstraction for event storage in a visualization session.
 *
 * Defines the contract for an append-only event log that supports
 * querying by sequence number, coroutine identity, and full replay.
 * Implementations must be thread-safe for concurrent access.
 *
 * The default implementation is [EventStore], which uses an in-memory
 * [ArrayDeque] with bounded capacity. Alternative implementations
 * could back this with a database, file system, or distributed log.
 */
interface EventStoreInterface {
    /**
     * Record (append) an event to the store.
     *
     * @param event The event to store
     */
    fun record(event: VizEvent)

    /**
     * Retrieve all stored events in emission order.
     *
     * @return Defensive copy of all events
     */
    fun all(): List<VizEvent>

    /**
     * Retrieve events with sequence number strictly greater than [seq].
     *
     * Useful for clients that have already consumed events up to a
     * certain point and only need newer ones (e.g., SSE reconnection).
     *
     * @param seq The exclusive lower bound on sequence numbers
     * @return Events with seq > [seq], in emission order
     */
    fun since(seq: Long): List<VizEvent>

    /**
     * Retrieve all events associated with a specific coroutine.
     *
     * This filters events that implement [com.jh.proj.coroutineviz.events.CoroutineEvent]
     * and match the given [coroutineId].
     *
     * @param coroutineId The coroutine identifier to filter by
     * @return Matching events in emission order
     */
    fun byCoroutine(coroutineId: String): List<VizEvent>

    /**
     * Current number of stored events.
     */
    fun count(): Int

    /**
     * Remove all stored events.
     */
    fun clear()
}
