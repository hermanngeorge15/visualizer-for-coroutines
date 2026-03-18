---
sidebar_position: 2
---

# Quick Start

This guide walks you through your first coroutine visualization in under 5 minutes.

## 1. Start the Application

```bash
docker compose up
```

Or start the backend and frontend separately (see [Installation](installation)).

## 2. Create a Session

1. Open `http://localhost:3000` in your browser
2. Click **New Session** to create a visualization session
3. You will be redirected to the session dashboard

Each session is an isolated environment with its own event store and runtime snapshot.

## 3. Run a Scenario

1. Open the **Scenarios** panel
2. Select a built-in scenario such as **Structured Concurrency** or **Flow Operators**
3. Click **Run** to execute it

The backend instruments the coroutine code, captures events, and streams them to the frontend via SSE.

## 4. Explore the Visualization

The dashboard has several panels:

- **Tree View** — Shows the coroutine hierarchy as a collapsible tree
- **Timeline** — Displays events on thread lanes over time
- **Events Tab** — Lists all raw events in chronological order
- **Flow Panel** — Appears when flow operators are used
- **Sync Panel** — Appears when Mutex/Semaphore/Select are used

Try clicking on a coroutine node in the tree to see its details, or hover over timeline bars to inspect event timing.

## 5. Check Validation

Switch to the **Validation** tab to see if any anti-patterns were detected. The validation engine runs 20+ rules against the captured events in real time.

## Next Steps

- [Sessions](../web-guide/sessions) — Learn about session management
- [Scenarios](../web-guide/scenarios) — Explore all built-in scenarios
- [Visualization](../web-guide/visualization) — Understand every panel in detail
