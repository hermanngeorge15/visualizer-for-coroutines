# ADR-005: Docker Development Environment

## Status
Accepted

## Date
2026-03-16

## Context
Neither repo has Docker support. Local development requires:
- Node.js >= 24, pnpm >= 9 for frontend
- JDK 11+, Gradle for backend
- Running both services manually and configuring the Vite proxy

New contributors must install and configure both toolchains manually.

## Decision
Add Docker support with a root `docker-compose.yml`:

```yaml
services:
  backend:
    build: ./backend
    ports: ["8080:8080"]
    volumes: ["./backend/src:/app/src"]  # Hot reload via Ktor auto-reload

  frontend:
    build: ./frontend
    ports: ["3000:3000"]
    volumes: ["./frontend/src:/app/src"]  # Vite HMR
    depends_on: [backend]
    environment:
      - VITE_API_URL=http://backend:8080
```

### Backend Dockerfile
- Multi-stage: Gradle build stage + JRE runtime stage
- Uses `eclipse-temurin:21-jre` for runtime
- Exposes port 8080

### Frontend Dockerfile
- Multi-stage: pnpm install + build stage + nginx for production
- Dev target: Node with Vite dev server
- Exposes port 3000

## Rationale
- One command (`docker compose up`) starts the entire stack
- Consistent environment across developers
- No local JDK/Node version conflicts
- Production-like setup available for testing

## Consequences
- Developers can use Docker OR local toolchains (not required)
- CI can optionally use Docker for integration tests
- docker-compose.yml becomes the canonical "how to run" documentation
- `.dockerignore` files needed to prevent bloated images
