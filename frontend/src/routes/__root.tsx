import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { Card, CardBody } from '@heroui/react'

interface RouterContext {
  queryClient: QueryClient
}

function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="max-w-md">
        <CardBody className="text-center">
          <h1 className="mb-2 text-4xl font-bold">404</h1>
          <p className="mb-4 text-default-600">Page not found</p>
          <a href="/" className="text-primary hover:underline">
            Go back home
          </a>
        </CardBody>
      </Card>
    </div>
  )
}

function ErrorComponent({ error }: { error: Error }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="max-w-md border-danger">
        <CardBody className="text-center">
          <h1 className="mb-2 text-2xl font-bold text-danger">Error</h1>
          <p className="mb-4 text-default-600">{error.message}</p>
          <a href="/" className="text-primary hover:underline">
            Go back home
          </a>
        </CardBody>
      </Card>
    </div>
  )
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
  notFoundComponent: NotFound,
  errorComponent: ErrorComponent,
})

function RootComponent() {
  return (
    <>
      <Outlet />
      {import.meta.env.DEV && <TanStackRouterDevtools position="bottom-right" />}
    </>
  )
}

