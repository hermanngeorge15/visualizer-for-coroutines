package com.jh.proj.coroutineviz.session

import com.jh.proj.coroutineviz.models.SessionInfo
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.runTest
import org.junit.jupiter.api.Test
import java.util.concurrent.ConcurrentHashMap
import kotlin.test.assertEquals

@OptIn(ExperimentalCoroutinesApi::class)
class RetentionPolicyTest {

    /**
     * Lightweight in-memory session store for testing.
     * Avoids coupling to the [SessionManager] singleton.
     */
    private class TestSessionStore : SessionStoreInterface {
        private val sessions = ConcurrentHashMap<String, VizSession>()

        override suspend fun createSession(name: String?): VizSession {
            val id = name ?: "session-${sessions.size}"
            val session = VizSession(id)
            sessions[id] = session
            return session
        }

        fun addSession(session: VizSession) {
            sessions[session.sessionId] = session
        }

        override fun getSession(sessionId: String): VizSession? = sessions[sessionId]

        override fun listSessions(): List<SessionInfo> =
            sessions.values.map { session ->
                SessionInfo(
                    sessionId = session.sessionId,
                    coroutineCount = session.snapshot.coroutines.size,
                    eventCount = session.store.all().size,
                )
            }

        override fun deleteSession(sessionId: String): Boolean {
            val removed = sessions.remove(sessionId)
            removed?.close()
            return removed != null
        }

        override fun clearAll() {
            sessions.values.forEach { it.close() }
            sessions.clear()
        }

        fun size(): Int = sessions.size
    }

    @Test
    fun `sessions older than maxAge are cleaned up`() {
        var now = 1_000_000L
        val store = TestSessionStore()
        val policy = RetentionPolicy(
            maxSessionAgeMs = 60_000L,
            maxSessions = 100,
            clock = { now },
        )

        // Create sessions at "current time"
        store.addSession(VizSession("old-1", createdAtMs = now - 120_000L)) // 2 min old
        store.addSession(VizSession("old-2", createdAtMs = now - 90_000L))  // 1.5 min old
        store.addSession(VizSession("young-1", createdAtMs = now - 30_000L)) // 30s old
        store.addSession(VizSession("young-2", createdAtMs = now - 10_000L)) // 10s old

        val removed = policy.cleanup(store)

        assertEquals(2, removed, "Should remove 2 expired sessions")
        assertEquals(2, store.size(), "Should have 2 sessions remaining")
        assertEquals(null, store.getSession("old-1"), "old-1 should be removed")
        assertEquals(null, store.getSession("old-2"), "old-2 should be removed")
        assertEquals("young-1", store.getSession("young-1")?.sessionId)
        assertEquals("young-2", store.getSession("young-2")?.sessionId)
    }

    @Test
    fun `excess sessions beyond maxSessions are cleaned up oldest first`() {
        var now = 1_000_000L
        val store = TestSessionStore()
        val policy = RetentionPolicy(
            maxSessionAgeMs = 3_600_000L, // 1 hour — none will expire by age
            maxSessions = 3,
            clock = { now },
        )

        // Add 5 sessions, all within age limit, but exceeding maxSessions
        store.addSession(VizSession("s1", createdAtMs = now - 50_000L)) // oldest
        store.addSession(VizSession("s2", createdAtMs = now - 40_000L))
        store.addSession(VizSession("s3", createdAtMs = now - 30_000L))
        store.addSession(VizSession("s4", createdAtMs = now - 20_000L))
        store.addSession(VizSession("s5", createdAtMs = now - 10_000L)) // newest

        val removed = policy.cleanup(store)

        assertEquals(2, removed, "Should remove 2 excess sessions")
        assertEquals(3, store.size(), "Should have 3 sessions remaining")
        // The two oldest should be removed
        assertEquals(null, store.getSession("s1"), "s1 (oldest) should be removed")
        assertEquals(null, store.getSession("s2"), "s2 (2nd oldest) should be removed")
        // The three newest should remain
        assertEquals("s3", store.getSession("s3")?.sessionId)
        assertEquals("s4", store.getSession("s4")?.sessionId)
        assertEquals("s5", store.getSession("s5")?.sessionId)
    }

    @Test
    fun `sessions within age limit are kept`() {
        var now = 1_000_000L
        val store = TestSessionStore()
        val policy = RetentionPolicy(
            maxSessionAgeMs = 60_000L,
            maxSessions = 100,
            clock = { now },
        )

        store.addSession(VizSession("a", createdAtMs = now - 10_000L))
        store.addSession(VizSession("b", createdAtMs = now - 20_000L))
        store.addSession(VizSession("c", createdAtMs = now - 50_000L))

        val removed = policy.cleanup(store)

        assertEquals(0, removed, "No sessions should be removed")
        assertEquals(3, store.size(), "All 3 sessions should remain")
    }

    @Test
    fun `cleanup combines age and count policies`() {
        var now = 1_000_000L
        val store = TestSessionStore()
        val policy = RetentionPolicy(
            maxSessionAgeMs = 60_000L,
            maxSessions = 2,
            clock = { now },
        )

        // 2 expired + 3 young => after age cleanup: 3 remain => over limit by 1
        store.addSession(VizSession("expired-1", createdAtMs = now - 120_000L))
        store.addSession(VizSession("expired-2", createdAtMs = now - 90_000L))
        store.addSession(VizSession("young-1", createdAtMs = now - 50_000L)) // oldest young
        store.addSession(VizSession("young-2", createdAtMs = now - 20_000L))
        store.addSession(VizSession("young-3", createdAtMs = now - 5_000L))

        val removed = policy.cleanup(store)

        // 2 removed by age + 1 removed by count = 3
        assertEquals(3, removed, "Should remove 2 by age + 1 by count")
        assertEquals(2, store.size(), "Should have 2 sessions remaining")
        assertEquals(null, store.getSession("expired-1"))
        assertEquals(null, store.getSession("expired-2"))
        assertEquals(null, store.getSession("young-1"), "oldest young removed by count limit")
        assertEquals("young-2", store.getSession("young-2")?.sessionId)
        assertEquals("young-3", store.getSession("young-3")?.sessionId)
    }

    @Test
    fun `periodic cleanup runs on schedule`() = runTest {
        var now = 1_000_000L
        val store = TestSessionStore()
        val policy = RetentionPolicy(
            maxSessionAgeMs = 60_000L,
            maxSessions = 100,
            checkIntervalMs = 30_000L,
            clock = { now },
        )

        // Add an old session
        store.addSession(VizSession("old", createdAtMs = now - 120_000L))
        assertEquals(1, store.size())

        policy.start(this, store)

        // Before first interval: session still there
        advanceTimeBy(10_000L)
        assertEquals(1, store.size(), "Session should remain before first interval")

        // After first interval: cleanup should have run
        advanceTimeBy(25_000L) // total 35s > 30s interval
        assertEquals(0, store.size(), "Old session should be removed after first interval")

        // Add a new session that will expire as time advances
        store.addSession(VizSession("new", createdAtMs = now))

        // Advance clock so the session becomes expired
        now += 120_000L

        // Advance virtual time past the next interval
        advanceTimeBy(30_000L)
        assertEquals(0, store.size(), "New session should be removed after it expires")

        policy.stop()
    }

    @Test
    fun `stop cancels periodic cleanup`() = runTest {
        var now = 1_000_000L
        val store = TestSessionStore()
        val policy = RetentionPolicy(
            maxSessionAgeMs = 60_000L,
            maxSessions = 100,
            checkIntervalMs = 30_000L,
            clock = { now },
        )

        policy.start(this, store)
        policy.stop()

        // Add an old session after stopping
        store.addSession(VizSession("old", createdAtMs = now - 120_000L))

        // Advance time well past interval
        advanceTimeBy(120_000L)

        // Session should still be there since cleanup was stopped
        assertEquals(1, store.size(), "Session should remain after policy is stopped")
    }

    @Test
    fun `cleanup with empty store returns zero`() {
        val store = TestSessionStore()
        val policy = RetentionPolicy(clock = { System.currentTimeMillis() })

        val removed = policy.cleanup(store)

        assertEquals(0, removed, "No sessions to remove from empty store")
    }

    @Test
    fun `start is idempotent when already running`() = runTest {
        val store = TestSessionStore()
        val policy = RetentionPolicy(
            checkIntervalMs = 10_000L,
            clock = { System.currentTimeMillis() },
        )

        policy.start(this, store)
        policy.start(this, store) // second call should be no-op

        policy.stop()
    }
}
