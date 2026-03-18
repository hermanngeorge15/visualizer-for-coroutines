# ADR-014: Plugin Communication Protocol

## Status
Accepted

## Date
2026-03-17

## Context
The IntelliJ plugin needs to receive visualization events from the user's instrumented application. The instrumented app runs as a separate process from the IDE.

## Decision
Use HTTP-based communication with a lightweight server inside the plugin.

### Protocol
```
[User's App]                    [IntelliJ Plugin]
     |                                |
     |  POST /events                  |
     |  { batch of VizEvent JSON }    |
     |------------------------------->|  PluginEventReceiver (CIO, port 8090)
     |                                |       |
     |  200 OK { received: true }     |       v
     |<-------------------------------|  VizSession → EventBus → UI panels
     |                                |
```

### Event Sink (in coroutine-viz-core)
The core library provides a `PluginEventSink` that instrumented apps use to send events:
```kotlin
class PluginEventSink(
    private val pluginHost: String = "localhost",
    private val pluginPort: Int = 8090
) {
    suspend fun send(event: VizEvent) {
        // HTTP POST to plugin receiver
    }
}
```

### Plugin Receiver
The `PluginEventReceiver` is a Ktor CIO server running inside the IDE:
- **Port**: 8090 (configurable in settings)
- **Endpoints**: `/health`, `/events`, `/session`
- **Lifecycle**: Started on IDE startup (if auto-start enabled), stopped on project close

### Event Format
Events are sent as JSON arrays over HTTP POST:
```json
POST /events
Content-Type: application/json

[
  {"kind": "CoroutineCreated", "sessionId": "...", "seq": 1, ...},
  {"kind": "CoroutineStarted", "sessionId": "...", "seq": 2, ...}
]
```

## Rationale
- **HTTP** is simple, debuggable, and works across process boundaries
- **CIO** engine is lightweight (no Netty needed in the IDE)
- **Batching** reduces overhead for high-frequency events
- **Port-based** discovery avoids file-system IPC complexity

## Consequences
### Positive
- Works with any JVM application (not limited to IntelliJ run configurations)
- Events can be sent from remote applications (docker, CI)
- Easy to test with curl/httpie

### Negative
- Port conflicts possible (mitigated by configurable port)
- Network overhead vs shared memory IPC
- Firewall may block on some corporate networks

## Related
- ADR-010: IntelliJ Plugin Architecture
- ADR-013: Core Library Extraction
