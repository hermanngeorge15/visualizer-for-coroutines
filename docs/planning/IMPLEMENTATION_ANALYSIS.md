# Implementation Analysis -- Kotlin Coroutine Visualizer

This document provides deep-dive implementation details for every non-billing feature area of the Coroutine Visualizer project. Each section includes files to create or modify, key classes and interfaces, data models, API endpoints, frontend components, dependencies, estimated effort, and implementation order within that feature.

All file paths are relative to the monorepo root (`visualizer-for-coroutines/`).

---

## Table of Contents

1. [Production Readiness](#1-production-readiness)
2. [Persistence & Data Layer](#2-persistence--data-layer)
3. [Authentication & Multi-tenancy](#3-authentication--multi-tenancy)
4. [Replay Engine](#4-replay-engine)
5. [Export System](#5-export-system)
6. [Session Sharing](#6-session-sharing)
7. [Session Comparison](#7-session-comparison)
8. [OpenTelemetry Integration](#8-opentelemetry-integration)
9. [Performance & Scaling](#9-performance--scaling)
10. [IntelliJ Plugin](#10-intellij-plugin)
11. [SDK & CI/CD](#11-sdk--cicd)
12. [Frontend Testing](#12-frontend-testing)
13. [Marketing Site](#13-marketing-site-non-billing)

---

## 1. Production Readiness

**Estimated effort:** 3-4 days

### Implementation Order

1. Health endpoint
2. Logging profiles
3. CORS from config
4. OpenAPI polish
5. Bounded event store
6. Micrometer metrics enhancement

---

### 1.1 Health Endpoint

**Files to create:**

- `backend/src/main/kotlin/com/jh/proj/coroutineviz/routes/HealthRoutes.kt`

**Files to modify:**

- `backend/src/main/kotlin/com/jh/proj/coroutineviz/Routing.kt` -- wire `registerHealthRoutes()`

**Data model:**

```kotlin
// In HealthRoutes.kt
@Serializable
data class HealthStatus(
    val status: String,                    // "UP" | "DEGRADED" | "DOWN"
    val timestamp: Long,                   // System.currentTimeMillis()
    val version: String,                   // from BuildConfig or resource
    val uptime: Long,                      // millis since startup
    val components: Map<String, ComponentHealth>
)

@Serializable
data class ComponentHealth(
    val status: String,                    // "UP" | "DOWN"
    val details: Map<String, String> = emptyMap()
)
```

**Route implementation:**

```kotlin
fun Route.registerHealthRoutes() {
    get("/api/health") {
        val sessionManagerHealth = ComponentHealth(
            status = "UP",
            details = mapOf(
                "activeSessions" to SessionManager.listSessions().size.toString()
            )
        )

        val memoryHealth = run {
            val runtime = Runtime.getRuntime()
            val usedMb = (runtime.totalMemory() - runtime.freeMemory()) / 1_048_576
            val maxMb = runtime.maxMemory() / 1_048_576
            val pct = (usedMb * 100) / maxMb
            ComponentHealth(
                status = if (pct < 90) "UP" else "DEGRADED",
                details = mapOf(
                    "usedMb" to usedMb.toString(),
                    "maxMb" to maxMb.toString(),
                    "usagePercent" to "$pct%"
                )
            )
        }

        val overall = if (memoryHealth.status == "UP" && sessionManagerHealth.status == "UP")
            "UP" else "DEGRADED"

        call.respond(HttpStatusCode.OK, HealthStatus(
            status = overall,
            timestamp = System.currentTimeMillis(),
            version = "0.1.0",
            uptime = ManagementFactory.getRuntimeMXBean().uptime,
            components = mapOf(
                "sessionManager" to sessionManagerHealth,
                "memory" to memoryHealth
            )
        ))
    }

    // Lightweight probe for load balancer
    get("/api/health/live") {
        call.respondText("OK")
    }

    get("/api/health/ready") {
        // Check if SessionManager is initialized and accepting requests
        call.respondText("OK")
    }
}
```

**Routing.kt change:**

```kotlin
import com.jh.proj.coroutineviz.routes.registerHealthRoutes
// ... inside routing { ... }
registerHealthRoutes()
```

---

### 1.2 Logging Profiles

**Files to create:**

- `backend/src/main/resources/logback-dev.xml`
- `backend/src/main/resources/logback-prod.xml`

**Files to modify:**

- `backend/src/main/resources/logback.xml` -- add profile-based include

**logback-dev.xml** (verbose, colored console):

```xml
<configuration>
    <appender name="STDOUT" class="ch.qos.logback.core.ConsoleAppender">
        <encoder>
            <pattern>%d{HH:mm:ss.SSS} %highlight(%-5level) [%boldYellow(%thread)] %cyan(%logger{35}) %magenta(%C{1}:%L) %green([%X{sessionId}%X{coroutineId}]) - %msg%n</pattern>
        </encoder>
    </appender>

    <root level="DEBUG">
        <appender-ref ref="STDOUT"/>
    </root>

    <logger name="com.jh.proj" level="DEBUG"/>
    <logger name="io.ktor" level="INFO"/>
    <logger name="io.netty" level="WARN"/>
</configuration>
```

**logback-prod.xml** (structured JSON, file rolling):

```xml
<configuration>
    <appender name="JSON_FILE" class="ch.qos.logback.core.rolling.RollingFileAppender">
        <file>logs/coroutine-viz.log</file>
        <rollingPolicy class="ch.qos.logback.core.rolling.SizeAndTimeBasedRollingPolicy">
            <fileNamePattern>logs/coroutine-viz.%d{yyyy-MM-dd}.%i.log.gz</fileNamePattern>
            <maxFileSize>50MB</maxFileSize>
            <maxHistory>30</maxHistory>
            <totalSizeCap>1GB</totalSizeCap>
        </rollingPolicy>
        <encoder class="net.logstash.logback.encoder.LogstashEncoder"/>
    </appender>

    <appender name="STDOUT" class="ch.qos.logback.core.ConsoleAppender">
        <encoder class="net.logstash.logback.encoder.LogstashEncoder"/>
    </appender>

    <root level="INFO">
        <appender-ref ref="STDOUT"/>
        <appender-ref ref="JSON_FILE"/>
    </root>

    <logger name="com.jh.proj" level="INFO"/>
    <logger name="io.ktor" level="WARN"/>
</configuration>
```

**Profile switching:**

- Development: default `logback.xml` already works (current file)
- Production: launch with `-Dlogback.configurationFile=logback-prod.xml`
- Docker: set env var `JAVA_OPTS=-Dlogback.configurationFile=logback-prod.xml`

**Dependencies to add** (for JSON logging in prod):

```kotlin
// backend/build.gradle.kts
implementation("net.logstash.logback:logstash-logback-encoder:7.4")
```

---

### 1.3 CORS from Config

**Files to modify:**

- `backend/src/main/resources/application.yaml`
- `backend/src/main/kotlin/com/jh/proj/coroutineviz/HTTP.kt`

**application.yaml additions:**

```yaml
ktor:
  application:
    modules:
      - com.jh.proj.coroutineviz.ApplicationKt.module
  deployment:
    port: ${PORT:8080}

app:
  cors:
    allowed-origins:
      - "http://localhost:3000"
      - "http://127.0.0.1:3000"
    # Additional origins via CORS_ALLOWED_ORIGINS env var (comma-separated)
```

**HTTP.kt changes:**

Replace the hardcoded CORS block with config-driven logic:

```kotlin
fun Application.configureHTTP() {
    val config = environment.config

    install(CORS) {
        // Read from application.yaml
        val configOrigins = config.propertyOrNull("app.cors.allowed-origins")
            ?.getList() ?: listOf("localhost:3000", "127.0.0.1:3000")

        configOrigins.forEach { origin ->
            val cleaned = origin.removePrefix("https://").removePrefix("http://")
            if (origin.startsWith("https://")) {
                allowHost(cleaned, schemes = listOf("https"))
            } else {
                allowHost(cleaned)
            }
        }

        // Additionally read from environment variable
        val envOrigins = System.getenv("CORS_ALLOWED_ORIGINS")
        envOrigins?.split(",")?.map { it.trim() }?.forEach { origin ->
            val parts = origin.removePrefix("https://").removePrefix("http://")
            if (origin.startsWith("https://")) {
                allowHost(parts, schemes = listOf("https"))
            } else {
                allowHost(parts)
            }
            logger.info("CORS: added env origin $origin")
        }

        // Methods and headers remain the same...
        allowMethod(HttpMethod.Options)
        allowMethod(HttpMethod.Get)
        allowMethod(HttpMethod.Post)
        allowMethod(HttpMethod.Put)
        allowMethod(HttpMethod.Delete)
        allowMethod(HttpMethod.Patch)
        allowHeader(HttpHeaders.ContentType)
        allowHeader(HttpHeaders.Authorization)
        allowHeader(HttpHeaders.Accept)
        allowHeader(HttpHeaders.CacheControl)
        allowHeader(HttpHeaders.Connection)
        allowCredentials = true
        maxAgeInSeconds = 3600
    }
    // ... rest unchanged
}
```

---

### 1.4 OpenAPI Polish

**Files to modify:**

- All route files in `backend/src/main/kotlin/com/jh/proj/coroutineviz/routes/`
- All DTO classes in `backend/src/main/kotlin/com/jh/proj/coroutineviz/routes/RouteDtos.kt`

**Approach:**

Add `@Description` annotations from `io.swagger.v3.oas.annotations` (or Ktor's OpenAPI support) to every endpoint and DTO. Current routes have no annotations.

**Dependencies to add:**

```kotlin
// backend/build.gradle.kts
implementation("io.ktor:ktor-server-openapi")
// Already present. Add swagger-annotations for @Description:
implementation("io.swagger.core.v3:swagger-annotations:2.2.19")
```

**Example annotation pattern for routes:**

```kotlin
@Resource("/api/sessions")
@Description("List all active visualization sessions")
get("/api/sessions") {
    // ...
}
```

**Example annotation pattern for DTOs:**

```kotlin
@Serializable
data class SessionSnapshotResponse(
    @Description("Unique session identifier") val sessionId: String,
    @Description("Number of tracked coroutines") val coroutineCount: Int,
    @Description("Total number of events recorded") val eventCount: Int,
    @Description("Current coroutine state nodes") val coroutines: List<CoroutineNodeDto>
)
```

Scope: ~15 route endpoints and ~10 DTO classes need annotations.

---

### 1.5 Bounded Event Store

**Files to modify:**

- `backend/coroutine-viz-core/src/main/kotlin/com/jh/proj/coroutineviz/session/EventStore.kt`
- `backend/src/main/resources/application.yaml`

**EventStore.kt changes:**

```kotlin
class EventStore(
    private val maxEvents: Int = Int.MAX_VALUE
) {
    private val events = CopyOnWriteArrayList<VizEvent>()

    fun append(event: VizEvent) {
        events.add(event)
        // Trim oldest events if over limit
        while (events.size > maxEvents) {
            events.removeAt(0)
        }
    }

    fun all(): List<VizEvent> = events

    fun count(): Int = events.size

    fun since(seq: Long): List<VizEvent> =
        events.filter { it.seq > seq }
}
```

**VizSession constructor change:**

```kotlin
class VizSession(
    val sessionId: String,
    maxEvents: Int = 100_000
) {
    val store = EventStore(maxEvents)
    // ... rest unchanged
}
```

**application.yaml:**

```yaml
app:
  events:
    max-per-session: 100000
```

---

### 1.6 Micrometer Metrics Enhancement

**Files to modify:**

- `backend/src/main/kotlin/com/jh/proj/coroutineviz/Monitoring.kt`
- `backend/coroutine-viz-core/src/main/kotlin/com/jh/proj/coroutineviz/session/EventBus.kt`
- `backend/src/main/kotlin/com/jh/proj/coroutineviz/routes/SessionRoutes.kt`

**Monitoring.kt -- expose registry as singleton:**

```kotlin
object MetricsRegistry {
    val registry = PrometheusMeterRegistry(PrometheusConfig.DEFAULT)
}

fun Application.configureMonitoring() {
    install(MicrometerMetrics) {
        registry = MetricsRegistry.registry
    }
    routing {
        get("/metrics-micrometer") {
            call.respond(MetricsRegistry.registry.scrape())
        }
    }
}
```

**EventBus.kt -- add publish counter:**

```kotlin
import io.micrometer.core.instrument.Counter
import io.micrometer.core.instrument.MeterRegistry

class EventBus(meterRegistry: MeterRegistry? = null) {
    private val publishCounter = meterRegistry?.counter("viz.events.published")
    private val dropCounter = meterRegistry?.counter("viz.events.dropped")

    fun send(event: VizEvent): Boolean {
        val emitted = flow.tryEmit(event)
        if (emitted) {
            publishCounter?.increment()
        } else {
            dropCounter?.increment()
            logger.error("Event buffer full! Dropped event: ${event.kind}")
        }
        return emitted
    }
}
```

**SSE connection tracking (SessionRoutes.kt):**

```kotlin
private val sseConnectionGauge = AtomicInteger(0)
// Register gauge in monitoring: MetricsRegistry.registry.gauge("viz.sse.connections", sseConnectionGauge)

sse("/api/sessions/{id}/stream") {
    sseConnectionGauge.incrementAndGet()
    try {
        // ... existing SSE logic
    } finally {
        sseConnectionGauge.decrementAndGet()
    }
}
```

---

## 2. Persistence & Data Layer

**Estimated effort:** 5-7 days

### Implementation Order

1. Define `SessionStore` and `EventStoreInterface` abstractions
2. Implement `InMemorySessionStore` and `InMemoryEventStore`
3. Add database dependencies
4. SQL migrations
5. `JdbcSessionStore` and `JdbcEventStore`
6. `StorageFactory` with config switching
7. Background retention coroutine
8. Config wiring

---

### 2.1 Storage Interfaces

**Files to create:**

- `backend/coroutine-viz-core/src/main/kotlin/com/jh/proj/coroutineviz/storage/SessionStore.kt`
- `backend/coroutine-viz-core/src/main/kotlin/com/jh/proj/coroutineviz/storage/EventStoreInterface.kt`

```kotlin
// SessionStore.kt
package com.jh.proj.coroutineviz.storage

import com.jh.proj.coroutineviz.models.SessionInfo

interface SessionStore {
    fun create(sessionId: String, name: String? = null): SessionMetadata
    fun get(sessionId: String): SessionMetadata?
    fun list(): List<SessionMetadata>
    fun delete(sessionId: String): Boolean
    fun update(sessionId: String, updater: (SessionMetadata) -> SessionMetadata): SessionMetadata?
    fun count(): Int
}

@Serializable
data class SessionMetadata(
    val sessionId: String,
    val name: String?,
    val createdAt: Long,      // epoch millis
    val lastEventAt: Long?,   // epoch millis
    val eventCount: Int,
    val coroutineCount: Int,
    val userId: String? = null,     // Phase 3: multi-tenancy
    val tenantId: String? = null    // Phase 3: multi-tenancy
)
```

```kotlin
// EventStoreInterface.kt
package com.jh.proj.coroutineviz.storage

import com.jh.proj.coroutineviz.events.VizEvent

interface EventStoreInterface {
    fun append(event: VizEvent)
    fun getEvents(sessionId: String, sinceSeq: Long = 0, limit: Int = Int.MAX_VALUE): List<VizEvent>
    fun getCount(sessionId: String): Int
    fun deleteBySession(sessionId: String): Int
    fun all(): List<VizEvent>
}
```

---

### 2.2 In-Memory Implementations

**Files to create:**

- `backend/coroutine-viz-core/src/main/kotlin/com/jh/proj/coroutineviz/storage/InMemorySessionStore.kt`
- `backend/coroutine-viz-core/src/main/kotlin/com/jh/proj/coroutineviz/storage/InMemoryEventStore.kt`

```kotlin
// InMemorySessionStore.kt
class InMemorySessionStore : SessionStore {
    private val sessions = ConcurrentHashMap<String, SessionMetadata>()

    override fun create(sessionId: String, name: String?): SessionMetadata {
        val meta = SessionMetadata(
            sessionId = sessionId,
            name = name,
            createdAt = System.currentTimeMillis(),
            lastEventAt = null,
            eventCount = 0,
            coroutineCount = 0
        )
        sessions[sessionId] = meta
        return meta
    }

    override fun get(sessionId: String): SessionMetadata? = sessions[sessionId]
    override fun list(): List<SessionMetadata> = sessions.values.toList()
    override fun delete(sessionId: String): Boolean = sessions.remove(sessionId) != null
    override fun update(sessionId: String, updater: (SessionMetadata) -> SessionMetadata): SessionMetadata? {
        return sessions.computeIfPresent(sessionId) { _, existing -> updater(existing) }
    }
    override fun count(): Int = sessions.size
}
```

```kotlin
// InMemoryEventStore.kt
class InMemoryEventStore(
    private val maxEventsPerSession: Int = 100_000
) : EventStoreInterface {
    private val events = ConcurrentHashMap<String, CopyOnWriteArrayList<VizEvent>>()

    override fun append(event: VizEvent) {
        val sessionEvents = events.getOrPut(event.sessionId) { CopyOnWriteArrayList() }
        sessionEvents.add(event)
        while (sessionEvents.size > maxEventsPerSession) {
            sessionEvents.removeAt(0)
        }
    }

    override fun getEvents(sessionId: String, sinceSeq: Long, limit: Int): List<VizEvent> {
        return events[sessionId]
            ?.filter { it.seq > sinceSeq }
            ?.take(limit)
            ?: emptyList()
    }

    override fun getCount(sessionId: String): Int = events[sessionId]?.size ?: 0

    override fun deleteBySession(sessionId: String): Int {
        val removed = events.remove(sessionId)
        return removed?.size ?: 0
    }

    override fun all(): List<VizEvent> = events.values.flatten()
}
```

---

### 2.3 Database Dependencies

**Files to modify:**

- `backend/build.gradle.kts`

**Dependencies to add:**

```kotlin
// Exposed ORM
implementation("org.jetbrains.exposed:exposed-core:0.55.0")
implementation("org.jetbrains.exposed:exposed-dao:0.55.0")
implementation("org.jetbrains.exposed:exposed-jdbc:0.55.0")
implementation("org.jetbrains.exposed:exposed-json:0.55.0")
implementation("org.jetbrains.exposed:exposed-java-time:0.55.0")

// Connection pooling
implementation("com.zaxxer:HikariCP:5.1.0")

// H2 for development / testing
implementation("com.h2database:h2:2.2.224")

// PostgreSQL for production
runtimeOnly("org.postgresql:postgresql:42.7.4")

// Flyway for migrations
implementation("org.flywaydb:flyway-core:10.20.1")
implementation("org.flywaydb:flyway-database-postgresql:10.20.1")
```

---

### 2.4 SQL Migrations

**Files to create:**

- `backend/src/main/resources/db/migration/V001__create_sessions_table.sql`
- `backend/src/main/resources/db/migration/V002__create_events_table.sql`
- `backend/src/main/resources/db/migration/V003__add_indexes.sql`

**V001__create_sessions_table.sql:**

```sql
CREATE TABLE sessions (
    session_id    VARCHAR(255) PRIMARY KEY,
    name          VARCHAR(255),
    created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_event_at TIMESTAMP WITH TIME ZONE,
    event_count   INTEGER NOT NULL DEFAULT 0,
    coroutine_count INTEGER NOT NULL DEFAULT 0,
    user_id       VARCHAR(255),
    tenant_id     VARCHAR(255)
);
```

**V002__create_events_table.sql:**

```sql
CREATE TABLE events (
    id          BIGSERIAL PRIMARY KEY,
    session_id  VARCHAR(255) NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
    seq         BIGINT NOT NULL,
    ts_nanos    BIGINT NOT NULL,
    kind        VARCHAR(100) NOT NULL,
    payload     JSONB NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (session_id, seq)
);
```

**V003__add_indexes.sql:**

```sql
CREATE INDEX idx_events_session_id ON events(session_id);
CREATE INDEX idx_events_session_seq ON events(session_id, seq);
CREATE INDEX idx_events_kind ON events(kind);
CREATE INDEX idx_events_ts ON events(ts_nanos);
CREATE INDEX idx_sessions_user ON sessions(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_sessions_tenant ON sessions(tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX idx_sessions_created ON sessions(created_at);
```

---

### 2.5 JDBC Implementations

**Files to create:**

- `backend/src/main/kotlin/com/jh/proj/coroutineviz/storage/DatabaseConfig.kt`
- `backend/src/main/kotlin/com/jh/proj/coroutineviz/storage/JdbcSessionStore.kt`
- `backend/src/main/kotlin/com/jh/proj/coroutineviz/storage/JdbcEventStore.kt`
- `backend/src/main/kotlin/com/jh/proj/coroutineviz/storage/Tables.kt`

**Tables.kt (Exposed table definitions):**

```kotlin
package com.jh.proj.coroutineviz.storage

import org.jetbrains.exposed.dao.id.LongIdTable
import org.jetbrains.exposed.sql.Table
import org.jetbrains.exposed.sql.javatime.timestamp
import org.jetbrains.exposed.sql.json.jsonb

object SessionsTable : Table("sessions") {
    val sessionId = varchar("session_id", 255)
    val name = varchar("name", 255).nullable()
    val createdAt = timestamp("created_at")
    val lastEventAt = timestamp("last_event_at").nullable()
    val eventCount = integer("event_count").default(0)
    val coroutineCount = integer("coroutine_count").default(0)
    val userId = varchar("user_id", 255).nullable()
    val tenantId = varchar("tenant_id", 255).nullable()

    override val primaryKey = PrimaryKey(sessionId)
}

object EventsTable : LongIdTable("events") {
    val sessionId = varchar("session_id", 255).references(SessionsTable.sessionId)
    val seq = long("seq")
    val tsNanos = long("ts_nanos")
    val kind = varchar("kind", 100)
    val payload = jsonb<String>("payload")  // Raw JSON string
    val createdAt = timestamp("created_at")

    init {
        uniqueIndex(sessionId, seq)
    }
}
```

**JdbcSessionStore.kt:**

```kotlin
class JdbcSessionStore : SessionStore {
    override fun create(sessionId: String, name: String?): SessionMetadata {
        return transaction {
            SessionsTable.insert {
                it[SessionsTable.sessionId] = sessionId
                it[SessionsTable.name] = name
                it[createdAt] = Instant.now()
            }
            SessionMetadata(
                sessionId = sessionId,
                name = name,
                createdAt = System.currentTimeMillis(),
                lastEventAt = null,
                eventCount = 0,
                coroutineCount = 0
            )
        }
    }

    override fun get(sessionId: String): SessionMetadata? {
        return transaction {
            SessionsTable.selectAll()
                .where { SessionsTable.sessionId eq sessionId }
                .singleOrNull()
                ?.toSessionMetadata()
        }
    }

    override fun list(): List<SessionMetadata> {
        return transaction {
            SessionsTable.selectAll()
                .orderBy(SessionsTable.createdAt)
                .map { it.toSessionMetadata() }
        }
    }

    override fun delete(sessionId: String): Boolean {
        return transaction {
            SessionsTable.deleteWhere { SessionsTable.sessionId eq sessionId } > 0
        }
    }

    override fun update(sessionId: String, updater: (SessionMetadata) -> SessionMetadata): SessionMetadata? {
        return transaction {
            val existing = get(sessionId) ?: return@transaction null
            val updated = updater(existing)
            SessionsTable.update({ SessionsTable.sessionId eq sessionId }) {
                it[eventCount] = updated.eventCount
                it[coroutineCount] = updated.coroutineCount
                it[lastEventAt] = updated.lastEventAt?.let { ts -> Instant.ofEpochMilli(ts) }
            }
            updated
        }
    }

    override fun count(): Int = transaction { SessionsTable.selectAll().count().toInt() }
}
```

**JdbcEventStore.kt:**

```kotlin
class JdbcEventStore(
    private val jsonSerializer: Json = Json { ignoreUnknownKeys = true }
) : EventStoreInterface {

    override fun append(event: VizEvent) {
        transaction {
            EventsTable.insert {
                it[sessionId] = event.sessionId
                it[seq] = event.seq
                it[tsNanos] = event.tsNanos
                it[kind] = event.kind
                it[payload] = serializeVizEvent(event)  // reuse existing serializer
                it[createdAt] = Instant.now()
            }
            // Update session event count
            SessionsTable.update({ SessionsTable.sessionId eq event.sessionId }) {
                with(SqlExpressionBuilder) {
                    it[eventCount] = eventCount + 1
                    it[lastEventAt] = Instant.now()
                }
            }
        }
    }

    override fun getEvents(sessionId: String, sinceSeq: Long, limit: Int): List<VizEvent> {
        return transaction {
            EventsTable.selectAll()
                .where { (EventsTable.sessionId eq sessionId) and (EventsTable.seq greater sinceSeq) }
                .orderBy(EventsTable.seq)
                .limit(limit)
                .map { row -> deserializeEvent(row[EventsTable.payload], row[EventsTable.kind]) }
        }
    }

    override fun getCount(sessionId: String): Int {
        return transaction {
            EventsTable.selectAll()
                .where { EventsTable.sessionId eq sessionId }
                .count().toInt()
        }
    }

    override fun deleteBySession(sessionId: String): Int {
        return transaction {
            EventsTable.deleteWhere { EventsTable.sessionId eq sessionId }
        }
    }

    override fun all(): List<VizEvent> {
        return transaction {
            EventsTable.selectAll()
                .orderBy(EventsTable.seq)
                .map { row -> deserializeEvent(row[EventsTable.payload], row[EventsTable.kind]) }
        }
    }
}
```

---

### 2.6 StorageFactory

**Files to create:**

- `backend/src/main/kotlin/com/jh/proj/coroutineviz/storage/StorageFactory.kt`
- `backend/src/main/kotlin/com/jh/proj/coroutineviz/storage/DatabaseConfig.kt`

```kotlin
// StorageFactory.kt
object StorageFactory {
    fun createSessionStore(config: ApplicationConfig): SessionStore {
        val type = config.propertyOrNull("app.storage.type")?.getString() ?: "memory"
        return when (type) {
            "memory" -> InMemorySessionStore()
            "jdbc" -> {
                initDatabase(config)
                JdbcSessionStore()
            }
            else -> throw IllegalArgumentException("Unknown storage type: $type")
        }
    }

    fun createEventStore(config: ApplicationConfig): EventStoreInterface {
        val type = config.propertyOrNull("app.storage.type")?.getString() ?: "memory"
        val maxEvents = config.propertyOrNull("app.events.max-per-session")?.getString()?.toInt() ?: 100_000
        return when (type) {
            "memory" -> InMemoryEventStore(maxEvents)
            "jdbc" -> {
                initDatabase(config)
                JdbcEventStore()
            }
            else -> throw IllegalArgumentException("Unknown storage type: $type")
        }
    }

    private var dbInitialized = false

    @Synchronized
    private fun initDatabase(config: ApplicationConfig) {
        if (dbInitialized) return
        DatabaseConfig.init(config)
        dbInitialized = true
    }
}
```

```kotlin
// DatabaseConfig.kt
object DatabaseConfig {
    fun init(config: ApplicationConfig) {
        val url = config.property("app.storage.jdbc.url").getString()
        val driver = config.propertyOrNull("app.storage.jdbc.driver")?.getString()
            ?: if (url.contains("h2")) "org.h2.Driver" else "org.postgresql.Driver"
        val user = config.propertyOrNull("app.storage.jdbc.user")?.getString() ?: ""
        val password = config.propertyOrNull("app.storage.jdbc.password")?.getString() ?: ""

        val hikariConfig = HikariConfig().apply {
            jdbcUrl = url
            driverClassName = driver
            username = user
            this.password = password
            maximumPoolSize = 10
            minimumIdle = 2
            idleTimeout = 60_000
            connectionTimeout = 10_000
        }

        val dataSource = HikariDataSource(hikariConfig)
        Database.connect(dataSource)

        // Run Flyway migrations
        Flyway.configure()
            .dataSource(dataSource)
            .locations("classpath:db/migration")
            .load()
            .migrate()
    }
}
```

---

### 2.7 Background Retention Coroutine

**Files to create:**

- `backend/src/main/kotlin/com/jh/proj/coroutineviz/storage/RetentionService.kt`

```kotlin
class RetentionService(
    private val sessionStore: SessionStore,
    private val eventStore: EventStoreInterface,
    private val maxAgeMillis: Long = 24 * 60 * 60 * 1000,    // 24 hours default
    private val maxEventsPerSession: Int = 100_000,
    private val checkIntervalMillis: Long = 60 * 60 * 1000   // 1 hour
) {
    private val logger = LoggerFactory.getLogger(RetentionService::class.java)
    private var job: Job? = null

    fun start(scope: CoroutineScope) {
        job = scope.launch {
            while (isActive) {
                try {
                    cleanup()
                } catch (e: Exception) {
                    logger.error("Retention cleanup failed", e)
                }
                delay(checkIntervalMillis)
            }
        }
    }

    fun stop() {
        job?.cancel()
    }

    private fun cleanup() {
        val cutoff = System.currentTimeMillis() - maxAgeMillis
        val allSessions = sessionStore.list()
        var removedSessions = 0
        var trimmedEvents = 0

        for (session in allSessions) {
            // Delete sessions older than max age
            if (session.createdAt < cutoff) {
                eventStore.deleteBySession(session.sessionId)
                sessionStore.delete(session.sessionId)
                removedSessions++
                continue
            }

            // Trim excess events (for JDBC implementation)
            val count = eventStore.getCount(session.sessionId)
            if (count > maxEventsPerSession) {
                // In JDBC: DELETE FROM events WHERE session_id = ? AND seq <= (select seq from events where session_id = ? order by seq limit 1 offset ?)
                trimmedEvents += (count - maxEventsPerSession)
            }
        }

        if (removedSessions > 0 || trimmedEvents > 0) {
            logger.info("Retention cleanup: removed $removedSessions sessions, trimmed $trimmedEvents events")
        }
    }
}
```

---

### 2.8 Config in application.yaml

Full config block addition:

```yaml
app:
  storage:
    type: memory                   # "memory" or "jdbc"
    jdbc:
      url: "jdbc:h2:mem:coroutineviz;DB_CLOSE_DELAY=-1"
      driver: "org.h2.Driver"
      user: ""
      password: ""
  retention:
    max-age: 86400000              # 24 hours in millis
    max-events-per-session: 100000
    check-interval: 3600000        # 1 hour in millis
  cors:
    allowed-origins:
      - "http://localhost:3000"
      - "http://127.0.0.1:3000"
  events:
    max-per-session: 100000
```

---

## 3. Authentication & Multi-tenancy

**Estimated effort:** 5-6 days

### Implementation Order

1. Phase A: API key authentication
2. Phase B: JWT authentication
3. Phase C: Multi-tenancy data filtering
4. Frontend auth integration

---

### 3.1 Phase A -- API Key Authentication

**Dependencies to add:**

```kotlin
// backend/build.gradle.kts
implementation("io.ktor:ktor-server-auth")
```

**Files to create:**

- `backend/src/main/kotlin/com/jh/proj/coroutineviz/auth/ApiKeyStore.kt`
- `backend/src/main/kotlin/com/jh/proj/coroutineviz/auth/AuthConfig.kt`

**ApiKeyStore.kt:**

```kotlin
package com.jh.proj.coroutineviz.auth

data class ApiKeyInfo(
    val key: String,
    val userId: String,
    val name: String,
    val roles: Set<String> = setOf("user"),
    val createdAt: Long = System.currentTimeMillis()
)

interface ApiKeyStore {
    fun validate(key: String): ApiKeyInfo?
    fun create(userId: String, name: String): ApiKeyInfo
    fun revoke(key: String): Boolean
    fun listForUser(userId: String): List<ApiKeyInfo>
}

class InMemoryApiKeyStore : ApiKeyStore {
    private val keys = ConcurrentHashMap<String, ApiKeyInfo>()

    // Bootstrap with a dev key
    init {
        val devKey = System.getenv("VIZ_API_KEY") ?: "dev-key-12345"
        keys[devKey] = ApiKeyInfo(
            key = devKey,
            userId = "dev-user",
            name = "Development Key"
        )
    }

    override fun validate(key: String): ApiKeyInfo? = keys[key]

    override fun create(userId: String, name: String): ApiKeyInfo {
        val key = "viz-${UUID.randomUUID()}"
        val info = ApiKeyInfo(key = key, userId = userId, name = name)
        keys[key] = info
        return info
    }

    override fun revoke(key: String): Boolean = keys.remove(key) != null

    override fun listForUser(userId: String): List<ApiKeyInfo> =
        keys.values.filter { it.userId == userId }
}
```

**AuthConfig.kt:**

```kotlin
package com.jh.proj.coroutineviz.auth

import io.ktor.server.application.*
import io.ktor.server.auth.*

data class UserPrincipal(
    val userId: String,
    val email: String? = null,
    val roles: Set<String> = setOf("user"),
    val tenantId: String? = null
) : Principal

fun Application.configureAuth() {
    val apiKeyStore = InMemoryApiKeyStore()
    val authEnabled = environment.config.propertyOrNull("app.auth.enabled")?.getString()?.toBoolean() ?: false

    if (!authEnabled) return

    install(Authentication) {
        // API Key auth (header or query param)
        provider("api-key") {
            authenticate { context ->
                val key = context.call.request.headers["X-API-Key"]
                    ?: context.call.request.queryParameters["apiKey"]

                if (key != null) {
                    val info = apiKeyStore.validate(key)
                    if (info != null) {
                        context.principal(UserPrincipal(
                            userId = info.userId,
                            roles = info.roles
                        ))
                    }
                }
            }
        }
    }
}
```

**Files to modify:**

- `backend/src/main/kotlin/com/jh/proj/coroutineviz/Application.kt` -- add `configureAuth()` call
- `backend/src/main/kotlin/com/jh/proj/coroutineviz/Routing.kt` -- wrap protected routes

**Routing.kt change (conditional auth wrapping):**

```kotlin
fun Application.configureRouting() {
    install(SSE)
    val authEnabled = environment.config.propertyOrNull("app.auth.enabled")?.getString()?.toBoolean() ?: false

    routing {
        registerRootRoutes()
        registerHealthRoutes()

        // Conditionally wrap routes with auth
        if (authEnabled) {
            authenticate("api-key") {
                registerSessionRoutes()
                registerValidationRoutes()
                registerScenarioRunnerRoutes()
                // ... etc
            }
        } else {
            registerSessionRoutes()
            registerValidationRoutes()
            registerScenarioRunnerRoutes()
            // ... etc
        }
    }
}
```

---

### 3.2 Phase B -- JWT Authentication

**Dependencies to add:**

```kotlin
// backend/build.gradle.kts
implementation("io.ktor:ktor-server-auth-jwt")
```

**Files to create:**

- `backend/src/main/kotlin/com/jh/proj/coroutineviz/auth/JwtConfig.kt`

```kotlin
package com.jh.proj.coroutineviz.auth

import com.auth0.jwt.JWT
import com.auth0.jwt.algorithms.Algorithm
import io.ktor.server.application.*
import io.ktor.server.auth.*
import io.ktor.server.auth.jwt.*

fun Application.configureJwtAuth() {
    val jwtIssuer = environment.config.property("app.auth.jwt.issuer").getString()
    val jwtAudience = environment.config.property("app.auth.jwt.audience").getString()
    val jwtRealm = environment.config.propertyOrNull("app.auth.jwt.realm")?.getString() ?: "coroutine-viz"
    val jwtSecret = environment.config.property("app.auth.jwt.secret").getString()

    install(Authentication) {
        jwt("jwt") {
            realm = jwtRealm
            verifier(
                JWT.require(Algorithm.HMAC256(jwtSecret))
                    .withIssuer(jwtIssuer)
                    .withAudience(jwtAudience)
                    .build()
            )
            validate { credential ->
                val userId = credential.payload.getClaim("userId").asString()
                val email = credential.payload.getClaim("email").asString()
                val roles = credential.payload.getClaim("roles").asList(String::class.java)?.toSet() ?: setOf("user")
                val tenantId = credential.payload.getClaim("tenantId").asString()

                if (userId != null) {
                    UserPrincipal(
                        userId = userId,
                        email = email,
                        roles = roles,
                        tenantId = tenantId
                    )
                } else null
            }
        }
    }
}
```

**application.yaml additions:**

```yaml
app:
  auth:
    enabled: false
    type: "api-key"        # "api-key" | "jwt" | "both"
    jwt:
      issuer: "coroutine-viz"
      audience: "coroutine-viz-api"
      realm: "coroutine-viz"
      secret: ${JWT_SECRET:"dev-secret-change-in-production"}
```

---

### 3.3 Phase C -- Multi-tenancy

**Files to modify:**

- `backend/coroutine-viz-core/src/main/kotlin/com/jh/proj/coroutineviz/session/SessionManager.kt`
- `backend/src/main/kotlin/com/jh/proj/coroutineviz/routes/SessionRoutes.kt`

**SessionManager -- add tenant-aware methods:**

```kotlin
object SessionManager {
    fun createSession(name: String? = null, userId: String? = null, tenantId: String? = null): VizSession {
        // ... existing logic, store userId/tenantId in metadata
    }

    fun listSessionsForTenant(tenantId: String): List<SessionInfo> {
        return sessions.values
            .filter { it.tenantId == tenantId }
            .map { /* ... */ }
    }

    fun getSessionForTenant(sessionId: String, tenantId: String): VizSession? {
        val session = sessions[sessionId] ?: return null
        return if (session.tenantId == tenantId || session.tenantId == null) session else null
    }
}
```

**SessionRoutes -- extract principal and filter:**

```kotlin
get("/api/sessions") {
    val principal = call.principal<UserPrincipal>()
    val sessions = if (principal?.tenantId != null) {
        SessionManager.listSessionsForTenant(principal.tenantId)
    } else {
        SessionManager.listSessions()
    }
    call.respond(HttpStatusCode.OK, sessions)
}
```

---

### 3.4 Frontend Auth Integration

**Files to create:**

- `frontend/src/hooks/use-auth.ts`

**Files to modify:**

- `frontend/src/lib/api-client.ts`

**use-auth.ts:**

```typescript
import { useState, useCallback, createContext, useContext } from 'react'

interface AuthState {
  isAuthenticated: boolean
  apiKey: string | null
  token: string | null    // JWT
  userId: string | null
}

interface AuthContextValue extends AuthState {
  setApiKey: (key: string) => void
  setToken: (token: string) => void
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export function useAuthState() {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    apiKey: localStorage.getItem('viz-api-key'),
    token: localStorage.getItem('viz-token'),
    userId: null,
  })

  const setApiKey = useCallback((key: string) => {
    localStorage.setItem('viz-api-key', key)
    setState(prev => ({ ...prev, apiKey: key, isAuthenticated: true }))
  }, [])

  const setToken = useCallback((token: string) => {
    localStorage.setItem('viz-token', token)
    setState(prev => ({ ...prev, token, isAuthenticated: true }))
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('viz-api-key')
    localStorage.removeItem('viz-token')
    setState({ isAuthenticated: false, apiKey: null, token: null, userId: null })
  }, [])

  return { ...state, setApiKey, setToken, logout }
}
```

**api-client.ts changes (header injection):**

```typescript
class ApiClient {
  private getAuthHeaders(): Record<string, string> {
    const apiKey = localStorage.getItem('viz-api-key')
    const token = localStorage.getItem('viz-token')

    if (token) return { Authorization: `Bearer ${token}` }
    if (apiKey) return { 'X-API-Key': apiKey }
    return {}
  }

  private async fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${url}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders(),
        ...options?.headers,
      },
    })
    // ... existing error handling
  }
}
```

---

## 4. Replay Engine

**Estimated effort:** 4-5 days

This is entirely a frontend feature. No backend changes needed -- all events are already stored and returned by `GET /api/sessions/{id}/events`.

### Implementation Order

1. `useReplay` hook (state machine + event queue)
2. `AnimationScheduler` (rAF dispatch loop)
3. `ReplayController.tsx` (playback UI)
4. Wire into `SessionDetails` so all panels respect replay cursor
5. Progress bar with scrubber

---

### 4.1 useReplay Hook

**Files to create:**

- `frontend/src/hooks/use-replay.ts`

```typescript
import { useState, useCallback, useRef, useEffect } from 'react'
import type { VizEvent } from '@/types/api'

type ReplayState = 'idle' | 'playing' | 'paused' | 'stepping'

interface ReplayControls {
  state: ReplayState
  currentStep: number
  totalSteps: number
  speed: number               // 1x, 2x, 4x, 0.5x, 0.25x
  visibleEvents: VizEvent[]   // events[0..currentStep]
  currentEvent: VizEvent | null
  play: () => void
  pause: () => void
  stop: () => void
  stepForward: () => void
  stepBackward: () => void
  seekTo: (step: number) => void
  setSpeed: (speed: number) => void
}

export function useReplay(allEvents: VizEvent[]): ReplayControls {
  const [state, setState] = useState<ReplayState>('idle')
  const [currentStep, setCurrentStep] = useState(0)
  const [speed, setSpeed] = useState(1)
  const animationRef = useRef<number | null>(null)
  const lastTickRef = useRef<number>(0)

  // Sort events by seq for deterministic replay order
  const sortedEvents = useMemo(
    () => [...allEvents].sort((a, b) => a.seq - b.seq),
    [allEvents]
  )

  const totalSteps = sortedEvents.length
  const visibleEvents = useMemo(
    () => sortedEvents.slice(0, currentStep + 1),
    [sortedEvents, currentStep]
  )
  const currentEvent = sortedEvents[currentStep] ?? null

  // Compute inter-event delay from tsNanos, scaled by speed
  const getDelayForStep = useCallback((step: number): number => {
    if (step <= 0 || step >= sortedEvents.length) return 0
    const deltaNanos = sortedEvents[step].tsNanos - sortedEvents[step - 1].tsNanos
    const deltaMs = deltaNanos / 1_000_000
    // Clamp to reasonable range: 16ms min (60fps), 2000ms max
    const clamped = Math.max(16, Math.min(2000, deltaMs))
    return clamped / speed
  }, [sortedEvents, speed])

  // Animation loop
  const tick = useCallback((timestamp: number) => {
    if (state !== 'playing') return

    const elapsed = timestamp - lastTickRef.current
    const requiredDelay = getDelayForStep(currentStep)

    if (elapsed >= requiredDelay) {
      lastTickRef.current = timestamp
      setCurrentStep(prev => {
        if (prev >= totalSteps - 1) {
          setState('idle')
          return prev
        }
        return prev + 1
      })
    }

    animationRef.current = requestAnimationFrame(tick)
  }, [state, currentStep, totalSteps, getDelayForStep])

  useEffect(() => {
    if (state === 'playing') {
      lastTickRef.current = performance.now()
      animationRef.current = requestAnimationFrame(tick)
    }
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [state, tick])

  const play = useCallback(() => setState('playing'), [])
  const pause = useCallback(() => setState('paused'), [])
  const stop = useCallback(() => { setState('idle'); setCurrentStep(0) }, [])
  const stepForward = useCallback(() => {
    setCurrentStep(prev => Math.min(prev + 1, totalSteps - 1))
    setState('stepping')
  }, [totalSteps])
  const stepBackward = useCallback(() => {
    setCurrentStep(prev => Math.max(prev - 1, 0))
    setState('stepping')
  }, [])
  const seekTo = useCallback((step: number) => {
    setCurrentStep(Math.max(0, Math.min(step, totalSteps - 1)))
  }, [totalSteps])

  return {
    state, currentStep, totalSteps, speed,
    visibleEvents, currentEvent,
    play, pause, stop, stepForward, stepBackward, seekTo, setSpeed,
  }
}
```

---

### 4.2 ReplayController.tsx

**Files to create:**

- `frontend/src/components/ReplayController.tsx`

```typescript
import { Card, CardBody, Button, Slider, Chip, Select, SelectItem } from '@heroui/react'
import { FiPlay, FiPause, FiSquare, FiSkipForward, FiSkipBack } from 'react-icons/fi'
import type { ReplayControls } from '@/hooks/use-replay'

const SPEED_OPTIONS = [
  { value: 0.25, label: '0.25x' },
  { value: 0.5,  label: '0.5x' },
  { value: 1,    label: '1x' },
  { value: 2,    label: '2x' },
  { value: 4,    label: '4x' },
  { value: 10,   label: '10x' },
]

interface Props {
  replay: ReplayControls
}

export function ReplayController({ replay }: Props) {
  return (
    <Card>
      <CardBody className="flex items-center gap-4">
        {/* Playback controls */}
        <div className="flex items-center gap-1">
          <Button isIconOnly size="sm" variant="flat" onPress={replay.stepBackward}><FiSkipBack /></Button>
          {replay.state === 'playing' ? (
            <Button isIconOnly size="sm" color="primary" onPress={replay.pause}><FiPause /></Button>
          ) : (
            <Button isIconOnly size="sm" color="primary" onPress={replay.play}><FiPlay /></Button>
          )}
          <Button isIconOnly size="sm" variant="flat" onPress={replay.stop}><FiSquare /></Button>
          <Button isIconOnly size="sm" variant="flat" onPress={replay.stepForward}><FiSkipForward /></Button>
        </div>

        {/* Progress scrubber */}
        <div className="flex-1">
          <Slider
            aria-label="Replay progress"
            minValue={0}
            maxValue={Math.max(0, replay.totalSteps - 1)}
            value={replay.currentStep}
            onChange={(val) => replay.seekTo(val as number)}
            size="sm"
          />
        </div>

        {/* Step counter */}
        <Chip size="sm" variant="flat">
          {replay.currentStep + 1} / {replay.totalSteps}
        </Chip>

        {/* Speed selector */}
        <Select
          aria-label="Playback speed"
          size="sm"
          className="w-24"
          selectedKeys={[replay.speed.toString()]}
          onChange={(e) => replay.setSpeed(Number(e.target.value))}
        >
          {SPEED_OPTIONS.map(opt => (
            <SelectItem key={opt.value.toString()} value={opt.value.toString()}>
              {opt.label}
            </SelectItem>
          ))}
        </Select>

        {/* Current event kind */}
        {replay.currentEvent && (
          <Chip size="sm" color="secondary" variant="bordered">
            {replay.currentEvent.kind}
          </Chip>
        )}
      </CardBody>
    </Card>
  )
}
```

---

### 4.3 Wire into SessionDetails

**Files to modify:**

- `frontend/src/components/SessionDetails.tsx`

Add a "Replay" mode toggle. When replay mode is active, all panels receive `replay.visibleEvents` instead of `allEvents`. The key changes:

```typescript
// In SessionDetails.tsx
import { useReplay } from '@/hooks/use-replay'
import { ReplayController } from './ReplayController'

// Inside the component:
const [replayMode, setReplayMode] = useState(false)
const replay = useReplay(storedEvents || [])

// Choose which events to feed to panels
const displayEvents = replayMode ? replay.visibleEvents : allEvents

// Render replay controller when active
{replayMode && <ReplayController replay={replay} />}

// Pass displayEvents to all panels instead of allEvents:
// <EventsList events={displayEvents} />
// <CoroutineTree coroutines={computeCoroutinesFromEvents(displayEvents)} />
```

---

## 5. Export System

**Estimated effort:** 3-4 days

### Implementation Order

1. Add html2canvas + file-saver dependencies
2. Create `export-utils.ts`
3. Build `ExportMenu.tsx` dropdown
4. Add export buttons to visualization toolbars
5. SVG serialization
6. Video capture via MediaRecorder

---

### 5.1 Dependencies

**Files to modify:**

- `frontend/package.json`

```json
{
  "dependencies": {
    "html2canvas": "^1.4.1",
    "file-saver": "^2.0.5"
  },
  "devDependencies": {
    "@types/file-saver": "^2.0.7"
  }
}
```

---

### 5.2 export-utils.ts

**Files to create:**

- `frontend/src/lib/export-utils.ts`

```typescript
import html2canvas from 'html2canvas'
import { saveAs } from 'file-saver'

/**
 * Export a DOM element as a PNG image.
 */
export async function exportAsPng(
  element: HTMLElement,
  filename: string = 'coroutine-viz-export'
): Promise<void> {
  const canvas = await html2canvas(element, {
    backgroundColor: '#18181b',  // dark theme background
    scale: 2,                    // retina quality
    logging: false,
    useCORS: true,
  })
  canvas.toBlob((blob) => {
    if (blob) saveAs(blob, `${filename}.png`)
  })
}

/**
 * Export an SVG element as a standalone .svg file with embedded styles.
 */
export function exportAsSvg(
  svgElement: SVGElement,
  filename: string = 'coroutine-viz-export'
): void {
  const clone = svgElement.cloneNode(true) as SVGElement
  // Embed computed styles as inline styles
  embedComputedStyles(clone)
  // Add XML declaration
  const serializer = new XMLSerializer()
  const svgString = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    serializer.serializeToString(clone)
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
  saveAs(blob, `${filename}.svg`)
}

function embedComputedStyles(element: Element): void {
  if (element instanceof HTMLElement || element instanceof SVGElement) {
    const computed = window.getComputedStyle(element)
    const important = ['fill', 'stroke', 'stroke-width', 'font-family', 'font-size',
      'font-weight', 'color', 'opacity', 'transform']
    important.forEach(prop => {
      const val = computed.getPropertyValue(prop)
      if (val) (element as HTMLElement).style.setProperty(prop, val)
    })
  }
  Array.from(element.children).forEach(child => embedComputedStyles(child))
}

/**
 * Export events as JSON file.
 */
export function exportAsJson(data: unknown, filename: string = 'coroutine-viz-events'): void {
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  saveAs(blob, `${filename}.json`)
}

/**
 * Video capture using MediaRecorder API.
 * Call startRecording() to begin, stopRecording() to finalize and download.
 */
let mediaRecorder: MediaRecorder | null = null
let recordedChunks: Blob[] = []

export function startRecording(element: HTMLElement): void {
  const canvas = document.createElement('canvas')
  canvas.width = element.offsetWidth * 2
  canvas.height = element.offsetHeight * 2
  const stream = canvas.captureStream(30) // 30 fps
  recordedChunks = []

  mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9' })
  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) recordedChunks.push(e.data)
  }
  mediaRecorder.start()

  // Periodically render element to canvas
  const ctx = canvas.getContext('2d')!
  const renderLoop = async () => {
    if (!mediaRecorder || mediaRecorder.state !== 'recording') return
    const rendered = await html2canvas(element, { scale: 2, logging: false })
    ctx.drawImage(rendered, 0, 0)
    requestAnimationFrame(renderLoop)
  }
  renderLoop()
}

export function stopRecording(filename: string = 'coroutine-viz-recording'): void {
  if (!mediaRecorder) return
  mediaRecorder.onstop = () => {
    const blob = new Blob(recordedChunks, { type: 'video/webm' })
    saveAs(blob, `${filename}.webm`)
    recordedChunks = []
  }
  mediaRecorder.stop()
  mediaRecorder = null
}
```

---

### 5.3 ExportMenu.tsx

**Files to create:**

- `frontend/src/components/ExportMenu.tsx`

```typescript
import { useRef } from 'react'
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Button } from '@heroui/react'
import { FiDownload } from 'react-icons/fi'
import { exportAsPng, exportAsSvg, exportAsJson, startRecording, stopRecording } from '@/lib/export-utils'

interface Props {
  targetRef: React.RefObject<HTMLElement>
  svgRef?: React.RefObject<SVGElement>
  events?: unknown[]
  filename?: string
}

export function ExportMenu({ targetRef, svgRef, events, filename = 'coroutine-viz' }: Props) {
  const [isRecording, setIsRecording] = useState(false)

  return (
    <Dropdown>
      <DropdownTrigger>
        <Button size="sm" variant="flat" startContent={<FiDownload />}>
          Export
        </Button>
      </DropdownTrigger>
      <DropdownMenu aria-label="Export options">
        <DropdownItem key="png" onPress={() => {
          if (targetRef.current) exportAsPng(targetRef.current, filename)
        }}>
          Export as PNG
        </DropdownItem>
        {svgRef && (
          <DropdownItem key="svg" onPress={() => {
            if (svgRef.current) exportAsSvg(svgRef.current, filename)
          }}>
            Export as SVG
          </DropdownItem>
        )}
        {events && (
          <DropdownItem key="json" onPress={() => exportAsJson(events, filename)}>
            Export Events as JSON
          </DropdownItem>
        )}
        <DropdownItem key="video" onPress={() => {
          if (isRecording) {
            stopRecording(filename)
            setIsRecording(false)
          } else if (targetRef.current) {
            startRecording(targetRef.current)
            setIsRecording(true)
          }
        }}>
          {isRecording ? 'Stop Recording (WebM)' : 'Start Recording (WebM)'}
        </DropdownItem>
      </DropdownMenu>
    </Dropdown>
  )
}
```

---

### 5.4 Add Export Buttons to Visualization Toolbars

**Files to modify:**

- `frontend/src/components/CoroutineTreeGraph.tsx` -- add `ref` to container div, render `<ExportMenu />`
- `frontend/src/components/CoroutineTree.tsx` -- same pattern
- `frontend/src/components/ThreadLanesView.tsx` -- same pattern

Pattern for each:

```typescript
const containerRef = useRef<HTMLDivElement>(null)

return (
  <div ref={containerRef}>
    <div className="flex justify-end mb-2">
      <ExportMenu targetRef={containerRef} filename="coroutine-tree" />
    </div>
    {/* existing content */}
  </div>
)
```

---

## 6. Session Sharing

**Estimated effort:** 3-4 days

### Implementation Order

1. Backend: `Share` data model and storage
2. `ShareRoutes.kt`
3. Frontend: `ShareModal.tsx`
4. `ReadOnlySessionView.tsx`
5. Share button in SessionDetails toolbar

---

### 6.1 Backend Share Model

**Files to create:**

- `backend/src/main/kotlin/com/jh/proj/coroutineviz/routes/ShareRoutes.kt`
- `backend/src/main/kotlin/com/jh/proj/coroutineviz/storage/ShareStore.kt`

**ShareStore.kt:**

```kotlin
package com.jh.proj.coroutineviz.storage

import kotlinx.serialization.Serializable

@Serializable
data class Share(
    val token: String,
    val sessionId: String,
    val createdBy: String?,          // userId, nullable for unauthenticated
    val createdAt: Long,             // epoch millis
    val expiresAt: Long?,            // epoch millis, null = never
    val accessLevel: ShareAccessLevel
)

@Serializable
enum class ShareAccessLevel {
    READ_ONLY,
    READ_WRITE
}

interface ShareStore {
    fun create(share: Share): Share
    fun getByToken(token: String): Share?
    fun listBySession(sessionId: String): List<Share>
    fun revoke(token: String): Boolean
    fun isExpired(share: Share): Boolean =
        share.expiresAt != null && share.expiresAt < System.currentTimeMillis()
}

class InMemoryShareStore : ShareStore {
    private val shares = ConcurrentHashMap<String, Share>()

    override fun create(share: Share): Share {
        shares[share.token] = share
        return share
    }

    override fun getByToken(token: String): Share? {
        val share = shares[token] ?: return null
        return if (isExpired(share)) { shares.remove(token); null } else share
    }

    override fun listBySession(sessionId: String): List<Share> =
        shares.values.filter { it.sessionId == sessionId && !isExpired(it) }

    override fun revoke(token: String): Boolean = shares.remove(token) != null

    override fun isExpired(share: Share): Boolean =
        share.expiresAt != null && share.expiresAt < System.currentTimeMillis()
}
```

---

### 6.2 ShareRoutes.kt

```kotlin
package com.jh.proj.coroutineviz.routes

import com.jh.proj.coroutineviz.storage.*
import com.jh.proj.coroutineviz.session.SessionManager
import io.ktor.http.HttpStatusCode
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.serialization.Serializable
import java.util.UUID

private val shareStore = InMemoryShareStore()

@Serializable
data class CreateShareRequest(
    val expiresInHours: Int? = null,
    val accessLevel: String = "READ_ONLY"
)

@Serializable
data class ShareResponse(
    val token: String,
    val shareUrl: String,
    val expiresAt: Long?
)

fun Route.registerShareRoutes() {
    post("/api/sessions/{id}/share") {
        val sessionId = call.parameters["id"] ?: return@post call.respond(
            HttpStatusCode.BadRequest, mapOf("error" to "Missing session ID"))

        SessionManager.getSession(sessionId) ?: return@post call.respond(
            HttpStatusCode.NotFound, mapOf("error" to "Session not found"))

        val request = call.receive<CreateShareRequest>()
        val token = UUID.randomUUID().toString().replace("-", "").take(16)
        val expiresAt = request.expiresInHours?.let {
            System.currentTimeMillis() + it * 3_600_000L
        }

        val share = shareStore.create(Share(
            token = token,
            sessionId = sessionId,
            createdBy = null,  // from principal when auth is enabled
            createdAt = System.currentTimeMillis(),
            expiresAt = expiresAt,
            accessLevel = ShareAccessLevel.valueOf(request.accessLevel)
        ))

        call.respond(HttpStatusCode.Created, ShareResponse(
            token = share.token,
            shareUrl = "/shared/${share.token}",
            expiresAt = share.expiresAt
        ))
    }

    get("/api/shared/{token}") {
        val token = call.parameters["token"] ?: return@get call.respond(
            HttpStatusCode.BadRequest, mapOf("error" to "Missing token"))

        val share = shareStore.getByToken(token) ?: return@get call.respond(
            HttpStatusCode.NotFound, mapOf("error" to "Share link expired or not found"))

        val session = SessionManager.getSession(share.sessionId) ?: return@get call.respond(
            HttpStatusCode.NotFound, mapOf("error" to "Session no longer exists"))

        val snapshot = SessionSnapshotResponse(
            sessionId = session.sessionId,
            coroutineCount = session.snapshot.coroutines.size,
            eventCount = session.store.all().size,
            coroutines = session.snapshot.coroutines.values.map { node ->
                CoroutineNodeDto(
                    id = node.id, jobId = node.jobId, parentId = node.parentId,
                    scopeId = node.scopeId, label = node.label, state = node.state.toString()
                )
            }
        )

        call.respond(HttpStatusCode.OK, mapOf(
            "session" to snapshot,
            "accessLevel" to share.accessLevel.name,
            "expiresAt" to share.expiresAt
        ))
    }

    get("/api/shared/{token}/events") {
        val token = call.parameters["token"] ?: return@get call.respond(
            HttpStatusCode.BadRequest, mapOf("error" to "Missing token"))
        val share = shareStore.getByToken(token) ?: return@get call.respond(
            HttpStatusCode.NotFound, mapOf("error" to "Share link expired or not found"))
        val session = SessionManager.getSession(share.sessionId) ?: return@get call.respond(
            HttpStatusCode.NotFound, mapOf("error" to "Session no longer exists"))

        val events = session.store.all()
        val jsonArray = events.joinToString(",", "[", "]") { serializeVizEvent(it) }
        call.respondText(jsonArray, io.ktor.http.ContentType.Application.Json)
    }
}
```

**Routing.kt modification:**

```kotlin
import com.jh.proj.coroutineviz.routes.registerShareRoutes
// in routing { ... }
registerShareRoutes()
```

---

### 6.3 Frontend: ShareModal.tsx

**Files to create:**

- `frontend/src/components/ShareModal.tsx`

```typescript
import { useState } from 'react'
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Input, Select, SelectItem, Chip } from '@heroui/react'
import { FiCopy, FiCheck } from 'react-icons/fi'
import { apiClient } from '@/lib/api-client'

interface Props {
  isOpen: boolean
  onClose: () => void
  sessionId: string
}

export function ShareModal({ isOpen, onClose, sessionId }: Props) {
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [expiresInHours, setExpiresInHours] = useState<number>(24)
  const [isCreating, setIsCreating] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCreate = async () => {
    setIsCreating(true)
    try {
      const response = await fetch(`/api/sessions/${sessionId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiresInHours, accessLevel: 'READ_ONLY' }),
      })
      const data = await response.json()
      setShareUrl(`${window.location.origin}${data.shareUrl}`)
    } finally {
      setIsCreating(false)
    }
  }

  const handleCopy = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalContent>
        <ModalHeader>Share Session</ModalHeader>
        <ModalBody>
          {!shareUrl ? (
            <div className="space-y-4">
              <Select label="Expiry" selectedKeys={[expiresInHours.toString()]}
                onChange={(e) => setExpiresInHours(Number(e.target.value))}>
                <SelectItem key="1">1 hour</SelectItem>
                <SelectItem key="24">24 hours</SelectItem>
                <SelectItem key="168">7 days</SelectItem>
                <SelectItem key="720">30 days</SelectItem>
              </Select>
            </div>
          ) : (
            <div className="space-y-2">
              <Input value={shareUrl} readOnly label="Share Link" />
              <Button startContent={copied ? <FiCheck /> : <FiCopy />}
                onPress={handleCopy} color={copied ? 'success' : 'primary'}>
                {copied ? 'Copied!' : 'Copy Link'}
              </Button>
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          {!shareUrl && (
            <Button color="primary" onPress={handleCreate} isLoading={isCreating}>
              Generate Share Link
            </Button>
          )}
          <Button variant="flat" onPress={onClose}>Close</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
```

---

### 6.4 ReadOnlySessionView

**Files to create:**

- `frontend/src/components/ReadOnlySessionView.tsx`
- `frontend/src/routes/shared/$token.tsx`

The `ReadOnlySessionView` component is a stripped-down version of `SessionDetails` that:
- Fetches data from `/api/shared/{token}` and `/api/shared/{token}/events` instead of `/api/sessions/{id}`
- Hides: scenario controls, run/reset/delete buttons, live stream toggle
- Shows: coroutine tree/graph, events list, threads, validation (read-only)
- Displays a "Shared Session" badge with expiry info

**Route file:**

```typescript
// frontend/src/routes/shared/$token.tsx
import { createFileRoute } from '@tanstack/react-router'
import { Layout } from '@/components/Layout'
import { ReadOnlySessionView } from '@/components/ReadOnlySessionView'

export const Route = createFileRoute('/shared/$token')({
  component: SharedSessionPage,
})

function SharedSessionPage() {
  const { token } = Route.useParams()
  return (
    <Layout>
      <div className="container-custom py-8">
        <ReadOnlySessionView token={token} />
      </div>
    </Layout>
  )
}
```

---

### 6.5 Share Button in SessionDetails

**Files to modify:**

- `frontend/src/components/SessionDetails.tsx`

Add to the header action buttons:

```typescript
import { ShareModal } from './ShareModal'
import { FiShare2 } from 'react-icons/fi'

// State:
const [shareModalOpen, setShareModalOpen] = useState(false)

// In the button bar:
<Button size="sm" variant="flat" startContent={<FiShare2 />} onPress={() => setShareModalOpen(true)}>
  Share
</Button>
<ShareModal isOpen={shareModalOpen} onClose={() => setShareModalOpen(false)} sessionId={sessionId} />
```

---

## 7. Session Comparison

**Estimated effort:** 3-4 days

### Implementation Order

1. Backend: `ComparisonService.kt`
2. `ComparisonRoutes.kt`
3. Frontend: `useComparison` hook
4. `ComparisonView.tsx` with side-by-side panels

---

### 7.1 ComparisonService

**Files to create:**

- `backend/src/main/kotlin/com/jh/proj/coroutineviz/routes/ComparisonRoutes.kt`

```kotlin
package com.jh.proj.coroutineviz.routes

import com.jh.proj.coroutineviz.session.SessionManager
import com.jh.proj.coroutineviz.session.VizSession
import io.ktor.http.HttpStatusCode
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.serialization.Serializable

@Serializable
data class ComparisonResult(
    val sessionA: SessionSummary,
    val sessionB: SessionSummary,
    val deltas: ComparisonDeltas
)

@Serializable
data class SessionSummary(
    val sessionId: String,
    val eventCount: Int,
    val coroutineCount: Int,
    val eventCountsByKind: Map<String, Int>,
    val totalDurationNanos: Long,
    val uniqueThreads: Int
)

@Serializable
data class ComparisonDeltas(
    val eventCountDelta: Int,                      // B - A
    val coroutineCountDelta: Int,
    val durationDeltaNanos: Long,
    val eventKindDeltas: Map<String, Int>,          // kind -> (countB - countA)
    val threadCountDelta: Int,
    val newEventKindsInB: List<String>,
    val missingEventKindsInB: List<String>
)

fun Route.registerComparisonRoutes() {
    get("/api/sessions/compare") {
        val sessionIdA = call.request.queryParameters["a"] ?: return@get call.respond(
            HttpStatusCode.BadRequest, mapOf("error" to "Missing ?a= parameter"))
        val sessionIdB = call.request.queryParameters["b"] ?: return@get call.respond(
            HttpStatusCode.BadRequest, mapOf("error" to "Missing ?b= parameter"))

        val sessionA = SessionManager.getSession(sessionIdA) ?: return@get call.respond(
            HttpStatusCode.NotFound, mapOf("error" to "Session A not found"))
        val sessionB = SessionManager.getSession(sessionIdB) ?: return@get call.respond(
            HttpStatusCode.NotFound, mapOf("error" to "Session B not found"))

        val summaryA = summarize(sessionA)
        val summaryB = summarize(sessionB)

        val eventKindDeltas = (summaryA.eventCountsByKind.keys + summaryB.eventCountsByKind.keys)
            .associateWith { kind ->
                (summaryB.eventCountsByKind[kind] ?: 0) - (summaryA.eventCountsByKind[kind] ?: 0)
            }

        val result = ComparisonResult(
            sessionA = summaryA,
            sessionB = summaryB,
            deltas = ComparisonDeltas(
                eventCountDelta = summaryB.eventCount - summaryA.eventCount,
                coroutineCountDelta = summaryB.coroutineCount - summaryA.coroutineCount,
                durationDeltaNanos = summaryB.totalDurationNanos - summaryA.totalDurationNanos,
                eventKindDeltas = eventKindDeltas,
                threadCountDelta = summaryB.uniqueThreads - summaryA.uniqueThreads,
                newEventKindsInB = summaryB.eventCountsByKind.keys - summaryA.eventCountsByKind.keys,
                missingEventKindsInB = (summaryA.eventCountsByKind.keys - summaryB.eventCountsByKind.keys).toList()
            )
        )

        call.respond(HttpStatusCode.OK, result)
    }
}

private fun summarize(session: VizSession): SessionSummary {
    val events = session.store.all()
    val eventsByKind = events.groupBy { it.kind }.mapValues { it.value.size }
    val minTs = events.minOfOrNull { it.tsNanos } ?: 0L
    val maxTs = events.maxOfOrNull { it.tsNanos } ?: 0L
    val threads = events.filterIsInstance<com.jh.proj.coroutineviz.events.dispatcher.ThreadAssigned>()
        .map { it.threadId }.toSet()

    return SessionSummary(
        sessionId = session.sessionId,
        eventCount = events.size,
        coroutineCount = session.snapshot.coroutines.size,
        eventCountsByKind = eventsByKind,
        totalDurationNanos = maxTs - minTs,
        uniqueThreads = threads.size
    )
}
```

**Routing.kt modification:**

```kotlin
import com.jh.proj.coroutineviz.routes.registerComparisonRoutes
// in routing { ... }
registerComparisonRoutes()
```

---

### 7.2 Frontend: useComparison Hook

**Files to create:**

- `frontend/src/hooks/use-comparison.ts`

```typescript
import { useQuery } from '@tanstack/react-query'

interface ComparisonResult {
  sessionA: SessionSummary
  sessionB: SessionSummary
  deltas: ComparisonDeltas
}

interface SessionSummary {
  sessionId: string
  eventCount: number
  coroutineCount: number
  eventCountsByKind: Record<string, number>
  totalDurationNanos: number
  uniqueThreads: number
}

interface ComparisonDeltas {
  eventCountDelta: number
  coroutineCountDelta: number
  durationDeltaNanos: number
  eventKindDeltas: Record<string, number>
  threadCountDelta: number
  newEventKindsInB: string[]
  missingEventKindsInB: string[]
}

export function useComparison(sessionIdA: string | null, sessionIdB: string | null) {
  return useQuery<ComparisonResult>({
    queryKey: ['comparison', sessionIdA, sessionIdB],
    queryFn: async () => {
      const response = await fetch(`/api/sessions/compare?a=${sessionIdA}&b=${sessionIdB}`)
      if (!response.ok) throw new Error('Comparison failed')
      return response.json()
    },
    enabled: !!sessionIdA && !!sessionIdB,
  })
}
```

---

### 7.3 ComparisonView.tsx

**Files to create:**

- `frontend/src/components/ComparisonView.tsx`
- `frontend/src/routes/compare.tsx`

The `ComparisonView` component:
- Two session selectors (dropdowns listing available sessions)
- Side-by-side summary cards showing SessionSummary for A and B
- Delta highlights: green for improvements, red for regressions, neutral for equal
- Event kind breakdown table with colored delta column
- Duration comparison bar chart

The route:

```typescript
// frontend/src/routes/compare.tsx
import { createFileRoute } from '@tanstack/react-router'
import { Layout } from '@/components/Layout'
import { ComparisonView } from '@/components/ComparisonView'

export const Route = createFileRoute('/compare')({
  component: ComparisonPage,
})

function ComparisonPage() {
  return (
    <Layout>
      <div className="container-custom py-8">
        <ComparisonView />
      </div>
    </Layout>
  )
}
```

---

## 8. OpenTelemetry Integration

**Estimated effort:** 4-5 days

### Implementation Order

1. Add OpenTelemetry dependencies
2. Create `OTelExporter.kt`
3. Span registry for correlation
4. Configuration
5. Batch processor and graceful shutdown

---

### 8.1 Dependencies

**Files to modify:**

- `backend/build.gradle.kts`

```kotlin
// OpenTelemetry
implementation("io.opentelemetry:opentelemetry-api:1.42.1")
implementation("io.opentelemetry:opentelemetry-sdk:1.42.1")
implementation("io.opentelemetry:opentelemetry-exporter-otlp:1.42.1")
implementation("io.opentelemetry:opentelemetry-sdk-extension-autoconfigure:1.42.1")
```

---

### 8.2 OTelExporter.kt

**Files to create:**

- `backend/src/main/kotlin/com/jh/proj/coroutineviz/otel/OTelExporter.kt`
- `backend/src/main/kotlin/com/jh/proj/coroutineviz/otel/OTelConfig.kt`

```kotlin
// OTelExporter.kt
package com.jh.proj.coroutineviz.otel

import com.jh.proj.coroutineviz.events.VizEvent
import com.jh.proj.coroutineviz.events.coroutine.*
import com.jh.proj.coroutineviz.events.CoroutineEvent
import com.jh.proj.coroutineviz.session.EventBus
import io.opentelemetry.api.trace.Span
import io.opentelemetry.api.trace.SpanKind
import io.opentelemetry.api.trace.StatusCode
import io.opentelemetry.api.trace.Tracer
import io.opentelemetry.context.Context
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import org.slf4j.LoggerFactory
import java.util.concurrent.ConcurrentHashMap

class OTelExporter(
    private val tracer: Tracer,
    private val scope: CoroutineScope
) {
    private val logger = LoggerFactory.getLogger(OTelExporter::class.java)

    // Track active spans by coroutineId for proper start/end correlation
    private val spanRegistry = ConcurrentHashMap<String, Span>()

    // Track parent contexts for coroutine hierarchy -> span hierarchy
    private val contextRegistry = ConcurrentHashMap<String, Context>()

    /**
     * Subscribe to an EventBus and export events as OpenTelemetry spans.
     */
    fun subscribe(eventBus: EventBus) {
        scope.launch {
            eventBus.stream().collect { event ->
                try {
                    exportEvent(event)
                } catch (e: Exception) {
                    logger.error("Failed to export event to OTel: ${event.kind}", e)
                }
            }
        }
    }

    private fun exportEvent(event: VizEvent) {
        when (event) {
            is CoroutineCreated -> {
                // Start a new span
                val parentContext = event.parentCoroutineId?.let { contextRegistry[it] }
                    ?: Context.current()

                val span = tracer.spanBuilder("coroutine:${event.label ?: event.coroutineId}")
                    .setParent(parentContext)
                    .setSpanKind(SpanKind.INTERNAL)
                    .setAttribute("coroutine.id", event.coroutineId)
                    .setAttribute("coroutine.jobId", event.jobId)
                    .setAttribute("coroutine.scopeId", event.scopeId)
                    .setAttribute("coroutine.label", event.label ?: "unnamed")
                    .setAttribute("coroutine.parentId", event.parentCoroutineId ?: "root")
                    .setAttribute("session.id", event.sessionId)
                    .startSpan()

                spanRegistry[event.coroutineId] = span
                contextRegistry[event.coroutineId] = Context.current().with(span)

                logger.debug("OTel: started span for coroutine ${event.coroutineId}")
            }

            is CoroutineStarted -> {
                spanRegistry[event.coroutineId]?.addEvent("coroutine.started")
            }

            is CoroutineSuspended -> {
                spanRegistry[event.coroutineId]?.let { span ->
                    span.addEvent("coroutine.suspended")
                    event.suspensionPoint?.let { sp ->
                        span.setAttribute("suspension.function", sp.function)
                        span.setAttribute("suspension.reason", sp.reason)
                    }
                }
            }

            is CoroutineResumed -> {
                spanRegistry[event.coroutineId]?.addEvent("coroutine.resumed")
            }

            is CoroutineCompleted -> {
                spanRegistry.remove(event.coroutineId)?.let { span ->
                    span.setStatus(StatusCode.OK)
                    span.end()
                }
                contextRegistry.remove(event.coroutineId)
            }

            is CoroutineCancelled -> {
                spanRegistry.remove(event.coroutineId)?.let { span ->
                    span.setStatus(StatusCode.ERROR, "Cancelled: ${event.cause}")
                    span.setAttribute("cancellation.cause", event.cause ?: "unknown")
                    span.end()
                }
                contextRegistry.remove(event.coroutineId)
            }

            is CoroutineFailed -> {
                spanRegistry.remove(event.coroutineId)?.let { span ->
                    span.setStatus(StatusCode.ERROR, "Failed: ${event.exception}")
                    span.setAttribute("exception.type", event.exceptionType ?: "unknown")
                    span.setAttribute("exception.message", event.exception ?: "unknown")
                    span.end()
                }
                contextRegistry.remove(event.coroutineId)
            }

            else -> {
                // Add as event to the coroutine's span if it's a CoroutineEvent
                if (event is CoroutineEvent) {
                    spanRegistry[event.coroutineId]?.addEvent(event.kind)
                }
            }
        }
    }

    /**
     * Flush all pending spans and clean up.
     */
    fun shutdown() {
        // End any remaining open spans
        spanRegistry.forEach { (id, span) ->
            span.setStatus(StatusCode.UNSET, "Session closed with span still open")
            span.end()
        }
        spanRegistry.clear()
        contextRegistry.clear()
    }
}
```

---

### 8.3 OTelConfig.kt

```kotlin
// OTelConfig.kt
package com.jh.proj.coroutineviz.otel

import io.ktor.server.application.*
import io.opentelemetry.api.OpenTelemetry
import io.opentelemetry.api.trace.Tracer
import io.opentelemetry.exporter.otlp.trace.OtlpGrpcSpanExporter
import io.opentelemetry.sdk.OpenTelemetrySdk
import io.opentelemetry.sdk.resources.Resource
import io.opentelemetry.sdk.trace.SdkTracerProvider
import io.opentelemetry.sdk.trace.export.BatchSpanProcessor
import io.opentelemetry.semconv.ResourceAttributes

object OTelConfig {
    private var openTelemetry: OpenTelemetrySdk? = null

    fun init(config: ApplicationConfig): Tracer? {
        val enabled = config.propertyOrNull("app.exporters.otel.enabled")?.getString()?.toBoolean() ?: false
        if (!enabled) return null

        val endpoint = config.propertyOrNull("app.exporters.otel.endpoint")?.getString()
            ?: "http://localhost:4317"
        val flushIntervalMs = config.propertyOrNull("app.exporters.otel.flush-interval-ms")?.getString()?.toLong()
            ?: 5000L

        val resource = Resource.getDefault()
            .merge(Resource.builder()
                .put(ResourceAttributes.SERVICE_NAME, "coroutine-visualizer")
                .put(ResourceAttributes.SERVICE_VERSION, "0.1.0")
                .build())

        val spanExporter = OtlpGrpcSpanExporter.builder()
            .setEndpoint(endpoint)
            .build()

        val spanProcessor = BatchSpanProcessor.builder(spanExporter)
            .setScheduleDelay(java.time.Duration.ofMillis(flushIntervalMs))
            .build()

        val tracerProvider = SdkTracerProvider.builder()
            .addSpanProcessor(spanProcessor)
            .setResource(resource)
            .build()

        val sdk = OpenTelemetrySdk.builder()
            .setTracerProvider(tracerProvider)
            .build()

        openTelemetry = sdk
        return sdk.getTracer("coroutine-viz", "0.1.0")
    }

    fun shutdown() {
        openTelemetry?.close()
    }
}
```

**application.yaml additions:**

```yaml
app:
  exporters:
    otel:
      enabled: false
      endpoint: "http://localhost:4317"
      flush-interval-ms: 5000
```

**Application.kt modification:**

```kotlin
fun Application.module() {
    configureHTTP()
    configureMonitoring()
    configureSerialization()
    configureRouting()

    // Optional OTel integration
    val tracer = OTelConfig.init(environment.config)
    if (tracer != null) {
        // Register exporter with a global hook or pass to session factory
        environment.monitor.subscribe(ApplicationStopped) {
            OTelConfig.shutdown()
        }
    }
}
```

---

## 9. Performance & Scaling

**Estimated effort:** 3-4 days

### Implementation Order

1. BoundedEventStore with ring buffer
2. SamplingEventFilter
3. SSE compression
4. Load test harness
5. Metrics wiring

---

### 9.1 BoundedEventStore (Ring Buffer)

**Files to create:**

- `backend/coroutine-viz-core/src/main/kotlin/com/jh/proj/coroutineviz/session/BoundedEventStore.kt`

```kotlin
package com.jh.proj.coroutineviz.session

import com.jh.proj.coroutineviz.events.VizEvent
import java.util.concurrent.locks.ReentrantReadWriteLock
import kotlin.concurrent.read
import kotlin.concurrent.write

/**
 * Fixed-size ring buffer event store.
 * When full, oldest events are overwritten silently.
 * Much more memory-efficient than CopyOnWriteArrayList for long-running sessions.
 */
class BoundedEventStore(
    private val capacity: Int = 100_000
) {
    private val buffer = arrayOfNulls<VizEvent>(capacity)
    private var head = 0       // next write position
    private var size = 0
    private val lock = ReentrantReadWriteLock()

    fun append(event: VizEvent) = lock.write {
        buffer[head] = event
        head = (head + 1) % capacity
        if (size < capacity) size++
    }

    fun all(): List<VizEvent> = lock.read {
        if (size == 0) return emptyList()
        val result = ArrayList<VizEvent>(size)
        val start = if (size < capacity) 0 else head
        for (i in 0 until size) {
            val idx = (start + i) % capacity
            buffer[idx]?.let { result.add(it) }
        }
        result
    }

    fun since(seq: Long): List<VizEvent> = lock.read {
        all().filter { it.seq > seq }
    }

    fun count(): Int = lock.read { size }
}
```

---

### 9.2 SamplingEventFilter

**Files to create:**

- `backend/coroutine-viz-core/src/main/kotlin/com/jh/proj/coroutineviz/session/SamplingEventFilter.kt`

```kotlin
package com.jh.proj.coroutineviz.session

import com.jh.proj.coroutineviz.events.VizEvent
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicLong

/**
 * Rate-based sampling filter for high-volume event streams.
 * Lifecycle events (Created, Completed, Failed, Cancelled) always pass.
 * Other events are sampled at configurable per-kind rates.
 */
class SamplingEventFilter(
    private val defaultSampleRate: Int = 1,      // 1 = every event, 10 = every 10th
    private val kindRates: Map<String, Int> = emptyMap()
) {
    // Lifecycle events that ALWAYS pass through
    private val alwaysPassKinds = setOf(
        "CoroutineCreated", "CoroutineCompleted", "CoroutineCancelled", "CoroutineFailed",
        "CoroutineStarted", "CoroutineBodyCompleted",
        "ChannelCreated", "ChannelClosed",
        "FlowCreated", "FlowCollectionStarted", "FlowCollectionCompleted",
        "MutexCreated", "SemaphoreCreated",
        "DeadlockDetected"
    )

    private val counters = ConcurrentHashMap<String, AtomicLong>()

    fun shouldPass(event: VizEvent): Boolean {
        if (event.kind in alwaysPassKinds) return true

        val rate = kindRates[event.kind] ?: defaultSampleRate
        if (rate <= 1) return true

        val counter = counters.getOrPut(event.kind) { AtomicLong(0) }
        return counter.incrementAndGet() % rate == 0L
    }
}
```

**VizSession integration:**

```kotlin
class VizSession(
    val sessionId: String,
    private val samplingFilter: SamplingEventFilter? = null
) {
    fun send(event: VizEvent) {
        if (samplingFilter != null && !samplingFilter.shouldPass(event)) return
        store.append(event)
        applier.apply(event)
        eventBus.send(event)
    }
}
```

---

### 9.3 SSE Compression

**Files to modify:**

- `backend/src/main/kotlin/com/jh/proj/coroutineviz/Application.kt`

```kotlin
import io.ktor.server.plugins.compression.*

fun Application.module() {
    install(Compression) {
        gzip {
            matchContentType(ContentType.Text.EventStream)
            minimumSize(1024)
        }
    }
    // ... rest of module
}
```

**Dependencies -- already included:** `io.ktor:ktor-server-compression` is bundled with Ktor.

**build.gradle.kts addition:**

```kotlin
implementation("io.ktor:ktor-server-compression")
```

---

### 9.4 Load Test Harness

**Files to create:**

- `backend/src/main/kotlin/com/jh/proj/coroutineviz/routes/TestRoutes.kt` -- add a load-test endpoint (already partially exists in `TestRoutes.kt`)

```kotlin
// Add to existing TestRoutes.kt
post("/api/testing/load-test") {
    val coroutineCount = call.request.queryParameters["coroutines"]?.toIntOrNull() ?: 100
    val eventsPerCoroutine = call.request.queryParameters["eventsPerCoroutine"]?.toIntOrNull() ?: 50
    val session = SessionManager.createSession("load-test-${System.currentTimeMillis()}")

    logger.info("Starting load test: $coroutineCount coroutines x $eventsPerCoroutine events")

    val startTime = System.nanoTime()

    // Generate synthetic events
    repeat(coroutineCount) { i ->
        val coroutineId = "load-cr-$i"
        val jobId = "load-job-$i"
        val seq = session.nextSeq()
        session.send(CoroutineCreated(
            sessionId = session.sessionId, seq = seq, tsNanos = System.nanoTime(),
            coroutineId = coroutineId, jobId = jobId, parentCoroutineId = null,
            scopeId = "load-scope", label = "LoadCoroutine-$i"
        ))
        // ... generate start, suspend, resume, complete events
    }

    val elapsed = (System.nanoTime() - startTime) / 1_000_000

    call.respond(HttpStatusCode.OK, mapOf(
        "sessionId" to session.sessionId,
        "coroutinesCreated" to coroutineCount,
        "totalEvents" to session.store.all().size,
        "elapsedMs" to elapsed,
        "eventsPerSecond" to (session.store.all().size * 1000L / maxOf(elapsed, 1))
    ))
}
```

---

## 10. IntelliJ Plugin

**Estimated effort:** 8-10 days

The plugin module already exists at `intellij-plugin/` with basic structure. This section details what remains to build.

### Implementation Order

1. Polish existing tool window and panels
2. JCEF-based React app panel (alternative to native Swing)
3. Backend detector and connection manager
4. Run configuration integration
5. DebugProbes hybrid mode
6. Settings and marketplace publishing config

---

### 10.1 Existing Structure (Already Implemented)

Files that already exist:

- `intellij-plugin/build.gradle.kts` -- configured with `org.jetbrains.intellij.platform` 2.5.0
- `intellij-plugin/src/main/resources/META-INF/plugin.xml` -- tool window, settings, startup activity, action
- `intellij-plugin/src/main/kotlin/com/jh/coroutinevisualizer/CoroutineVisualizerToolWindowFactory.kt` -- 3-tab layout
- `intellij-plugin/src/main/kotlin/com/jh/coroutinevisualizer/ui/TreePanel.kt`
- `intellij-plugin/src/main/kotlin/com/jh/coroutinevisualizer/ui/TimelinePanel.kt`
- `intellij-plugin/src/main/kotlin/com/jh/coroutinevisualizer/ui/EventLogPanel.kt`
- `intellij-plugin/src/main/kotlin/com/jh/coroutinevisualizer/receiver/PluginEventReceiver.kt`
- `intellij-plugin/src/main/kotlin/com/jh/coroutinevisualizer/actions/RunWithVisualizerAction.kt`
- `intellij-plugin/src/main/kotlin/com/jh/coroutinevisualizer/PluginSessionManager.kt`
- `intellij-plugin/src/main/kotlin/com/jh/coroutinevisualizer/settings/VisualizerSettingsConfigurable.kt`

---

### 10.2 JCEF Panel (Embedded React App)

**Files to create:**

- `intellij-plugin/src/main/kotlin/com/jh/coroutinevisualizer/ui/JcefVisualizerPanel.kt`

```kotlin
package com.jh.coroutinevisualizer.ui

import com.intellij.openapi.project.Project
import com.intellij.ui.jcef.JBCefBrowser
import javax.swing.JComponent

/**
 * Renders the full React frontend inside IntelliJ via JCEF (Chromium Embedded Framework).
 * Falls back to native Swing panels if JCEF is unavailable.
 */
class JcefVisualizerPanel(
    private val project: Project,
    private val backendUrl: String = "http://localhost:8080"
) {
    private val browser: JBCefBrowser? = try {
        JBCefBrowser("$backendUrl/sessions")
    } catch (e: Exception) {
        null // JCEF not available
    }

    val component: JComponent
        get() = browser?.component ?: createFallbackPanel()

    fun navigateToSession(sessionId: String) {
        browser?.loadURL("$backendUrl/sessions/$sessionId")
    }

    fun dispose() {
        browser?.dispose()
    }

    private fun createFallbackPanel(): JComponent {
        return javax.swing.JLabel("JCEF not available. Using native panels instead.")
    }
}
```

---

### 10.3 Backend Detector

**Files to create:**

- `intellij-plugin/src/main/kotlin/com/jh/coroutinevisualizer/BackendDetector.kt`

```kotlin
package com.jh.coroutinevisualizer

import com.intellij.openapi.components.Service
import com.intellij.openapi.project.Project
import kotlinx.coroutines.*
import java.net.HttpURLConnection
import java.net.URL

@Service(Service.Level.PROJECT)
class BackendDetector(private val project: Project) {
    private var detectionJob: Job? = null
    private var _isConnected = false
    val isConnected: Boolean get() = _isConnected

    private val listeners = mutableListOf<(Boolean) -> Unit>()

    fun addConnectionListener(listener: (Boolean) -> Unit) {
        listeners.add(listener)
    }

    fun startProbing(
        url: String = "http://localhost:8080",
        intervalMs: Long = 5000
    ) {
        detectionJob = CoroutineScope(Dispatchers.IO + SupervisorJob()).launch {
            while (isActive) {
                val connected = probe("$url/api/health/live")
                if (connected != _isConnected) {
                    _isConnected = connected
                    listeners.forEach { it(connected) }
                }
                delay(intervalMs)
            }
        }
    }

    fun stop() {
        detectionJob?.cancel()
    }

    private fun probe(url: String): Boolean {
        return try {
            val connection = URL(url).openConnection() as HttpURLConnection
            connection.connectTimeout = 2000
            connection.readTimeout = 2000
            connection.requestMethod = "GET"
            val code = connection.responseCode
            connection.disconnect()
            code == 200
        } catch (e: Exception) {
            false
        }
    }
}
```

---

### 10.4 Run Configuration Integration

**Files to create:**

- `intellij-plugin/src/main/kotlin/com/jh/coroutinevisualizer/run/CoroutineVisualizerRunConfigurationType.kt`
- `intellij-plugin/src/main/kotlin/com/jh/coroutinevisualizer/run/CoroutineVisualizerRunConfiguration.kt`
- `intellij-plugin/src/main/kotlin/com/jh/coroutinevisualizer/run/CoroutineVisualizerRunConfigurationFactory.kt`

The run configuration wraps the user's existing run config and:
1. Adds `-javaagent:/path/to/coroutine-viz-agent.jar` VM option (if agent approach is used)
2. Or ensures `VizScope` is on classpath and injects `coroutine-viz-core` as a runtime dependency
3. Sets system properties: `-Dviz.session.autoStart=true -Dviz.backend.url=http://localhost:8080`

```kotlin
// CoroutineVisualizerRunConfiguration.kt
class CoroutineVisualizerRunConfiguration(
    project: Project,
    factory: ConfigurationFactory,
    name: String
) : RunConfigurationBase<RunConfigurationOptions>(project, factory, name) {

    var innerConfigurationName: String = ""
    var backendUrl: String = "http://localhost:8080"

    override fun getState(executor: Executor, environment: ExecutionEnvironment): RunProfileState? {
        // Find the inner configuration
        val innerConfig = RunManager.getInstance(project)
            .findConfigurationByName(innerConfigurationName) ?: return null

        // Get its run state
        val innerState = innerConfig.configuration.getState(executor, environment) ?: return null

        // If it's a JavaCommandLine, add VM options
        if (innerState is JavaCommandLineState) {
            val params = innerState.javaParameters
            params.vmParametersList.add("-Dviz.session.autoStart=true")
            params.vmParametersList.add("-Dviz.backend.url=$backendUrl")
            // Add coroutine-viz-core to classpath if not already present
            // params.classPath.add(coreJarPath)
        }

        return innerState
    }
}
```

---

### 10.5 DebugProbes Hybrid Mode

**Files to create:**

- `intellij-plugin/src/main/kotlin/com/jh/coroutinevisualizer/debug/DebugProbesHybrid.kt`

```kotlin
package com.jh.coroutinevisualizer.debug

import com.jh.proj.coroutineviz.events.VizEvent
import com.jh.proj.coroutineviz.events.coroutine.CoroutineCreated
import com.jh.proj.coroutineviz.session.VizSession
import kotlinx.coroutines.debug.DebugProbes

/**
 * Merges DebugProbes snapshots with VizSession events.
 * Useful when users can't instrument all code with VizScope but still
 * want visibility into coroutine state.
 */
class DebugProbesHybrid(
    private val session: VizSession
) {
    init {
        if (!DebugProbes.isInstalled) {
            DebugProbes.install()
        }
    }

    /**
     * Take a snapshot of all coroutines via DebugProbes and
     * emit events for any coroutines not already tracked by VizSession.
     */
    fun syncSnapshot() {
        val debugInfo = DebugProbes.dumpCoroutinesInfo()
        val trackedIds = session.snapshot.coroutines.keys

        debugInfo.forEach { info ->
            val coroutineId = "debug-${info.hashCode()}"
            if (coroutineId !in trackedIds) {
                // Emit a synthetic CoroutineCreated event
                session.send(CoroutineCreated(
                    sessionId = session.sessionId,
                    seq = session.nextSeq(),
                    tsNanos = System.nanoTime(),
                    coroutineId = coroutineId,
                    jobId = "debug-job-${info.hashCode()}",
                    parentCoroutineId = null,
                    scopeId = "debug-probes",
                    label = info.toString().take(80)
                ))
            }
        }
    }

    fun shutdown() {
        // Don't uninstall DebugProbes -- other tools may use them
    }
}
```

---

### 10.6 Marketplace Publishing Config

The `intellij-plugin/build.gradle.kts` already has `pluginConfiguration`. To enable marketplace publishing, add:

```kotlin
// Add to intellij-plugin/build.gradle.kts
intellijPlatform {
    publishing {
        token = System.getenv("INTELLIJ_MARKETPLACE_TOKEN") ?: ""
        channels = listOf("stable")
    }

    signing {
        certificateChain = System.getenv("CERTIFICATE_CHAIN") ?: ""
        privateKey = System.getenv("PRIVATE_KEY") ?: ""
        password = System.getenv("PRIVATE_KEY_PASSWORD") ?: ""
    }
}
```

---

## 11. SDK & CI/CD

**Estimated effort:** 4-5 days

### Implementation Order

1. Polish maven-publish config for `coroutine-viz-core`
2. Publish workflow on tag push
3. Sample app
4. CLI tool
5. Gradle plugin

---

### 11.1 Maven Publish (Already Configured)

The `backend/coroutine-viz-core/build.gradle.kts` already has `maven-publish` configured with GitHub Packages. No changes needed for basic publishing.

Verify the existing config publishes correctly:

```kotlin
// Already in coroutine-viz-core/build.gradle.kts:
publishing {
    publications {
        create<MavenPublication>("maven") {
            groupId = "com.jh.coroutine-visualizer"
            artifactId = "coroutine-viz-core"
            // ...
        }
    }
    repositories {
        maven {
            name = "GitHubPackages"
            url = uri("https://maven.pkg.github.com/hermanngeorge15/visualizer-for-coroutines")
            // ...
        }
    }
}
```

---

### 11.2 Publish Workflow

**File:** `.github/workflows/publish-maven.yml` (already exists, verify/enhance)

```yaml
name: Publish Core SDK

on:
  push:
    tags:
      - 'v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      packages: write
      contents: read
    steps:
      - uses: actions/checkout@v4

      - name: Set up JDK 21
        uses: actions/setup-java@v4
        with:
          java-version: '21'
          distribution: 'temurin'

      - name: Setup Gradle
        uses: gradle/actions/setup-gradle@v4

      - name: Run tests
        working-directory: backend
        run: ./gradlew :coroutine-viz-core:test

      - name: Publish to GitHub Packages
        working-directory: backend
        run: ./gradlew :coroutine-viz-core:publish
        env:
          GITHUB_ACTOR: ${{ github.actor }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

### 11.3 Sample App

**Files to create:**

- `samples/simple-app/build.gradle.kts`
- `samples/simple-app/settings.gradle.kts`
- `samples/simple-app/src/main/kotlin/com/example/Main.kt`

**build.gradle.kts:**

```kotlin
plugins {
    kotlin("jvm") version "2.2.20"
    application
}

repositories {
    mavenCentral()
    maven {
        url = uri("https://maven.pkg.github.com/hermanngeorge15/visualizer-for-coroutines")
        credentials {
            username = System.getenv("GITHUB_ACTOR") ?: ""
            password = System.getenv("GITHUB_TOKEN") ?: ""
        }
    }
}

dependencies {
    implementation("com.jh.coroutine-visualizer:coroutine-viz-core:0.1.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.10.2")
    implementation("ch.qos.logback:logback-classic:1.4.14")
}

application {
    mainClass = "com.example.MainKt"
}
```

**Main.kt:**

```kotlin
package com.example

import com.jh.proj.coroutineviz.session.VizSession
import com.jh.proj.coroutineviz.wrappers.VizScope
import kotlinx.coroutines.*

fun main() = runBlocking {
    val session = VizSession("sample-session")

    VizScope(session, this) {
        // Coroutine 1: data fetcher
        launch(coroutineName = "DataFetcher") {
            delay(100)
            println("Data fetched!")
        }

        // Coroutine 2: processor
        launch(coroutineName = "Processor") {
            delay(200)
            println("Data processed!")
        }

        // Coroutine 3: nested work
        launch(coroutineName = "Reporter") {
            launch(coroutineName = "SubReport-1") { delay(50) }
            launch(coroutineName = "SubReport-2") { delay(75) }
        }
    }

    println("Session events: ${session.store.all().size}")
    session.store.all().forEach { event ->
        println("  [${event.seq}] ${event.kind}")
    }

    session.close()
}
```

---

### 11.4 CLI Tool

**Files to create:**

- `backend/coroutine-viz-cli/build.gradle.kts`
- `backend/coroutine-viz-cli/src/main/kotlin/com/jh/proj/coroutineviz/cli/Main.kt`

**build.gradle.kts:**

```kotlin
plugins {
    kotlin("jvm") version "2.2.20"
    application
    id("org.jetbrains.kotlin.plugin.serialization") version "2.2.20"
}

dependencies {
    implementation(project(":coroutine-viz-core"))
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.10.2")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.8.1")
    implementation("com.charleskorn.kaml:kaml:0.61.0")  // YAML config parsing
    implementation("ch.qos.logback:logback-classic:1.4.14")
}

application {
    mainClass = "com.jh.proj.coroutineviz.cli.MainKt"
}
```

**Main.kt:**

```kotlin
package com.jh.proj.coroutineviz.cli

import com.jh.proj.coroutineviz.checksystem.*
import com.jh.proj.coroutineviz.events.VizEvent
import com.jh.proj.coroutineviz.validation.ValidationRuleRegistry
import kotlinx.serialization.json.Json

/**
 * CLI tool for CI pipelines.
 * Reads a JSON file of events and runs validation rules against them.
 *
 * Usage: coroutine-viz-ci --config validate.yaml --events events.json
 */
fun main(args: Array<String>) {
    val configPath = args.indexOf("--config").let { if (it >= 0) args[it + 1] else null }
    val eventsPath = args.indexOf("--events").let { if (it >= 0) args[it + 1] else null }
        ?: error("Usage: coroutine-viz-ci --events <path-to-events.json> [--config <path-to-config.yaml>]")

    val eventsJson = java.io.File(eventsPath).readText()
    // Deserialize events (simplified -- real impl needs polymorphic deserializer)
    val json = Json { ignoreUnknownKeys = true }
    // val events: List<VizEvent> = json.decodeFromString(eventsJson)

    // Run validation
    val registry = ValidationRuleRegistry()
    // Register standard rules...

    // val findings = registry.validateAll(events)
    // val errors = findings.count { it.severity == "ERROR" }
    // val warnings = findings.count { it.severity == "WARNING" }

    // println("Validation Results:")
    // println("  Errors:   $errors")
    // println("  Warnings: $warnings")
    // println("  Score:    ${maxOf(0, 100 - errors * 10 - warnings * 3)}/100")

    // Exit with non-zero code if any errors
    // if (errors > 0) System.exit(1)
}
```

---

### 11.5 Gradle Plugin

**Files to create:**

- `backend/coroutine-viz-gradle-plugin/build.gradle.kts`
- `backend/coroutine-viz-gradle-plugin/src/main/kotlin/com/jh/proj/coroutineviz/gradle/CoroutineVizPlugin.kt`
- `backend/coroutine-viz-gradle-plugin/src/main/kotlin/com/jh/proj/coroutineviz/gradle/CoroutineVizCheckTask.kt`

**CoroutineVizPlugin.kt:**

```kotlin
package com.jh.proj.coroutineviz.gradle

import org.gradle.api.Plugin
import org.gradle.api.Project

class CoroutineVizPlugin : Plugin<Project> {
    override fun apply(project: Project) {
        val extension = project.extensions.create(
            "coroutineViz",
            CoroutineVizExtension::class.java
        )

        project.tasks.register("coroutineVizCheck", CoroutineVizCheckTask::class.java) { task ->
            task.group = "verification"
            task.description = "Run coroutine visualization validation checks"
            task.eventsFile.set(extension.eventsFile)
            task.failOnError.set(extension.failOnError)
        }
    }
}

open class CoroutineVizExtension {
    var eventsFile: org.gradle.api.provider.Property<String>? = null
    var failOnError: org.gradle.api.provider.Property<Boolean>? = null
}
```

**CoroutineVizCheckTask.kt:**

```kotlin
package com.jh.proj.coroutineviz.gradle

import org.gradle.api.DefaultTask
import org.gradle.api.provider.Property
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.TaskAction

abstract class CoroutineVizCheckTask : DefaultTask() {
    @get:Input
    abstract val eventsFile: Property<String>

    @get:Input
    abstract val failOnError: Property<Boolean>

    @TaskAction
    fun check() {
        val path = eventsFile.getOrElse("build/coroutine-viz-events.json")
        val file = project.file(path)
        if (!file.exists()) {
            logger.warn("No events file found at $path. Skipping validation.")
            return
        }

        // Invoke CLI tool or run validation inline
        logger.lifecycle("Running coroutine visualization checks on $path...")
        // ... validation logic
    }
}
```

---

## 12. Frontend Testing

**Estimated effort:** 5-7 days

### Implementation Order

1. Missing component unit tests
2. Missing hook unit tests
3. Playwright E2E setup and tests
4. Storybook setup and stories
5. Chromatic CI integration

---

### 12.1 Missing Component Tests

**Files to create:**

- `frontend/src/components/actors/ActorCard.test.tsx`
- `frontend/src/components/actors/ActorPoolView.test.tsx`
- `frontend/src/components/select/SelectVisualization.test.tsx`
- `frontend/src/components/anti-patterns/AntiPatternBadge.test.tsx`
- `frontend/src/components/anti-patterns/AntiPatternOverlay.test.tsx`
- `frontend/src/components/ExceptionPropagationOverlay.test.tsx`
- `frontend/src/components/VirtualizedEventList.test.tsx`

Test pattern for each component:

```typescript
// Example: frontend/src/components/actors/ActorCard.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ActorCard } from './ActorCard'
import type { ActorCreated } from '@/types/api'

describe('ActorCard', () => {
  const mockActor: ActorCreated = {
    sessionId: 'test-session',
    seq: 1,
    tsNanos: 1000000,
    kind: 'ActorCreated',
    actorId: 'actor-1',
    coroutineId: 'cr-1',
    name: 'TestActor',
    mailboxCapacity: 10,
  }

  it('renders actor name', () => {
    render(<ActorCard actor={mockActor} />)
    expect(screen.getByText('TestActor')).toBeInTheDocument()
  })

  it('displays mailbox capacity', () => {
    render(<ActorCard actor={mockActor} />)
    expect(screen.getByText(/10/)).toBeInTheDocument()
  })

  it('shows processing state when messages are active', () => {
    // ... test with message processing events
  })
})
```

---

### 12.2 Missing Hook Tests

**Files to create:**

- `frontend/src/hooks/use-actor-events.test.ts`
- `frontend/src/hooks/use-select-events.test.ts`
- `frontend/src/hooks/use-anti-patterns.test.ts`

Test pattern:

```typescript
// Example: frontend/src/hooks/use-actor-events.test.ts
import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { useActorEvents } from './use-actor-events'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('useActorEvents', () => {
  it('returns empty arrays initially', () => {
    const { result } = renderHook(() => useActorEvents('test-session'), {
      wrapper: createWrapper(),
    })
    expect(result.current.actors).toEqual([])
    expect(result.current.messages).toEqual([])
  })

  it('groups events by actorId', () => {
    // ... test with mock event data
  })
})
```

---

### 12.3 Playwright E2E Setup

**Files to create:**

- `frontend/playwright.config.ts`
- `frontend/tests/e2e/session-flow.spec.ts`
- `frontend/tests/e2e/scenario-run.spec.ts`
- `frontend/tests/e2e/validation.spec.ts`

**Dependencies to add:**

```json
{
  "devDependencies": {
    "@playwright/test": "^1.48.0"
  }
}
```

**playwright.config.ts:**

```typescript
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ],
  webServer: [
    {
      command: 'cd ../backend && ./gradlew run',
      url: 'http://localhost:8080/api/health/live',
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
    },
    {
      command: 'pnpm dev',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
    },
  ],
})
```

**session-flow.spec.ts:**

```typescript
import { test, expect } from '@playwright/test'

test.describe('Session Flow', () => {
  test('create session -> run scenario -> verify tree and events', async ({ page }) => {
    // Navigate to scenarios page
    await page.goto('/scenarios')

    // Click on "Nested Coroutines" scenario
    await page.click('text=Nested Coroutines')

    // Wait for session page to load
    await page.waitForURL(/\/sessions\//)

    // Run the scenario
    await page.click('text=Run Scenario')

    // Wait for coroutine tree to appear
    await page.waitForSelector('[data-testid="coroutine-tree"]', { timeout: 30000 })

    // Verify coroutines are displayed
    const coroutineNodes = await page.locator('[data-testid="coroutine-node"]').count()
    expect(coroutineNodes).toBeGreaterThan(0)

    // Switch to Events tab
    await page.click('text=Events')

    // Verify events are listed
    const eventItems = await page.locator('[data-testid="event-item"]').count()
    expect(eventItems).toBeGreaterThan(0)

    // Switch to Validation tab
    await page.click('text=Validation')

    // Run validation
    await page.click('text=Run Validation')
    await page.waitForSelector('[data-testid="validation-results"]', { timeout: 10000 })
  })
})
```

---

### 12.4 Storybook Setup

**Files to create:**

- `frontend/.storybook/main.ts`
- `frontend/.storybook/preview.ts`
- `frontend/src/components/CoroutineTree.stories.tsx`
- `frontend/src/components/EventsList.stories.tsx`
- `frontend/src/components/ThreadTimeline.stories.tsx`
- (one story file per major component)

**Dependencies to add:**

```json
{
  "devDependencies": {
    "@storybook/react-vite": "^8.4.0",
    "@storybook/react": "^8.4.0",
    "@storybook/blocks": "^8.4.0",
    "@storybook/addon-essentials": "^8.4.0",
    "@storybook/addon-interactions": "^8.4.0",
    "storybook": "^8.4.0"
  }
}
```

**`.storybook/main.ts`:**

```typescript
import type { StorybookConfig } from '@storybook/react-vite'

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
}

export default config
```

**`.storybook/preview.ts`:**

```typescript
import type { Preview } from '@storybook/react'
import '../src/index.css'

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#18181b' },
        { name: 'light', value: '#ffffff' },
      ],
    },
  },
}

export default preview
```

**Example story:**

```typescript
// frontend/src/components/CoroutineTree.stories.tsx
import type { Meta, StoryObj } from '@storybook/react'
import { CoroutineTree } from './CoroutineTree'
import { CoroutineState } from '@/types/api'

const meta: Meta<typeof CoroutineTree> = {
  title: 'Visualization/CoroutineTree',
  component: CoroutineTree,
}

export default meta
type Story = StoryObj<typeof CoroutineTree>

export const ThreeCoroutines: Story = {
  args: {
    coroutines: [
      { id: 'cr-1', jobId: 'j-1', parentId: null, scopeId: 's-1', label: 'Parent', state: CoroutineState.ACTIVE },
      { id: 'cr-2', jobId: 'j-2', parentId: 'cr-1', scopeId: 's-1', label: 'Child A', state: CoroutineState.SUSPENDED },
      { id: 'cr-3', jobId: 'j-3', parentId: 'cr-1', scopeId: 's-1', label: 'Child B', state: CoroutineState.COMPLETED },
    ],
  },
}

export const Empty: Story = {
  args: { coroutines: [] },
}

export const DeepNesting: Story = {
  args: {
    coroutines: Array.from({ length: 10 }, (_, i) => ({
      id: `cr-${i}`,
      jobId: `j-${i}`,
      parentId: i === 0 ? null : `cr-${i - 1}`,
      scopeId: 's-1',
      label: `Level ${i}`,
      state: i < 8 ? CoroutineState.COMPLETED : CoroutineState.ACTIVE,
    })),
  },
}
```

---

### 12.5 Chromatic CI Integration

**Files to create/modify:**

- `.github/workflows/ci-frontend.yml` -- add Chromatic step

```yaml
# Add to ci-frontend.yml after the test step:
- name: Publish to Chromatic
  if: github.event_name == 'pull_request'
  uses: chromaui/action@latest
  with:
    projectToken: ${{ secrets.CHROMATIC_PROJECT_TOKEN }}
    workingDir: frontend
    buildScriptName: 'build-storybook'
```

**package.json script:**

```json
{
  "scripts": {
    "storybook": "storybook dev -p 6006",
    "build-storybook": "storybook build"
  }
}
```

---

## 13. Marketing Site (Non-Billing)

**Estimated effort:** 3-4 days

### Implementation Order

1. Switch from Docusaurus to Astro (or keep Docusaurus)
2. Homepage with hero, demo GIF, features, how-it-works
3. SEO meta tags
4. Deployment workflow

---

### 13.1 Current State

The `docs-site/` directory already exists with Docusaurus (`@docusaurus/core` 3.7.0). The decision is whether to keep Docusaurus or switch to Astro.

**Recommendation:** Keep Docusaurus since it is already set up and provides documentation features out of the box. If a more marketing-focused landing page is needed, Astro can be used as a separate `marketing/` directory.

---

### 13.2 Homepage Content

**Files to modify:**

- `docs-site/src/pages/index.tsx` (or create if using default docs homepage)

The homepage should include:

1. **Hero Section:** "Visualize Your Kotlin Coroutines" headline, subtitle about real-time visualization, CTA button to docs/getting started
2. **Demo GIF/Video:** Animated screenshot showing the tree view, events, and thread lanes updating in real-time
3. **Features Grid:** 4-6 feature cards:
   - Real-time event streaming (SSE)
   - Coroutine hierarchy tree & graph views
   - Thread lane visualization
   - Flow/Channel/Sync primitive tracking
   - Validation engine (20+ rules)
   - IntelliJ plugin (coming soon)
4. **How It Works:** 3-step visual:
   - Add `coroutine-viz-core` dependency
   - Replace `CoroutineScope` with `VizScope`
   - Open the web UI or IntelliJ plugin
5. **Code Example:** Kotlin snippet showing VizScope usage

---

### 13.3 SEO

**Files to modify:**

- `docs-site/docusaurus.config.ts`

```typescript
const config: Config = {
  title: 'Kotlin Coroutine Visualizer',
  tagline: 'Real-time visualization for Kotlin coroutine execution',
  url: 'https://coroutine-viz.dev',  // or your domain
  baseUrl: '/',
  favicon: 'img/favicon.ico',
  themeConfig: {
    metadata: [
      { name: 'keywords', content: 'kotlin, coroutines, visualization, debugging, concurrency' },
      { name: 'og:title', content: 'Kotlin Coroutine Visualizer' },
      { name: 'og:description', content: 'Real-time visualization for Kotlin coroutine execution, flows, channels, and structured concurrency' },
      { name: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary_large_image' },
    ],
  },
}
```

---

### 13.4 Deployment Workflow

**File:** `.github/workflows/deploy-docs.yml` (already exists, verify)

```yaml
name: Deploy Docs

on:
  push:
    branches: [main]
    paths: ['docs-site/**']

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 24

      - name: Install dependencies
        working-directory: docs-site
        run: npm ci

      - name: Build
        working-directory: docs-site
        run: npm run build

      - name: Deploy to Cloudflare Pages
        uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: coroutine-viz-docs
          directory: docs-site/build
```

Alternative: Vercel deployment via `vercel.json` in `docs-site/`.

---

## Summary: Effort Estimates and Prioritization

| Section | Estimated Days | Priority | Dependencies |
|---------|---------------|----------|-------------|
| 1. Production Readiness | 3-4 | P0 (High) | None |
| 2. Persistence & Data Layer | 5-7 | P1 | Section 1 |
| 3. Authentication & Multi-tenancy | 5-6 | P2 | Section 2 |
| 4. Replay Engine | 4-5 | P1 | None (frontend only) |
| 5. Export System | 3-4 | P2 | None (frontend only) |
| 6. Session Sharing | 3-4 | P2 | Section 2 optional |
| 7. Session Comparison | 3-4 | P3 | None |
| 8. OpenTelemetry Integration | 4-5 | P3 | None |
| 9. Performance & Scaling | 3-4 | P1 | None |
| 10. IntelliJ Plugin | 8-10 | P2 | Sections 1, 2 |
| 11. SDK & CI/CD | 4-5 | P2 | None |
| 12. Frontend Testing | 5-7 | P1 | None |
| 13. Marketing Site | 3-4 | P3 | None |

**Total estimated effort:** 52-69 developer-days

**Recommended implementation order (parallelizable tracks):**

**Track A (Backend):** 1 -> 9 -> 2 -> 3 -> 8
**Track B (Frontend):** 4 -> 5 -> 12
**Track C (Infrastructure):** 11 -> 10 -> 13
**Track D (Features):** 6 -> 7

Tracks A and B can be worked in parallel. Track C is independent. Track D depends on backend basics (Section 1) being done.
