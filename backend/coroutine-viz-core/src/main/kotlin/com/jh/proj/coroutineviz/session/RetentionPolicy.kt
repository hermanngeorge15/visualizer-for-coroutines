package com.jh.proj.coroutineviz.session

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import org.slf4j.LoggerFactory

/**
 * Background retention policy that automatically cleans up old sessions.
 *
 * Periodically checks all sessions managed by a [SessionStoreInterface] and
 * removes those that exceed the maximum age or when the total session count
 * exceeds the configured limit.
 *
 * Cleanup rules (applied in order):
 * 1. Remove all sessions older than [maxSessionAgeMs]
 * 2. If the remaining count still exceeds [maxSessions], remove the oldest
 *    sessions until the count is at or below the limit
 *
 * @property maxSessionAgeMs Maximum age of a session in milliseconds before
 *           it is eligible for removal. Defaults to 1 hour.
 * @property maxSessions Maximum number of sessions to retain. Defaults to 100.
 * @property checkIntervalMs How often (in milliseconds) the background cleanup
 *           runs. Defaults to 1 minute.
 * @property clock Function that returns the current time in milliseconds.
 *           Defaults to [System.currentTimeMillis]; override in tests for
 *           deterministic time control.
 */
class RetentionPolicy(
    private val maxSessionAgeMs: Long = 3_600_000L,
    private val maxSessions: Int = 100,
    private val checkIntervalMs: Long = 60_000L,
    private val clock: () -> Long = System::currentTimeMillis,
) {
    private val logger = LoggerFactory.getLogger(RetentionPolicy::class.java)
    private var job: Job? = null

    /**
     * Start the periodic cleanup coroutine.
     *
     * Launches a long-running coroutine in [scope] that calls [cleanup]
     * every [checkIntervalMs] milliseconds. If a cleanup cycle is already
     * running, this is a no-op.
     *
     * @param scope The coroutine scope to launch in (typically application scope)
     * @param sessionManager The session store to clean up
     */
    fun start(scope: CoroutineScope, sessionManager: SessionStoreInterface) {
        if (job?.isActive == true) return

        job = scope.launch {
            logger.info(
                "Retention policy started: maxAge={}ms, maxSessions={}, interval={}ms",
                maxSessionAgeMs, maxSessions, checkIntervalMs,
            )
            while (isActive) {
                delay(checkIntervalMs)
                val removed = cleanup(sessionManager)
                if (removed > 0) {
                    logger.info("Retention cleanup removed {} session(s)", removed)
                }
            }
        }
    }

    /**
     * Stop the periodic cleanup coroutine.
     *
     * Cancels the background job if it is running. Safe to call multiple times.
     */
    fun stop() {
        job?.cancel()
        job = null
        logger.info("Retention policy stopped")
    }

    /**
     * Run a single cleanup pass against the given session store.
     *
     * This method is safe to call from any context (it does not suspend).
     *
     * @param sessionManager The session store to clean up
     * @return The number of sessions that were removed
     */
    fun cleanup(sessionManager: SessionStoreInterface): Int {
        val now = clock()
        var removedCount = 0

        // Phase 1: remove sessions older than maxSessionAgeMs
        val sessions = sessionManager.listSessions()
        for (info in sessions) {
            val session = sessionManager.getSession(info.sessionId) ?: continue
            val age = now - session.createdAtMs
            if (age > maxSessionAgeMs) {
                if (sessionManager.deleteSession(info.sessionId)) {
                    removedCount++
                    logger.debug("Removed expired session {} (age={}ms)", info.sessionId, age)
                }
            }
        }

        // Phase 2: if still over maxSessions, remove oldest first
        val remaining = sessionManager.listSessions()
        if (remaining.size > maxSessions) {
            val sessionsWithAge = remaining.mapNotNull { info ->
                sessionManager.getSession(info.sessionId)?.let { session ->
                    info.sessionId to session.createdAtMs
                }
            }.sortedBy { it.second } // oldest first

            val excessCount = sessionsWithAge.size - maxSessions
            for (i in 0 until excessCount) {
                val sessionId = sessionsWithAge[i].first
                if (sessionManager.deleteSession(sessionId)) {
                    removedCount++
                    logger.debug("Removed excess session {}", sessionId)
                }
            }
        }

        return removedCount
    }
}
