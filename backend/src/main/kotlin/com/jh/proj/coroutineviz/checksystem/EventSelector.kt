package com.jh.proj.coroutineviz.checksystem

import com.jh.proj.coroutineviz.events.CoroutineEvent
import com.jh.proj.coroutineviz.events.VizEvent

/**
 * Utility extension functions for filtering event lists.
 *
 * Provides convenient, type-safe ways to select subsets of events
 * by type, coroutine ID, or sequence number range.
 */

/**
 * Filter events to only those of a specific type [T].
 *
 * Usage: `events.ofType<CoroutineCreated>()`
 */
inline fun <reified T : VizEvent> List<VizEvent>.ofType(): List<T> {
    return filterIsInstance<T>()
}

/**
 * Filter events to only those belonging to a specific coroutine.
 *
 * Only [CoroutineEvent] instances are checked; non-coroutine events are excluded.
 */
fun List<VizEvent>.forCoroutine(id: String): List<VizEvent> {
    return filter { event ->
        event is CoroutineEvent && event.coroutineId == id
    }
}

/**
 * Filter events to only those within a sequence number range (inclusive).
 */
fun List<VizEvent>.inSequenceRange(from: Long, to: Long): List<VizEvent> {
    return filter { it.seq in from..to }
}
