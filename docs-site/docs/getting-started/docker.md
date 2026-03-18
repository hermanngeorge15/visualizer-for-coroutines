---
sidebar_position: 3
---

# Docker Setup

Docker Compose is the recommended way to run the Kotlin Coroutine Visualizer. It starts both the backend and frontend with a single command.

## Docker Compose

```bash
docker compose up
```

This starts:

| Service | Port | Description |
|---|---|---|
| `backend` | 8080 | Ktor API server with SSE streaming |
| `frontend` | 3000 | React Vite dev server, proxies `/api` to backend |

## Building Images

To rebuild images after code changes:

```bash
docker compose build
```

For a clean rebuild:

```bash
docker compose build --no-cache
```

## Running in Background

```bash
docker compose up -d
```

View logs:

```bash
docker compose logs -f
docker compose logs -f backend   # backend only
docker compose logs -f frontend  # frontend only
```

## Stopping

```bash
docker compose down
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `BACKEND_PORT` | `8080` | Port for the Ktor backend |
| `FRONTEND_PORT` | `3000` | Port for the Vite frontend |
| `API_BASE_URL` | `http://backend:8080` | Backend URL used by the frontend proxy |

## Production Build

For a production-optimized build:

```bash
docker compose -f docker-compose.prod.yml up
```

This serves the frontend as static files via Nginx and runs the backend with optimized JVM settings.

## Troubleshooting

- **Container keeps restarting**: Check logs with `docker compose logs` for startup errors
- **Hot reload not working**: Ensure volume mounts are correctly mapping source directories
- **Out of memory**: Increase Docker memory allocation in Docker Desktop settings
