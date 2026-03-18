package com.jh.proj.coroutineviz.session

import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class ShareTokenServiceTest {
    @BeforeEach
    fun setUp() {
        ShareTokenService.clearAll()
    }

    @AfterEach
    fun tearDown() {
        ShareTokenService.clearAll()
    }

    @Test
    fun `generateToken returns valid token with correct session ID`() {
        val token = ShareTokenService.generateToken("session-1")

        assertNotNull(token.token)
        assertTrue(token.token.isNotBlank())
        assertEquals("session-1", token.sessionId)
        assertTrue(token.readOnly)
        assertTrue(token.expiresAtMs > token.createdAtMs)
    }

    @Test
    fun `generateToken uses custom expiry`() {
        val token = ShareTokenService.generateToken("session-1", expiresInMs = 5000)

        val expectedExpiry = token.createdAtMs + 5000
        assertEquals(expectedExpiry, token.expiresAtMs)
    }

    @Test
    fun `validateToken returns token for valid token`() {
        val generated = ShareTokenService.generateToken("session-1")

        val validated = ShareTokenService.validateToken(generated.token)

        assertNotNull(validated)
        assertEquals(generated.token, validated.token)
        assertEquals("session-1", validated.sessionId)
    }

    @Test
    fun `validateToken returns null for unknown token`() {
        val validated = ShareTokenService.validateToken("nonexistent-token")

        assertNull(validated)
    }

    @Test
    fun `validateToken returns null for expired token`() {
        // Generate a token that is already expired (negative expiry)
        val token = ShareTokenService.generateToken("session-1", expiresInMs = -1000)

        val validated = ShareTokenService.validateToken(token.token)

        assertNull(validated)
    }

    @Test
    fun `expired token is lazily removed on validate`() {
        val token = ShareTokenService.generateToken("session-1", expiresInMs = -1000)

        // First call removes it
        assertNull(ShareTokenService.validateToken(token.token))
        // Confirm it is gone from the store
        assertTrue(ShareTokenService.getTokensForSession("session-1").isEmpty())
    }

    @Test
    fun `revokeToken removes existing token`() {
        val token = ShareTokenService.generateToken("session-1")

        val revoked = ShareTokenService.revokeToken(token.token)

        assertTrue(revoked)
        assertNull(ShareTokenService.validateToken(token.token))
    }

    @Test
    fun `revokeToken returns false for unknown token`() {
        val revoked = ShareTokenService.revokeToken("nonexistent-token")

        assertTrue(!revoked)
    }

    @Test
    fun `getTokensForSession returns only tokens for specified session`() {
        ShareTokenService.generateToken("session-1")
        ShareTokenService.generateToken("session-1")
        ShareTokenService.generateToken("session-2")

        val session1Tokens = ShareTokenService.getTokensForSession("session-1")
        val session2Tokens = ShareTokenService.getTokensForSession("session-2")

        assertEquals(2, session1Tokens.size)
        assertEquals(1, session2Tokens.size)
        assertTrue(session1Tokens.all { it.sessionId == "session-1" })
        assertTrue(session2Tokens.all { it.sessionId == "session-2" })
    }

    @Test
    fun `getTokensForSession excludes expired tokens`() {
        ShareTokenService.generateToken("session-1", expiresInMs = 86_400_000)
        ShareTokenService.generateToken("session-1", expiresInMs = -1000) // already expired

        val tokens = ShareTokenService.getTokensForSession("session-1")

        assertEquals(1, tokens.size)
    }

    @Test
    fun `getTokensForSession returns empty list for unknown session`() {
        val tokens = ShareTokenService.getTokensForSession("nonexistent-session")

        assertTrue(tokens.isEmpty())
    }

    @Test
    fun `multiple tokens can coexist for same session`() {
        val token1 = ShareTokenService.generateToken("session-1")
        val token2 = ShareTokenService.generateToken("session-1")

        assertNotNull(ShareTokenService.validateToken(token1.token))
        assertNotNull(ShareTokenService.validateToken(token2.token))
        assertTrue(token1.token != token2.token)
    }

    @Test
    fun `clearAll removes all tokens`() {
        ShareTokenService.generateToken("session-1")
        ShareTokenService.generateToken("session-2")

        ShareTokenService.clearAll()

        assertTrue(ShareTokenService.getTokensForSession("session-1").isEmpty())
        assertTrue(ShareTokenService.getTokensForSession("session-2").isEmpty())
    }
}
