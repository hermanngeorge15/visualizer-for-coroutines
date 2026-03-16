# Frontend Setup Guide

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** >= 24.0.0 ([Download](https://nodejs.org/))
- **pnpm** >= 9.0.0 (Install: `npm install -g pnpm`)

Check versions:
```bash
node --version  # Should be >= v24.0.0
pnpm --version  # Should be >= 9.0.0
```

## Installation Steps

### 1. Navigate to Frontend Directory

```bash
cd frontend
```

### 2. Install Dependencies

```bash
pnpm install
```

This will install all required packages from `package.json`.

### 3. Start Development Server

```bash
pnpm dev
```

The application will start at `http://localhost:3000`.

## Development Modes

### With Backend (Default)

Make sure the backend is running on `http://localhost:8080`:

```bash
# In backend directory
./gradlew run
```

Then start the frontend:

```bash
# In frontend directory
pnpm dev
```

The frontend will proxy API requests to the backend automatically.

### Without Backend (MSW Mocking)

To develop without the backend running:

1. Initialize MSW:
   ```bash
   npx msw init public/ --save
   ```

2. Create `.env.local`:
   ```env
   VITE_ENABLE_MSW=true
   ```

3. Update `main.tsx` to enable MSW:
   ```typescript
   // At the top of main.tsx
   if (import.meta.env.VITE_ENABLE_MSW === 'true') {
     const { worker } = await import('./mocks/browser')
     await worker.start()
   }
   ```

4. Start dev server:
   ```bash
   pnpm dev
   ```

## Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server (hot reload enabled) |
| `pnpm build` | Build for production |
| `pnpm preview` | Preview production build locally |
| `pnpm lint` | Run ESLint |
| `pnpm format` | Format code with Prettier |

## Project Structure

```
frontend/
├── public/               # Static assets
│   └── mockServiceWorker.js  # MSW service worker
├── src/
│   ├── components/      # React components
│   ├── hooks/          # Custom hooks
│   ├── lib/            # Utilities and clients
│   ├── mocks/          # MSW mock handlers
│   ├── routes/         # TanStack Router routes
│   ├── types/          # TypeScript types
│   ├── index.css       # Global styles
│   └── main.tsx        # Entry point
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

## Troubleshooting

### Port Already in Use

If port 3000 is already in use:

```bash
# Change port in vite.config.ts or use environment variable
PORT=3001 pnpm dev
```

### Backend Connection Issues

1. Verify backend is running on port 8080:
   ```bash
   curl http://localhost:8080/
   ```

2. Check proxy configuration in `vite.config.ts`:
   ```typescript
   proxy: {
     '/api': {
       target: 'http://localhost:8080',
       changeOrigin: true,
     },
   }
   ```

### TypeScript Errors

If you see TypeScript errors after installation:

```bash
# Clear cache and reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### Stale Router Types

If TanStack Router types are outdated:

```bash
# Stop dev server and restart
# The router will auto-generate types on startup
pnpm dev
```

## Building for Production

### Build

```bash
pnpm build
```

This creates an optimized build in the `dist/` directory.

### Preview Build Locally

```bash
pnpm preview
```

Visit `http://localhost:4173` to see the production build.

### Deploy

The `dist/` directory contains static files that can be deployed to:
- Vercel
- Netlify
- AWS S3 + CloudFront
- Any static hosting service

## Development Tips

### Hot Module Replacement (HMR)

Changes to `.tsx`, `.ts`, and `.css` files will hot reload automatically.

### Type Safety

The project uses strict TypeScript. Fix any type errors before committing:

```bash
pnpm build  # This runs type checking
```

### Code Formatting

Format code before committing:

```bash
pnpm format
```

### Component Development

1. Create components in `src/components/`
2. Use HeroUI components for consistency
3. Add TypeScript types for all props
4. Use Tailwind for styling

### API Integration

1. Define types in `src/types/api.ts`
2. Add API methods to `src/lib/api-client.ts`
3. Create hooks in `src/hooks/`
4. Use TanStack Query for caching

## Next Steps

1. ✅ Install dependencies (`pnpm install`)
2. ✅ Start dev server (`pnpm dev`)
3. 🔗 Ensure backend is running
4. 🎨 Start developing!

For more information, see [README.md](./README.md).

