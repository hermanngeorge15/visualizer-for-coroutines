package com.jh.proj.coroutineviz.routes

import com.jh.proj.coroutineviz.session.SessionManager
import io.ktor.http.HttpStatusCode
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import kotlinx.serialization.Serializable

@Serializable
data class MemoryInfo(
    val usedMb: Long,
    val maxMb: Long,
    val usagePercent: Double,
)

@Serializable
data class HealthStatus(
    val status: String,
    val sessions: Int,
    val uptimeMs: Long,
    val memory: MemoryInfo,
)

private val startTime = System.currentTimeMillis()

fun Route.registerHealthRoutes() {
    get("/health") {
        val runtime = Runtime.getRuntime()
        val maxMb = runtime.maxMemory() / (1024 * 1024)
        val usedMb = (runtime.totalMemory() - runtime.freeMemory()) / (1024 * 1024)
        val usagePercent = if (maxMb > 0) (usedMb.toDouble() / maxMb * 100) else 0.0

        val memory =
            MemoryInfo(
                usedMb = usedMb,
                maxMb = maxMb,
                usagePercent = usagePercent,
            )

        val sessions = SessionManager.listSessions().size
        val uptimeMs = System.currentTimeMillis() - startTime
        val healthy = usagePercent < 90.0

        val status =
            HealthStatus(
                status = if (healthy) "UP" else "DEGRADED",
                sessions = sessions,
                uptimeMs = uptimeMs,
                memory = memory,
            )

        val httpStatus = if (healthy) HttpStatusCode.OK else HttpStatusCode.ServiceUnavailable
        call.respond(httpStatus, status)
    }
}
