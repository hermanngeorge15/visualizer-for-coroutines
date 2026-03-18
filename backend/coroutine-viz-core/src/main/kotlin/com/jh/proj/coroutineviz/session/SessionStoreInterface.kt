package com.jh.proj.coroutineviz.session

import com.jh.proj.coroutineviz.models.SessionInfo

/**
 * Abstraction for session lifecycle management.
 *
 * Defines the contract for creating, retrieving, listing, and removing
 * visualization sessions. Implementations must be safe for concurrent
 * access from multiple API handlers.
 *
 * The default implementation is [SessionManager], which stores sessions
 * in a [ConcurrentHashMap]. Alternative implementations could persist
 * sessions to a database or distributed cache for multi-node deployments.
 */
interface SessionStoreInterface {
    /**
     * Create a new visualization session.
     *
     * @param name Optional human-readable name used as a prefix for the session ID
     * @return The newly created session
     */
    suspend fun createSession(name: String? = null): VizSession

    /**
     * Get an existing session by ID.
     *
     * @param sessionId The unique session identifier
     * @return The session, or null if not found
     */
    fun getSession(sessionId: String): VizSession?

    /**
     * List summary information for all active sessions.
     *
     * @return List of [SessionInfo] for each active session
     */
    fun listSessions(): List<SessionInfo>

    /**
     * Delete (close and remove) a session by ID.
     *
     * Implementations should clean up session resources (cancel scopes,
     * stop monitors, etc.) before removal.
     *
     * @param sessionId The unique session identifier
     * @return true if the session existed and was removed, false otherwise
     */
    fun deleteSession(sessionId: String): Boolean

    /**
     * Remove all sessions. Useful for testing and shutdown.
     */
    fun clearAll()
}
