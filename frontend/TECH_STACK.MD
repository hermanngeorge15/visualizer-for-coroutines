# Tech Stack

## Core
- Framework: React 19 + TypeScript
- Build tool: Vite 6 (SWC)
- Package manager: pnpm (Node >= 24)

## Routing & Data
- Router: TanStack Router (file-based routes)
- Data fetching/state: TanStack Query (QueryClient, cache, mutations)

## UI & Styling
- Component library: HeroUI
- Styling: Tailwind CSS (+ Typography plugin)
- Layout primitives: Container/Section/Grid (Tailwind-based)

## Forms & Validation
- React Hook Form (RHF)
- Zod (schema validation)

## Content & Editing
- Markdown rendering: react-markdown + remark-gfm + rehype-raw (Tailwind `.prose`)
- Editors:
  - Markdown: @mdxeditor/editor (with fallback textarea)
  - Rich text (HTML): temporary textarea fallback (React 19 compatible)

## Media, Icons, Motion
- Icons: react-icons
- Animations: Framer Motion

## Utilities
- clsx (class merging)
- tailwind-merge (conflict resolution)

## Testing / Mocks
- MSW (browser worker; mock endpoints for local dev)

## Tooling & Code Quality
- ESLint (flat config)
- Prettier

## Conventions
- Path alias: `@` → `src/`
- File-based routing under `src/routes/`

## Notable Dev Dependencies
- react-markdown, remark-gfm, rehype-raw (mixed MD/HTML support)
- @vitejs/plugin-react-swc (SWC transform)
