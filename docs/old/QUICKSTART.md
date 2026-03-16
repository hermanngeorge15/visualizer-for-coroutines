# Coroutine Visualizer - Quick Start Guide

A full-stack application for visualizing Kotlin coroutine execution in real-time.

## Overview

- **Backend**: Kotlin + Ktor + Server-Sent Events (SSE)
- **Frontend**: React 19 + TypeScript + Vite + TanStack (Router & Query) + HeroUI

## Prerequisites

### Backend
- JDK 17 or higher
- Gradle (wrapper included)

### Frontend
- Node.js >= 24.0.0
- pnpm >= 9.0.0

## Quick Start

### 1. Start the Backend

```bash
cd backend
./gradlew run
```

The backend will start on `http://localhost:8080`.

**Verify it's running:**
```bash
curl http://localhost:8080/
# Should return: Hello World!
```

### 2. Start the Frontend

In a new terminal:

```bash
cd frontend
pnpm install
pnpm dev
```

The frontend will start on `http://localhost:3000`.

### 3. Open the Application

Visit `http://localhost:3000` in your browser.

## Using the Application

### Option A: Run a Scenario

1. Click **"Run Scenarios"** on the homepage
2. Choose a scenario (e.g., "Nested Coroutines")
3. Click **"Run Scenario"**
4. View the results with the coroutine tree and events

### Option B: Create a Session Manually

1. Click **"View Sessions"**
2. Click **"Create Session"** (optionally name it)
3. Use the backend API to send coroutine events to the session
4. View real-time updates via SSE

### Enable Live Streaming

1. Navigate to a session detail page
2. Click **"Enable Live Stream"**
3. See events appear in real-time as coroutines execute

## API Endpoints

### Sessions
```bash
# List sessions
GET http://localhost:8080/api/sessions

# Create session
POST http://localhost:8080/api/sessions?name=my-session

# Get session details
GET http://localhost:8080/api/sessions/{sessionId}

# Stream events (SSE)
GET http://localhost:8080/api/sessions/{sessionId}/stream

# Delete session
DELETE http://localhost:8080/api/sessions/{sessionId}
```

### Scenarios
```bash
# List scenarios
GET http://localhost:8080/api/scenarios

# Run scenario
POST http://localhost:8080/api/scenarios/nested
POST http://localhost:8080/api/scenarios/parallel
POST http://localhost:8080/api/scenarios/cancellation
POST http://localhost:8080/api/scenarios/deep-nesting?depth=10
POST http://localhost:8080/api/scenarios/mixed
```

## Example: Run a Scenario via CLI

```bash
# Run nested coroutines scenario
curl -X POST http://localhost:8080/api/scenarios/nested

# Response:
# {
#   "success": true,
#   "sessionId": "session-1234567890",
#   "message": "Scenario completed. Connect to /api/sessions/session-1234567890/stream for live events.",
#   "coroutineCount": 3,
#   "eventCount": 9
# }

# Now view the session
curl http://localhost:8080/api/sessions/session-1234567890
```

## Project Structure

```
visualizer-for-coroutines/
├── backend/
│   ├── src/main/kotlin/com/jh/proj/coroutineviz/
│   │   ├── Application.kt          # Entry point
│   │   ├── Routing.kt              # API routes
│   │   ├── events/                 # Event types
│   │   ├── session/                # Session management
│   │   ├── wrappers/               # VizScope wrapper
│   │   └── scenarios/              # Test scenarios
│   └── build.gradle.kts
│
├── frontend/
│   ├── src/
│   │   ├── routes/                 # Pages (TanStack Router)
│   │   ├── components/             # UI components
│   │   ├── hooks/                  # React hooks
│   │   ├── lib/                    # API client & utils
│   │   └── types/                  # TypeScript types
│   └── package.json
│
└── QUICKSTART.md (this file)
```

## Key Features

### Backend Features
✅ Session management with concurrent sessions  
✅ Real-time event streaming via SSE  
✅ Coroutine lifecycle tracking (Created, Started, Completed, Cancelled)  
✅ Parent-child relationship tracking  
✅ Multiple pre-built scenarios  
✅ **CORS configured** for frontend communication  

### Frontend Features
✅ Real-time coroutine visualization  
✅ Hierarchical tree view of coroutine relationships  
✅ Event timeline with filtering  
✅ Live SSE connection with visual indicators  
✅ Scenario execution interface  
✅ Responsive design with dark/light mode support  

## Troubleshooting

### Backend Issues

**Port 8080 already in use:**
```bash
# Change port in backend/src/main/resources/application.yaml
```

**Build fails:**
```bash
cd backend
./gradlew clean build
```

### Frontend Issues

**Port 3000 already in use:**
```bash
PORT=3001 pnpm dev
```

**Module not found errors:**
```bash
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

**Backend connection fails:**
- Ensure backend is running on port 8080
- Check the proxy configuration in `vite.config.ts`
- CORS errors? See `backend/CORS_SETUP.md`

## Development Without Backend (MSW)

To develop the frontend without running the backend:

1. Initialize MSW:
   ```bash
   cd frontend
   npx msw init public/ --save
   ```

2. Enable MSW in `main.tsx`:
   ```typescript
   if (import.meta.env.DEV) {
     const { worker } = await import('./mocks/browser')
     await worker.start()
   }
   ```

3. Start frontend:
   ```bash
   pnpm dev
   ```

Mock data will be served instead of real API calls.

## Next Steps

- **Explore Scenarios**: Try different coroutine patterns
- **Monitor Sessions**: Enable live streaming to see real-time updates
- **Read Documentation**: Check `BACKEND_ANALYSIS.md` for architecture details
- **Extend Functionality**: Add custom scenarios or visualizations

## Resources

- **Backend**: See `backend/README.md`
- **Frontend**: See `frontend/README.md` and `frontend/SETUP.md`
- **Tech Stack**: See `frontend/TECH_STACK.MD`
- **Architecture**: See `BACKEND_ANALYSIS.md`
- **CORS Setup**: See `backend/CORS_SETUP.md`

## Support

For issues or questions:
1. Check the troubleshooting sections above
2. Review the detailed READMEs in each directory
3. Check backend logs for API errors
4. Use browser DevTools for frontend debugging

---

**Happy visualizing! 🚀**

