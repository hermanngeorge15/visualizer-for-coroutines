@file:Suppress("DEPRECATION")

package com.jh.proj.coroutineviz

import io.ktor.http.HttpStatusCode
import io.ktor.server.application.Application
import io.ktor.server.application.install
import io.ktor.server.auth.Authentication
import io.ktor.server.auth.AuthenticationFailedCause
import io.ktor.server.auth.Principal
import io.ktor.server.auth.authenticate
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import org.slf4j.LoggerFactory

private val logger = LoggerFactory.getLogger("Auth")

fun Application.configureAuth() {
    val apiKey =
        environment.config.propertyOrNull("auth.apiKey")?.getString()
            ?.takeIf { it.isNotBlank() }

    if (apiKey != null) {
        logger.info("API key authentication enabled")
    } else {
        logger.info("API key authentication disabled (no key configured)")
    }

    install(Authentication) {
        provider("api-key") {
            authenticate { context ->
                if (apiKey == null) {
                    context.principal(ApiKeyPrincipal("anonymous"))
                    return@authenticate
                }

                val requestKey = context.call.request.headers["X-API-Key"]
                if (requestKey == apiKey) {
                    context.principal(ApiKeyPrincipal(requestKey))
                } else {
                    context.error(
                        "ApiKey",
                        AuthenticationFailedCause.InvalidCredentials,
                    )
                    context.challenge("ApiKey", AuthenticationFailedCause.InvalidCredentials) { _, call ->
                        call.respond(HttpStatusCode.Unauthorized, mapOf("error" to "Invalid or missing API key"))
                    }
                }
            }
        }
    }
}

data class ApiKeyPrincipal(val key: String) : Principal

fun Route.authenticatedApi(build: Route.() -> Unit) {
    authenticate("api-key") {
        build()
    }
}
