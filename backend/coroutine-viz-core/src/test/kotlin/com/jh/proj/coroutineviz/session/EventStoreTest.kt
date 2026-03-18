package com.jh.proj.coroutineviz.session

import com.jh.proj.coroutineviz.events.coroutine.CoroutineCreated
import org.junit.jupiter.api.Test
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicInteger
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class EventStoreTest {
    private fun event(seq: Long) =
        CoroutineCreated(
            sessionId = "test",
            seq = seq,
            tsNanos = System.nanoTime(),
            coroutineId = "c-$seq",
            jobId = "j-$seq",
            parentCoroutineId = null,
            scopeId = "scope",
            label = "label-$seq",
        )

    @Test
    fun `append and retrieve events in order`() {
        val store = EventStore()
        store.append(event(1))
        store.append(event(2))
        store.append(event(3))

        val all = store.all()
        assertEquals(3, all.size)
        assertEquals(1L, all[0].seq)
        assertEquals(3L, all[2].seq)
    }

    @Test
    fun `size returns correct count`() {
        val store = EventStore()
        assertEquals(0, store.size())

        store.append(event(1))
        assertEquals(1, store.size())

        store.append(event(2))
        assertEquals(2, store.size())
    }

    @Test
    fun `evicts oldest events when maxEvents exceeded`() {
        val store = EventStore(maxEvents = 5)

        for (i in 1L..10L) {
            store.append(event(i))
        }

        assertEquals(5, store.size())
        val all = store.all()
        // Should retain events 6-10 (oldest 1-5 evicted)
        assertEquals(6L, all.first().seq)
        assertEquals(10L, all.last().seq)
    }

    @Test
    fun `eviction at exact boundary`() {
        val store = EventStore(maxEvents = 3)

        store.append(event(1))
        store.append(event(2))
        store.append(event(3))
        assertEquals(3, store.size())

        // One more triggers eviction
        store.append(event(4))
        assertEquals(3, store.size())
        assertEquals(2L, store.all().first().seq)
    }

    @Test
    fun `onEvict callback is called for each eviction`() {
        val evictCount = AtomicInteger(0)
        val store = EventStore(maxEvents = 3)
        store.onEvict = { evictCount.incrementAndGet() }

        for (i in 1L..6L) {
            store.append(event(i))
        }

        // 6 appended, max 3, so 3 evictions
        assertEquals(3, evictCount.get())
    }

    @Test
    fun `onEvict callback receives the evicted event`() {
        val evictedEvents = mutableListOf<Long>()
        val store = EventStore(maxEvents = 3)
        store.onEvict = { evictedEvents.add(it.seq) }

        for (i in 1L..6L) {
            store.append(event(i))
        }

        // Events 1, 2, 3 should have been evicted in order
        assertEquals(listOf(1L, 2L, 3L), evictedEvents)
        // Remaining events should be 4, 5, 6
        assertEquals(listOf(4L, 5L, 6L), store.all().map { it.seq })
    }

    @Test
    fun `all returns defensive copy`() {
        val store = EventStore()
        store.append(event(1))

        val copy1 = store.all()
        store.append(event(2))
        val copy2 = store.all()

        assertEquals(1, copy1.size, "First copy should not be affected by later appends")
        assertEquals(2, copy2.size)
    }

    @Test
    fun `thread safety under concurrent writes`() {
        val store = EventStore(maxEvents = 500)
        val threads = 8
        val eventsPerThread = 200
        val executor = Executors.newFixedThreadPool(threads)
        val latch = CountDownLatch(threads)

        for (t in 0 until threads) {
            executor.submit {
                try {
                    for (i in 0 until eventsPerThread) {
                        store.append(event((t * eventsPerThread + i).toLong()))
                    }
                } finally {
                    latch.countDown()
                }
            }
        }

        latch.await()
        executor.shutdown()

        // Should have at most maxEvents
        assertTrue(store.size() <= 500, "Size should not exceed maxEvents")
        assertEquals(store.size(), store.all().size, "size() and all().size should agree")
    }
}
