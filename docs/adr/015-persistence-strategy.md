# ADR-015: Persistence Strategy

## Status
Accepted

## Date
2026-03-18

## Context
All session and event data is currently held in-memory only. When the backend restarts, every session and its events are lost. This is acceptable for local development but blocks production deployment, session sharing (ADR-019), and any long-lived analysis workflow. We need durable storage that integrates cleanly with the existing event-sourced architecture without forcing all users onto a database.

## Decision
Introduce database-backed persistence using the Exposed ORM with H2 for development and PostgreSQL for production. Keep in-memory storage as the default so the zero-config developer experience is preserved.

### Abstractions
Define two interfaces in `coroutine-viz-core`:

```kotlin
interface SessionStoreInterface {
    suspend fun create(session: SessionInfo): SessionInfo
    suspend fun get(id: String): SessionInfo?
    suspend fun list(): List<SessionInfo>
    suspend fun delete(id: String)
}

interface EventStoreInterface {
    suspend fun append(sessionId: String, event: VizEvent)
    suspend fun getAll(sessionId: String): List<VizEvent>
    suspend fun getAfter(sessionId: String, seq: Long): List<VizEvent>
    suspend fun count(sessionId: String): Long
}
```

The existing `EventStore` and `SessionManager` become the in-memory implementations. New `ExposedSessionStore` and `ExposedEventStore` classes implement the database-backed variants.

### Database Schema
- **sessions** table: `id (PK)`, `name`, `created_at`, `scenario`, `metadata (JSONB)`
- **events** table: `id (PK, BIGSERIAL)`, `session_id (FK)`, `seq`, `kind`, `timestamp`, `payload (JSONB)`, index on `(session_id, seq)`

### Connection Pool
Use HikariCP with sensible defaults:
- `maximumPoolSize`: 10
- `minimumIdle`: 2
- `connectionTimeout`: 30s

### Event Storage Format
Events are serialized to JSONB using kotlinx-serialization. The `kind` discriminator is stored both as a top-level column (for filtering/indexing) and inside the JSONB payload (for deserialization).

### Retention Policy
A background coroutine runs on a configurable interval (default: 1 hour) and enforces:
- **max-age**: Delete sessions older than a configurable TTL (default: 30 days)
- **max-events-per-session**: Trim oldest events beyond the limit (default: 100,000)

### Configuration
```yaml
storage:
  type: memory | database          # default: memory
  database:
    url: jdbc:postgresql://localhost:5432/coroutineviz
    driver: org.postgresql.Driver
    username: ${DB_USER}
    password: ${DB_PASSWORD}
  retention:
    maxAgeDays: 30
    maxEventsPerSession: 100000
    cleanupIntervalMinutes: 60
```

## Alternatives Considered

### Raw JDBC
Too verbose for the query patterns we need. Manual ResultSet mapping would be tedious and error-prone for JSONB columns. Exposed provides a type-safe DSL without the weight of Hibernate.

### SQLDelight
Excellent for Kotlin Multiplatform projects, but we are JVM-only. SQLDelight's compile-time SQL verification is appealing but adds build complexity that Exposed's Kotlin DSL avoids.

### File-based JSON Storage
Appending events to JSON files is simple but not queryable, has no transactional guarantees, and makes retention/cleanup brittle. Does not support concurrent access well.

## Consequences

### Positive
- Sessions survive backend restarts — critical for production use
- JSONB storage preserves the flexibility of the event schema while allowing SQL queries for analytics
- In-memory default means zero-config experience is unchanged for local development
- Retention policy prevents unbounded storage growth
- Interface abstractions enable future storage backends (Redis, S3 archive) without changing callers

### Negative
- Additional dependency on Exposed, HikariCP, and a JDBC driver
- Database migrations must be managed (Exposed's `SchemaUtils.createMissingTablesAndColumns` for dev, Flyway for production)
- JSONB queries are less efficient than normalized columns for complex event filtering
- Docker Compose setup grows to include a PostgreSQL service

## Related
- ADR-019: Session Sharing (depends on persistence)
- ADR-020: Performance Scaling (retention policy complements bounded event store)
