@file:Suppress("DEPRECATION")

package com.jh.proj.coroutineviz

import com.jh.proj.coroutineviz.session.SessionManager
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpStatusCode
import io.ktor.serialization.kotlinx.json.json
import io.ktor.server.auth.Authentication
import io.ktor.server.auth.AuthenticationFailedCause
import io.ktor.server.auth.authenticate
import io.ktor.server.response.respond
import io.ktor.server.response.respondText
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.routing
import io.ktor.server.sse.SSE
import io.ktor.server.testing.ApplicationTestBuilder
import io.ktor.server.testing.testApplication
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals

class AuthTest {
    @BeforeEach
    fun setUp() {
        SessionManager.clearAll()
    }

    @AfterEach
    fun tearDown() {
        SessionManager.clearAll()
    }

    private fun ApplicationTestBuilder.jsonClient() =
        createClient {
            install(ContentNegotiation) {
                json()
            }
        }

    // -- No API key configured (development mode) ----------------------

    @Test
    fun `when no API key configured, API requests pass without key`() =
        testApplication {
            application { module() }
            val client = jsonClient()

            val response = client.get("/api/sessions")
            assertEquals(HttpStatusCode.OK, response.status)
        }

    @Test
    fun `when no API key configured, health endpoint passes`() =
        testApplication {
            application { module() }
            val client = jsonClient()

            val response = client.get("/health")
            assertEquals(HttpStatusCode.OK, response.status)
        }

    // -- API key configured (uses minimal app to avoid full config) ----

    private fun ApplicationTestBuilder.installAuthModule(apiKey: String) {
        install(io.ktor.server.plugins.contentnegotiation.ContentNegotiation) {
            json()
        }
        install(SSE)
        install(Authentication) {
            provider("api-key") {
                authenticate { context ->
                    val requestKey = context.call.request.headers["X-API-Key"]
                    if (requestKey == apiKey) {
                        context.principal(ApiKeyPrincipal(requestKey))
                    } else {
                        context.error(
                            "ApiKey",
                            AuthenticationFailedCause.InvalidCredentials,
                        )
                        context.challenge(
                            "ApiKey",
                            AuthenticationFailedCause.InvalidCredentials,
                        ) { _, call ->
                            call.respond(
                                HttpStatusCode.Unauthorized,
                                mapOf("error" to "Invalid or missing API key"),
                            )
                        }
                    }
                }
            }
        }
        routing {
            // Public routes
            get("/health") {
                call.respond(HttpStatusCode.OK, mapOf("status" to "UP"))
            }
            get("/") {
                call.respondText("Hello World!")
            }

            // Protected routes
            authenticate("api-key") {
                get("/api/sessions") {
                    call.respond(HttpStatusCode.OK, SessionManager.listSessions())
                }
                post("/api/sessions") {
                    val session = SessionManager.createSession(call.request.queryParameters["name"])
                    call.respond(
                        HttpStatusCode.Created,
                        mapOf("sessionId" to session.sessionId),
                    )
                }
            }
        }
    }

    @Test
    fun `when API key configured, requests without key get 401`() =
        testApplication {
            installAuthModule("test-secret-key")
            val client = jsonClient()

            val response = client.get("/api/sessions")
            assertEquals(HttpStatusCode.Unauthorized, response.status)

            val body = Json.parseToJsonElement(response.bodyAsText()).jsonObject
            assertEquals("Invalid or missing API key", body["error"]?.jsonPrimitive?.content)
        }

    @Test
    fun `when API key configured, requests with wrong key get 401`() =
        testApplication {
            installAuthModule("test-secret-key")
            val client = jsonClient()

            val response =
                client.get("/api/sessions") {
                    header("X-API-Key", "wrong-key")
                }
            assertEquals(HttpStatusCode.Unauthorized, response.status)
        }

    @Test
    fun `when API key configured, requests with correct key pass`() =
        testApplication {
            installAuthModule("test-secret-key")
            val client = jsonClient()

            val response =
                client.get("/api/sessions") {
                    header("X-API-Key", "test-secret-key")
                }
            assertEquals(HttpStatusCode.OK, response.status)
        }

    @Test
    fun `when API key configured, POST to API endpoint without key gets 401`() =
        testApplication {
            installAuthModule("test-secret-key")
            val client = jsonClient()

            val response = client.post("/api/sessions?name=test")
            assertEquals(HttpStatusCode.Unauthorized, response.status)
        }

    @Test
    fun `when API key configured, POST to API endpoint with correct key passes`() =
        testApplication {
            installAuthModule("test-secret-key")
            val client = jsonClient()

            val response =
                client.post("/api/sessions?name=test") {
                    header("X-API-Key", "test-secret-key")
                }
            assertEquals(HttpStatusCode.Created, response.status)
        }

    // -- Health endpoint always bypasses auth --------------------------

    @Test
    fun `health endpoint bypasses auth even when API key is configured`() =
        testApplication {
            installAuthModule("test-secret-key")
            val client = jsonClient()

            val response = client.get("/health")
            assertEquals(HttpStatusCode.OK, response.status)

            val body = Json.parseToJsonElement(response.bodyAsText()).jsonObject
            assertEquals("UP", body["status"]?.jsonPrimitive?.content)
        }

    @Test
    fun `root endpoint bypasses auth even when API key is configured`() =
        testApplication {
            installAuthModule("test-secret-key")
            val client = jsonClient()

            val response = client.get("/")
            assertEquals(HttpStatusCode.OK, response.status)
        }
}
