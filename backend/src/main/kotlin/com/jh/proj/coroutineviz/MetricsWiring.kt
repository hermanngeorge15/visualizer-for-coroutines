package com.jh.proj.coroutineviz

import com.jh.proj.coroutineviz.session.SessionManager
import io.micrometer.core.instrument.Gauge
import io.micrometer.prometheus.PrometheusMeterRegistry
import org.slf4j.LoggerFactory
import java.util.concurrent.atomic.AtomicInteger

private val logger = LoggerFactory.getLogger("MetricsWiring")

/** Tracks active SSE client connections. Increment on connect, decrement on disconnect. */
val sseClientsGauge = AtomicInteger(0)

fun wireMetrics(registry: PrometheusMeterRegistry) {
    Gauge.builder("viz.sessions.active") { SessionManager.listSessions().size.toDouble() }
        .description("Number of active visualization sessions")
        .register(registry)

    Gauge.builder("viz.sse.clients.active") { sseClientsGauge.toDouble() }
        .description("Number of active SSE client connections")
        .register(registry)

    logger.info("Metrics wiring complete")
}
