---
sidebar_position: 1
---

# Sessions

Sessions are the primary unit of organization in the Coroutine Visualizer. Each session provides an isolated environment for capturing and visualizing coroutine events.

## Creating a Session

Click **New Session** on the home page or use the API:

```bash
curl -X POST http://localhost:8080/api/sessions
```

Each session gets a unique ID and its own:
- **EventStore** — Persists all captured events
- **RuntimeSnapshot** — Maintains the current state of all coroutines
- **ProjectionService** — Computes derived views from events

## Listing Sessions

The home page displays all active sessions with their creation time and event count. Sessions can also be listed via the API:

```bash
curl http://localhost:8080/api/sessions
```

## Session Dashboard

Clicking a session opens its dashboard, which contains:

- Visualization panels (tree, graph, timeline, thread lanes)
- Scenario runner
- Event log
- Validation results

## Deleting a Session

Delete a session from the session list or via the API:

```bash
curl -X DELETE http://localhost:8080/api/sessions/{sessionId}
```

Deleting a session removes all associated events and state.

## Session Lifecycle

1. **Created** — Session is initialized with empty stores
2. **Active** — Scenarios are running and events are streaming
3. **Idle** — No active scenarios; events are retained for review
4. **Deleted** — All data is removed

## SSE Connection

The frontend opens an SSE connection per session to receive real-time events:

```
GET /api/sessions/{sessionId}/events/stream
```

Events arrive as JSON payloads and are processed by the frontend state management layer.
