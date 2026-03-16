# Frontend File Structure

Complete overview of all files created for the Coroutine Visualizer frontend.

## 📁 Root Directory

```
frontend/
├── .gitignore                    # Git ignore patterns
├── .npmrc                        # pnpm configuration
├── .prettierrc                   # Prettier formatting rules
├── eslint.config.js              # ESLint flat config
├── index.html                    # HTML entry point
├── package.json                  # Dependencies and scripts
├── postcss.config.js             # PostCSS + Autoprefixer
├── pnpm-workspace.yaml           # pnpm workspace config
├── tailwind.config.js            # Tailwind + HeroUI theme
├── tsconfig.json                 # TypeScript configuration
├── vite.config.ts                # Vite build configuration
├── FILE_STRUCTURE.md             # This file
├── README.md                     # Project documentation
└── SETUP.md                      # Installation guide
```

## 📁 Public Directory

```
public/
└── mockServiceWorker.js          # MSW service worker (placeholder)
```

**Note**: Run `npx msw init public/` to generate the actual service worker.

## 📁 Source Directory

### Overview

```
src/
├── components/                   # React components
├── hooks/                        # Custom hooks
├── lib/                          # Utilities and clients
├── mocks/                        # MSW mock handlers
├── routes/                       # TanStack Router routes
├── types/                        # TypeScript type definitions
├── index.css                     # Global styles
├── main.tsx                      # Application entry point
├── routeTree.gen.ts              # Auto-generated route tree
└── vite-env.d.ts                 # Vite type declarations
```

### Components (`src/components/`)

```
components/
├── Layout.tsx                    # Main layout with navigation
├── SessionDetails.tsx            # Session overview component
├── CoroutineTree.tsx             # Tree visualization
├── EventsList.tsx                # Event timeline
├── ScenarioForm.tsx              # Scenario execution form
├── CreateSessionForm.tsx         # Session creation form
├── StateIndicator.tsx            # Coroutine state chip
├── EmptyState.tsx                # Empty state placeholder
├── LoadingSpinner.tsx            # Loading indicator
└── ErrorAlert.tsx                # Error message display
```

**Component Details:**

| Component | Purpose | Key Features |
|-----------|---------|--------------|
| Layout | Main app layout | Navigation, routing links |
| SessionDetails | Session overview | Tabs, live stream toggle |
| CoroutineTree | Hierarchy view | Tree structure, animations |
| EventsList | Event timeline | Filtering, sorting, animations |
| ScenarioForm | Run scenarios | Parameter inputs, validation |
| CreateSessionForm | Create sessions | React Hook Form + Zod |
| StateIndicator | State badge | Color-coded, animated |
| EmptyState | Empty states | Icon, message, action |
| LoadingSpinner | Loading states | Spinner with label |
| ErrorAlert | Error display | Icon, title, message |

### Hooks (`src/hooks/`)

```
hooks/
├── use-sessions.ts               # Session CRUD operations
├── use-scenarios.ts              # Scenario operations
└── use-event-stream.ts           # SSE event streaming
```

**Hook Details:**

| Hook | Purpose | Returns |
|------|---------|---------|
| `useSessions()` | List all sessions | Query with sessions array |
| `useSession(id)` | Get session details | Query with session snapshot |
| `useSessionEvents(id)` | Fetch events | Query with events array |
| `useCreateSession()` | Create session mutation | Mutation with sessionId |
| `useDeleteSession()` | Delete session mutation | Mutation with success status |
| `useScenarios()` | List scenarios | Query with scenarios array |
| `useRunScenario()` | Run scenario mutation | Mutation with completion data |
| `useEventStream(id, enabled)` | SSE connection | Events, isConnected, error |

### Library (`src/lib/`)

```
lib/
├── api-client.ts                 # Backend API client
├── query-client.ts               # TanStack Query config
└── utils.ts                      # Utility functions
```

**Library Details:**

| File | Exports | Purpose |
|------|---------|---------|
| api-client.ts | `apiClient` | Fetch wrapper, API methods |
| query-client.ts | `queryClient` | Query cache configuration |
| utils.ts | `cn()`, `formatNanoTime()`, etc. | Helper utilities |

### Mocks (`src/mocks/`)

```
mocks/
├── browser.ts                    # MSW worker setup
└── handlers.ts                   # API mock handlers
```

**Mock Handlers:**
- GET `/api/sessions` - Returns mock sessions
- POST `/api/sessions` - Creates mock session
- GET `/api/sessions/:id` - Returns mock snapshot
- DELETE `/api/sessions/:id` - Mock deletion
- GET `/api/scenarios` - Returns mock scenarios
- POST `/api/scenarios/:id` - Mock scenario execution

### Routes (`src/routes/`)

```
routes/
├── __root.tsx                    # Root route with context
├── index.tsx                     # Home page (/)
├── sessions/
│   ├── index.tsx                 # Sessions list (/sessions)
│   └── $sessionId.tsx            # Session details (/sessions/:id)
└── scenarios/
    └── index.tsx                 # Scenarios page (/scenarios)
```

**Route Mapping:**

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | HomePage | Feature overview, recent sessions |
| `/sessions` | SessionsPage | List and manage sessions |
| `/sessions/:sessionId` | SessionDetailPage | View session with tree & events |
| `/scenarios` | ScenariosPage | List and run scenarios |

### Types (`src/types/`)

```
types/
└── api.ts                        # API type definitions
```

**Exported Types:**
- `CoroutineNode` - Coroutine state
- `CoroutineState` - Enum (CREATED, ACTIVE, etc.)
- `SessionInfo` - Session metadata
- `SessionSnapshot` - Complete session state
- `ScenarioCompletion` - Scenario result
- `Scenario` - Scenario definition
- `VizEvent` - Event types
- `VizEventKind` - Event kind enum

### Entry Points

```
src/
├── main.tsx                      # React root, providers setup
├── index.css                     # Global styles + Tailwind
├── routeTree.gen.ts              # Auto-generated (TanStack Router)
└── vite-env.d.ts                 # Vite type declarations
```

## 📊 File Count Summary

| Category | Count | Description |
|----------|-------|-------------|
| Configuration | 9 | Root config files |
| Components | 10 | React components |
| Hooks | 3 | Custom hooks |
| Library | 3 | Utilities and clients |
| Routes | 5 | Page components |
| Types | 1 | Type definitions |
| Mocks | 2 | MSW setup |
| Documentation | 3 | README, SETUP, this file |
| **Total** | **36** | **All files** |

## 🎯 File Purpose Map

### Configuration Files
```
.gitignore           → Ignore node_modules, dist, etc.
.npmrc               → pnpm settings
.prettierrc          → Code formatting
eslint.config.js     → Linting rules
package.json         → Dependencies
postcss.config.js    → CSS processing
pnpm-workspace.yaml  → Workspace setup
tailwind.config.js   → Styling config
tsconfig.json        → TypeScript strict mode
vite.config.ts       → Build tool + proxy
```

### Application Files
```
index.html           → HTML shell
main.tsx             → React initialization
index.css            → Global styles
routeTree.gen.ts     → Router config (auto)
vite-env.d.ts        → Vite types
```

### Feature Files
```
components/          → Reusable UI
hooks/               → State management logic
lib/                 → API + utilities
routes/              → Pages
types/               → Type safety
mocks/               → Dev mocking
```

## 🔧 Build Output

When you run `pnpm build`, Vite generates:

```
dist/
├── assets/
│   ├── index-[hash].js          # Application JS bundle
│   ├── index-[hash].css         # Compiled CSS
│   └── [other chunks]           # Code-split chunks
└── index.html                   # Optimized HTML
```

## 🚀 Quick Navigation

### Adding a New Page
1. Create `src/routes/your-page.tsx`
2. Export route with `createFileRoute('/your-page')`
3. Add link in `Layout.tsx`

### Adding a New Component
1. Create `src/components/YourComponent.tsx`
2. Export component function
3. Import where needed

### Adding a New Hook
1. Create `src/hooks/use-your-feature.ts`
2. Use TanStack Query for server state
3. Export hook function

### Adding a New API Endpoint
1. Add method to `lib/api-client.ts`
2. Define types in `types/api.ts`
3. Create hook in `hooks/`

## 📝 Notes

- **Auto-generated files**: `routeTree.gen.ts` is regenerated on dev server start
- **Public folder**: Add static assets here (images, fonts, etc.)
- **Mock service worker**: Run `npx msw init public/` to activate mocking
- **Type safety**: All files use strict TypeScript

## 🎨 Styling Approach

```
Tailwind CSS (utility classes)
    ↓
HeroUI Components (styled components)
    ↓
Custom Components (composition)
    ↓
Framer Motion (animations)
```

## 📦 Bundle Structure

```
main.tsx
  ├── React + ReactDOM
  ├── TanStack Query (QueryClientProvider)
  ├── HeroUI (HeroUIProvider)
  └── TanStack Router (RouterProvider)
      └── Route Components
          └── UI Components
              └── Hooks
                  └── API Client
```

---

**Total Lines of Code**: ~2,500+ lines  
**Total Components**: 10  
**Total Hooks**: 8 (3 custom + 5 from hooks file)  
**Total Routes**: 4 pages  
**Total API Methods**: 8  

**Ready for production with comprehensive type safety and modern tooling!** ✨

