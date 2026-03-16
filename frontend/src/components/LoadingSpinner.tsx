import { Spinner } from '@heroui/react'

interface LoadingSpinnerProps {
  label?: string
}

export function LoadingSpinner({ label = 'Loading...' }: LoadingSpinnerProps) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-4">
      <Spinner size="lg" color="primary" />
      {label && <p className="text-default-500">{label}</p>}
    </div>
  )
}

