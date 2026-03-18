package com.jh.proj.coroutineviz.session

import kotlinx.serialization.Serializable
import org.slf4j.LoggerFactory
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

/**
 * Represents a share token that grants read-only access to a session.
 *
 * Tokens are time-limited and can be revoked. They are intended for
 * sharing session visualizations with others without exposing the
 * session management API.
 */
@Serializable
data class ShareToken(
    val token: String,
    val sessionId: String,
    val createdAtMs: Long,
    val expiresAtMs: Long,
    val readOnly: Boolean = true,
)

/**
 * Manages share tokens for session read-only access.
 *
 * Tokens are stored in memory using a [ConcurrentHashMap]. Expired tokens
 * are lazily cleaned on access — no background reaper thread is needed.
 *
 * Thread-safe: all public methods can be called concurrently from multiple
 * API handlers.
 */
object ShareTokenService {
    private val logger = LoggerFactory.getLogger(ShareTokenService::class.java)
    private val tokens = ConcurrentHashMap<String, ShareToken>()

    /**
     * Generate a new share token for the given session.
     *
     * @param sessionId The session to share
     * @param expiresInMs Token lifetime in milliseconds (default 24 hours)
     * @return The newly created share token
     */
    fun generateToken(
        sessionId: String,
        expiresInMs: Long = 86_400_000,
    ): ShareToken {
        val now = System.currentTimeMillis()
        val token =
            ShareToken(
                token = UUID.randomUUID().toString(),
                sessionId = sessionId,
                createdAtMs = now,
                expiresAtMs = now + expiresInMs,
            )
        tokens[token.token] = token
        logger.info("Generated share token for session $sessionId (expires in ${expiresInMs}ms)")
        return token
    }

    /**
     * Validate a share token.
     *
     * Returns the token if it exists and has not expired, or null otherwise.
     * Expired tokens are lazily removed on access.
     *
     * @param token The token string to validate
     * @return The [ShareToken] if valid, null if invalid or expired
     */
    fun validateToken(token: String): ShareToken? {
        val shareToken = tokens[token] ?: return null
        if (shareToken.expiresAtMs < System.currentTimeMillis()) {
            tokens.remove(token)
            logger.debug("Token expired and removed for session ${shareToken.sessionId}")
            return null
        }
        return shareToken
    }

    /**
     * Revoke a share token, removing it from the store.
     *
     * @param token The token string to revoke
     * @return true if the token existed and was removed, false otherwise
     */
    fun revokeToken(token: String): Boolean {
        val removed = tokens.remove(token)
        if (removed != null) {
            logger.info("Revoked share token for session ${removed.sessionId}")
        }
        return removed != null
    }

    /**
     * Get all active (non-expired) tokens for a session.
     *
     * Lazily removes expired tokens during iteration.
     *
     * @param sessionId The session to query
     * @return List of active share tokens for the session
     */
    fun getTokensForSession(sessionId: String): List<ShareToken> {
        val now = System.currentTimeMillis()
        val result = mutableListOf<ShareToken>()
        val expired = mutableListOf<String>()

        for (entry in tokens) {
            if (entry.value.sessionId == sessionId) {
                if (entry.value.expiresAtMs < now) {
                    expired.add(entry.key)
                } else {
                    result.add(entry.value)
                }
            }
        }

        // Lazy cleanup of expired tokens
        for (key in expired) {
            tokens.remove(key)
        }

        return result
    }

    /**
     * Clear all tokens. Useful for testing.
     */
    fun clearAll() {
        val count = tokens.size
        tokens.clear()
        logger.info("Cleared all share tokens: $count removed")
    }
}
