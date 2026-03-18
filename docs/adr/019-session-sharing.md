# ADR-019: Session Sharing

## Status
Accepted

## Date
2026-03-18

## Context
There is currently no way to share a session's visualization with teammates or embed it in documentation. When a developer discovers an interesting concurrency pattern or bug, they cannot easily show it to others without screen-sharing or screenshots. This limits the tool's usefulness in collaborative debugging and code review workflows.

## Decision
Implement a share token model that generates unique, expirable links to read-only session views.

### Share Token Model
A share token is a UUID linked to a session with permissions and an expiry:

```kotlin
data class ShareToken(
    val token: String,          // UUID v4
    val sessionId: String,
    val createdBy: String,      // user ID (from ADR-016 auth)
    val createdAt: Instant,
    val expiresAt: Instant?,    // null = never expires
    val permission: SharePermission = SharePermission.READ_ONLY
)

enum class SharePermission { READ_ONLY }
```

### Database Schema
Requires the persistence layer from ADR-015.

```sql
CREATE TABLE shares (
    token       UUID PRIMARY KEY,
    session_id  VARCHAR(64) NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    created_by  VARCHAR(128) NOT NULL,
    created_at  TIMESTAMP NOT NULL DEFAULT now(),
    expires_at  TIMESTAMP,       -- NULL means no expiry
    permission  VARCHAR(16) NOT NULL DEFAULT 'READ_ONLY',
    access_count INTEGER NOT NULL DEFAULT 0,
    last_accessed_at TIMESTAMP
);

CREATE INDEX idx_shares_session ON shares(session_id);
CREATE INDEX idx_shares_expiry ON shares(expires_at) WHERE expires_at IS NOT NULL;
```

### API Endpoints

**Create share link:**
```
POST /api/sessions/:id/share
Content-Type: application/json

{
  "expiresIn": "7d"    // "1d" | "7d" | "30d" | "never"
}

Response 201:
{
  "token": "a1b2c3d4-...",
  "url": "https://app.example.com/shared/a1b2c3d4-...",
  "expiresAt": "2026-03-25T00:00:00Z"
}
```

**Access shared session:**
```
GET /api/shared/:token

Response 200: { session: SessionInfo, events: VizEvent[] }
Response 410: { error: "Share link has expired" }
Response 404: { error: "Share link not found" }
```

**List shares for a session:**
```
GET /api/sessions/:id/shares

Response 200: [ { token, expiresAt, accessCount, lastAccessedAt } ]
```

**Revoke a share:**
```
DELETE /api/sessions/:id/shares/:token

Response 204
```

### Frontend: Share Button and Modal
Add a "Share" button in the `SessionDetails` toolbar that opens a modal:

1. User selects expiry duration (1 day, 7 days, 30 days, never)
2. Clicks "Generate Link"
3. Modal shows the shareable URL with a "Copy to Clipboard" button
4. Existing shares for this session are listed below with revoke buttons

### Read-Only View
When accessing `/shared/:token`, the frontend renders the same session panels but:
- Hides the "Run Scenario" button
- Hides the "Delete Session" button
- Hides the "Share" button (no re-sharing)
- Displays a banner: "You are viewing a shared session (read-only)"
- Replay controls (ADR-017) remain available — replaying is a read-only operation

### Token Cleanup
A background coroutine (part of the retention policy from ADR-015) periodically deletes expired tokens. Default cleanup interval: 1 hour.

### Rate Limiting
Shared endpoints are rate-limited to prevent abuse:
- `GET /api/shared/:token` — 60 requests/minute per IP
- `POST /api/sessions/:id/share` — 10 requests/minute per user

## Alternatives Considered

### Public Session URLs
Make session URLs publicly accessible without tokens. Simple but provides no access control, no expiry, and no ability to revoke access. Any URL leak exposes the data permanently.

### Embed Iframes
Provide embeddable `<iframe>` snippets for documentation. Adds CORS complexity, requires the server to be publicly accessible, and embedded views need separate styling. Can be added later as an enhancement on top of the share token model.

### Signed URLs (S3-style)
Generate URLs with embedded HMAC signatures and expiry. Avoids database lookups but makes revocation impossible without a blocklist, and the URL becomes very long. Token-based approach is simpler and more flexible.

## Consequences

### Positive
- Teammates can view sessions without needing their own accounts or API keys
- Expiry and revocation provide control over data access lifetime
- Read-only view prevents accidental modification of shared sessions
- Access tracking (count, last accessed) gives visibility into link usage
- Cascading delete ensures shares are cleaned up when sessions are deleted

### Negative
- Requires ADR-015 persistence to be implemented first (shares table needs a database)
- Token management adds UI complexity (modal, list, revoke)
- Rate limiting configuration must be tuned to avoid blocking legitimate use
- Shared sessions must remain in the database — the retention policy must not delete sessions that have active (non-expired) share links, adding a constraint to the cleanup logic

## Related
- ADR-015: Persistence Strategy (required dependency for shares table)
- ADR-016: Authentication Architecture (share tokens bypass user auth by design)
- ADR-017: Replay Engine Design (replay available in shared view)
