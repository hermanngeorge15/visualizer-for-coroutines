package com.jh.proj.coroutineviz.session

import com.jh.proj.coroutineviz.models.SessionInfo
import org.slf4j.LoggerFactory
import java.util.concurrent.ConcurrentHashMap

/**
 * Manages active visualization sessions.
 *
 * Sessions are stored in memory and can be accessed across multiple API calls.
 * This allows clients to:
 * - Create a session
 * - Run scenarios in that session
 * - Stream events from that session via SSE
 * - Query the session snapshot
 *
 * Implements [SessionStoreInterface] so callers can depend on the abstraction
 * rather than this concrete singleton.
 */
object SessionManager : SessionStoreInterface {
    private val logger = LoggerFactory.getLogger(SessionManager::class.java)
    private val sessions = ConcurrentHashMap<String, VizSession>()

    /**
     * Create a new visualization session.
     *
     * Satisfies the [SessionStoreInterface.createSession] contract.
     * The suspend modifier is accepted but this implementation does not
     * actually suspend -- it completes synchronously.
     */
    override suspend fun createSession(name: String?): VizSession {
        val sessionId =
            name?.let { "$it-${System.currentTimeMillis()}" }
                ?: "session-${System.currentTimeMillis()}"

        val session = VizSession(sessionId)
        sessions[sessionId] = session

        logger.info("Created session: $sessionId")
        return session
    }

    /**
     * Get an existing session by ID.
     */
    override fun getSession(sessionId: String): VizSession? {
        return sessions[sessionId]
    }

    /**
     * List all active sessions.
     */
    override fun listSessions(): List<SessionInfo> {
        return sessions.values.map { session ->
            SessionInfo(
                sessionId = session.sessionId,
                coroutineCount = session.snapshot.coroutines.size,
                eventCount = session.store.all().size,
            )
        }
    }

    /**
     * Close and remove a session.
     * Retained for backwards compatibility -- delegates to [deleteSession].
     */
    fun closeSession(sessionId: String): Boolean = deleteSession(sessionId)

    /**
     * Delete (close and remove) a session by ID.
     *
     * Cleans up session resources before removal. Satisfies the
     * [SessionStoreInterface.deleteSession] contract.
     */
    override fun deleteSession(sessionId: String): Boolean {
        val removed = sessions.remove(sessionId)
        if (removed != null) {
            // Clean up session resources
            removed.close()
            logger.info("Closed session: $sessionId")
            return true
        }
        return false
    }

    /**
     * Clear all sessions (useful for testing).
     */
    override fun clearAll() {
        val count = sessions.size
        sessions.clear()
        logger.info("Cleared all sessions: $count removed")
    }
}
