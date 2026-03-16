# Frontend Development Guide

This guide explains coding conventions, patterns, and best practices for contributing to the Coroutine Visualizer frontend.

## Code Style

### Formatting (Prettier)

The project uses Prettier with these settings:

```json
{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100,
  "arrowParens": "avoid"
}
```

**Key rules:**
- No semicolons
- Single quotes for strings
- 2-space indentation
- Trailing commas in ES5 contexts (objects, arrays)
- 100 character line width
- No parentheses around single arrow function parameters

Run formatting:
```bash
pnpm format
```

### Linting (ESLint)

```bash
pnpm lint
```

**Rules enforced:**
- `@typescript-eslint/no-unused-vars` - Warn on unused variables (prefix with `_` to ignore)
- `@typescript-eslint/no-explicit-any` - Warn on `any` type usage

## TypeScript Guidelines

### Strict Mode

TypeScript is configured with strict mode. Follow these practices:

```typescript
// DO: Use explicit types for props
interface ButtonProps {
  label: string
  onClick: () => void
  disabled?: boolean
}

// DON'T: Use `any`
function handleData(data: any) { ... }  // Avoid this

// DO: Use proper types or `unknown` if truly unknown
function handleData(data: unknown) { ... }
```

### Import Aliases

Use the `@/` alias for imports from `src/`:

```typescript
// DO
import { CoroutineNode } from '@/types/api'
import { buildCoroutineTree } from '@/lib/utils'

// DON'T
import { CoroutineNode } from '../../../types/api'
```

### Type Imports

Use `type` imports for type-only imports:

```typescript
import type { CoroutineNode, CoroutineState } from '@/types/api'
```

## Component Patterns

### File Structure

Each component file should follow this structure:

```typescript
// 1. React imports
import { useMemo, useState } from 'react'

// 2. Third-party imports
import { Card, CardBody, Chip } from '@heroui/react'
import { motion } from 'framer-motion'

// 3. Internal imports (types, utils, hooks)
import type { CoroutineNode } from '@/types/api'
import { buildCoroutineTree } from '@/lib/utils'

// 4. Props interface
interface MyComponentProps {
  data: CoroutineNode[]
  onSelect?: (id: string) => void
}

// 5. Main component (named export)
export function MyComponent({ data, onSelect }: MyComponentProps) {
  // Implementation
}

// 6. Helper components (not exported)
function HelperComponent({ ... }) {
  // Implementation
}

// 7. Helper functions (not exported)
function helperFunction() {
  // Implementation
}
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `CoroutineTree`, `EventsList` |
| Hooks | camelCase with `use` prefix | `useSession`, `useEventStream` |
| Files (components) | PascalCase.tsx | `CoroutineTree.tsx` |
| Files (hooks) | kebab-case.ts | `use-sessions.ts` |
| Files (utils) | kebab-case.ts | `api-client.ts` |
| Props interfaces | PascalCase + Props | `CoroutineTreeProps` |
| Constants | SCREAMING_SNAKE_CASE | `DEFAULT_TIMEOUT` |

### Component Best Practices

**Early returns for edge cases:**

```typescript
export function CoroutineTree({ coroutines }: CoroutineTreeProps) {
  // Early return for empty state
  if (coroutines.length === 0) {
    return (
      <div className="py-8 text-center text-default-400">
        No coroutines in this session yet.
      </div>
    )
  }

  // Main render
  return (
    <div className="space-y-4">
      {/* ... */}
    </div>
  )
}
```

**Memoize expensive computations:**

```typescript
const tree = useMemo(() => buildCoroutineTree(coroutines), [coroutines])
```

**Use HeroUI components:**

```typescript
// DO: Use HeroUI
import { Button, Card, Chip } from '@heroui/react'

// DON'T: Create custom basic components
<button className="...">Click</button>
```

## Hooks Patterns

### Custom Hook Structure

```typescript
// src/hooks/use-my-feature.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'

export function useMyFeature(id: string) {
  return useQuery({
    queryKey: ['my-feature', id],
    queryFn: () => apiClient.getMyFeature(id),
    enabled: !!id,
  })
}

export function useMyFeatureMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: MyData) => apiClient.createMyFeature(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-feature'] })
    },
  })
}
```

### Query Key Conventions

```typescript
// Entity list
['sessions']
['scenarios']

// Single entity
['session', sessionId]
['scenario', scenarioId]

// Nested resources
['session', sessionId, 'events']
['session', sessionId, 'hierarchy']
```

## Styling Guidelines

### Tailwind CSS

Use Tailwind utility classes. Common patterns:

```typescript
// Layout
className="flex items-center justify-between"
className="grid grid-cols-2 gap-4"
className="space-y-4"

// Spacing
className="p-4"      // padding
className="m-2"      // margin
className="gap-3"    // gap in flex/grid

// Colors (use semantic colors from HeroUI)
className="text-default-500"   // muted text
className="text-primary"       // primary color
className="bg-danger/10"       // danger with opacity

// Responsive
className="text-sm md:text-base lg:text-lg"
```

### Framer Motion Animations

Standard animation patterns:

```typescript
// Fade in from left
<motion.div
  initial={{ opacity: 0, x: -20 }}
  animate={{ opacity: 1, x: 0 }}
  transition={{ delay: depth * 0.05 }}
>

// Pulsing effect
<motion.div
  animate={{
    boxShadow: [
      '0 0 0 0 rgba(99, 102, 241, 0)',
      '0 0 0 4px rgba(99, 102, 241, 0.1)',
      '0 0 0 0 rgba(99, 102, 241, 0)',
    ],
  }}
  transition={{ duration: 1.5, repeat: Infinity }}
>
```

## State Management

### Server State (TanStack Query)

All API data should use TanStack Query:

```typescript
// Fetching
const { data, isLoading, error } = useSession(sessionId)

// Mutations
const { mutate, isPending } = useCreateSession()
mutate({ name: 'My Session' })
```

### Local UI State (useState)

Use `useState` for UI-only state:

```typescript
const [isOpen, setIsOpen] = useState(false)
const [filter, setFilter] = useState('')
```

### Derived State (useMemo)

Compute derived values with `useMemo`:

```typescript
const filteredEvents = useMemo(
  () => events.filter(e => e.type.includes(filter)),
  [events, filter]
)
```

## File Organization

```
src/
├── components/          # Reusable UI components
│   ├── Layout.tsx       # App shell with navbar
│   ├── SessionDetails.tsx
│   └── [ComponentName].tsx
│
├── hooks/               # Custom React hooks
│   ├── use-sessions.ts  # Session queries/mutations
│   ├── use-scenarios.ts # Scenario queries/mutations
│   └── use-event-stream.ts
│
├── lib/                 # Utilities and clients
│   ├── api-client.ts    # API wrapper class
│   ├── query-client.ts  # TanStack Query config
│   └── utils.ts         # Helper functions
│
├── routes/              # File-based routing
│   ├── __root.tsx       # Root layout
│   ├── index.tsx        # Home page (/)
│   ├── sessions/        # /sessions routes
│   └── scenarios/       # /scenarios routes
│
├── types/               # TypeScript definitions
│   └── api.ts           # API response types
│
└── mocks/               # MSW mock handlers
    ├── browser.ts
    └── handlers.ts
```

## Adding New Features

### Adding a New Component

1. Create file in `src/components/[ComponentName].tsx`
2. Define props interface
3. Export named function component
4. Use HeroUI components for UI elements
5. Add animations with Framer Motion if needed

### Adding a New Route

1. Create file in `src/routes/[path].tsx`
2. Export component as default with `createFileRoute`:

```typescript
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/my-route')({
  component: MyRouteComponent,
})

function MyRouteComponent() {
  return <div>My Route</div>
}
```

3. Run `pnpm dev` - route tree auto-generates

### Adding a New API Endpoint

1. Add method to `src/lib/api-client.ts`:

```typescript
async getNewEndpoint(id: string): Promise<NewType> {
  return this.fetchJson<NewType>(`/new-endpoint/${id}`)
}
```

2. Add types to `src/types/api.ts`
3. Create hook in `src/hooks/use-new-feature.ts`

### Adding a New Hook

1. Create file `src/hooks/use-[feature-name].ts`
2. Use TanStack Query for server state
3. Export hook function

## Testing Checklist

Before submitting changes:

- [ ] `pnpm lint` passes
- [ ] `pnpm format` applied
- [ ] `pnpm build` succeeds (TypeScript check)
- [ ] Test with real backend (`pnpm dev` + backend running)
- [ ] Test with MSW mocks (for offline development)
- [ ] No `any` types introduced
- [ ] No console errors in browser

## Common Patterns Reference

### Loading State

```typescript
if (isLoading) {
  return <Spinner label="Loading..." />
}
```

### Error State

```typescript
if (error) {
  return (
    <div className="text-danger">
      Error: {error.message}
    </div>
  )
}
```

### Empty State

```typescript
if (data.length === 0) {
  return (
    <div className="py-8 text-center text-default-400">
      No items found.
    </div>
  )
}
```

### Conditional Rendering

```typescript
{isActive && <ActiveIndicator />}

{status === 'error' ? (
  <ErrorMessage />
) : (
  <SuccessMessage />
)}
```

## Icons

Use `react-icons` (Fi = Feather Icons):

```typescript
import { FiPlay, FiPause, FiCheck, FiX } from 'react-icons/fi'

<FiPlay className="h-5 w-5" />
```

Common icons used:
- `FiPlay` - Active/running
- `FiPause` - Suspended
- `FiCheck` / `FiCheckCircle` - Completed/success
- `FiX` / `FiXCircle` - Cancelled
- `FiAlertCircle` - Error/failed
- `FiCircle` - Default/created
- `FiClock` - Waiting
