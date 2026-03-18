---
sidebar_position: 1
---

# Installation

## Prerequisites

- **Node.js** 20+ and **pnpm** 9+ (frontend)
- **JDK** 21+ (backend)
- **Docker** and **Docker Compose** (recommended)

## Option 1: Docker (Recommended)

The fastest way to get started. See the [Docker guide](docker) for details.

```bash
git clone https://github.com/hermanngeorge15/visualizer-for-coroutines.git
cd visualizer-for-coroutines
docker compose up
```

The frontend will be available at `http://localhost:3000` and the backend at `http://localhost:8080`.

## Option 2: Local Development

### Backend

```bash
cd backend
./gradlew run
```

The Ktor server starts on port `8080`.

### Frontend

```bash
cd frontend
pnpm install
pnpm dev
```

The Vite dev server starts on port `3000` and proxies `/api` requests to the backend.

## Verify Installation

Open `http://localhost:3000` in your browser. You should see the session list page. Create a new session and run a scenario to confirm everything is working.

## Troubleshooting

| Problem | Solution |
|---|---|
| Port 8080 already in use | Stop other services or set `PORT` env variable |
| Port 3000 already in use | Vite will auto-pick the next available port |
| Backend connection refused | Ensure the backend is running before the frontend |
| Docker build fails | Run `docker compose build --no-cache` to rebuild |
