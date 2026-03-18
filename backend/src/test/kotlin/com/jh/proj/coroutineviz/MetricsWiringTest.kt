package com.jh.proj.coroutineviz

import com.jh.proj.coroutineviz.session.SessionManager
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.get
import io.ktor.client.request.post
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpStatusCode
import io.ktor.serialization.kotlinx.json.json
import io.ktor.server.testing.testApplication
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class MetricsWiringTest {
    @BeforeEach
    fun setUp() {
        SessionManager.clearAll()
    }

    @AfterEach
    fun tearDown() {
        SessionManager.clearAll()
    }

    @Test
    fun `metrics endpoint exposes custom viz metrics`() =
        testApplication {
            application { module() }

            val response = client.get("/metrics-micrometer")
            assertEquals(HttpStatusCode.OK, response.status)

            val body = response.bodyAsText()
            assertTrue(body.contains("viz_sessions_active"), "Should contain viz.sessions.active gauge")
        }

    @Test
    fun `sessions active gauge reflects session count`() =
        testApplication {
            application { module() }

            // Create a session to trigger the callback wiring
            val createClient =
                createClient {
                    install(ContentNegotiation) {
                        json()
                    }
                }
            createClient.post("/api/sessions?name=metrics-test")

            val response = client.get("/metrics-micrometer")
            val body = response.bodyAsText()
            assertTrue(body.contains("viz_sessions_active"), "Should contain viz.sessions.active gauge")
            assertTrue(body.contains("viz_sessions_active 1.0"), "Session count should be 1.0")
        }
}
