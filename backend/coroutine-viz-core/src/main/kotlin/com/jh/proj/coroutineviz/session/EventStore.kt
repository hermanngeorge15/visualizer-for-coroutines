package com.jh.proj.coroutineviz.session

import com.jh.proj.coroutineviz.events.CoroutineEvent
import com.jh.proj.coroutineviz.events.VizEvent
import java.util.concurrent.locks.ReentrantReadWriteLock
import kotlin.concurrent.read
import kotlin.concurrent.write

/**
 * Append-only event log for persisting visualization events.
 *
 * The EventStore provides durable storage of all events emitted during
 * a session. Events are stored in emission order and can be replayed
 * to reconstruct state or for debugging purposes.
 *
 * This implementation uses [ArrayDeque] with a [ReentrantReadWriteLock]
 * for thread-safe concurrent access. When the store reaches [maxEvents],
 * the oldest events are evicted to bound memory usage.
 *
 * Implements [EventStoreInterface] so callers can depend on the abstraction
 * rather than this concrete class.
 *
 * @param maxEvents Maximum number of events to retain. Oldest events
 *   are evicted when this limit is exceeded.
 */
class EventStore(private val maxEvents: Int = 10_000) : EventStoreInterface {
    private val events = ArrayDeque<VizEvent>()
    private val lock = ReentrantReadWriteLock()

    /** Optional callback invoked with the evicted event each time an event is evicted. */
    var onEvict: ((VizEvent) -> Unit)? = null

    /**
     * Append an event to the store.
     * If the store exceeds [maxEvents], the oldest event is evicted.
     *
     * @param event The event to store
     */
    fun append(event: VizEvent) {
        lock.write {
            events.addLast(event)
            while (events.size > maxEvents) {
                val evicted = events.removeFirst()
                onEvict?.invoke(evicted)
            }
        }
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
     * @return Defensive copy of all events
     */
    override fun all(): List<VizEvent> =
        lock.read {
            events.toList()
        }

    /**
     * Retrieve events with sequence number strictly greater than [seq].
     *
     * @param seq The exclusive lower bound on sequence numbers
     * @return Events with seq > [seq], in emission order
     */
    override fun since(seq: Long): List<VizEvent> =
        lock.read {
            events.filter { it.seq > seq }
        }

    /**
     * Retrieve all events associated with a specific coroutine.
     *
     * Filters for events implementing [CoroutineEvent] whose
     * [CoroutineEvent.coroutineId] matches [coroutineId].
     *
     * @param coroutineId The coroutine identifier to filter by
     * @return Matching events in emission order
     */
    override fun byCoroutine(coroutineId: String): List<VizEvent> =
        lock.read {
            events.filter { it is CoroutineEvent && it.coroutineId == coroutineId }
        }

    /**
     * Current number of stored events.
     * Satisfies the [EventStoreInterface.count] contract.
     */
    override fun count(): Int =
        lock.read {
            events.size
        }

    /**
     * Current number of stored events.
     * Retained for backwards compatibility — delegates to [count].
     */
    fun size(): Int = count()

    /**
     * Remove all stored events.
     */
    override fun clear() {
        lock.write {
            events.clear()
        }
    }
}
