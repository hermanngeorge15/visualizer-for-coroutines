package com.jh.proj.coroutineviz.session

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
 * @param maxEvents Maximum number of events to retain. Oldest events
 *   are evicted when this limit is exceeded.
 */
class EventStore(private val maxEvents: Int = 100_000) {
    private val events = ArrayDeque<VizEvent>()
    private val lock = ReentrantReadWriteLock()

    /** Optional callback invoked each time an event is evicted. */
    var onEvict: (() -> Unit)? = null

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
                events.removeFirst()
                onEvict?.invoke()
            }
        }
    }

    /**
     * Retrieve all stored events in emission order.
     *
     * @return Defensive copy of all events
     */
    fun all(): List<VizEvent> =
        lock.read {
            events.toList()
        }

    /**
     * Current number of stored events.
     */
    fun size(): Int =
        lock.read {
            events.size
        }
}
