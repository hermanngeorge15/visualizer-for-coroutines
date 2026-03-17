import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ValidationPanel } from './ValidationPanel'
import {
  ValidationPassCard,
  ValidationErrorCard,
  ValidationWarningCard,
} from './ValidationResultCard'
import { TimingReportView } from './TimingReportView'
import { apiClient } from '@/lib/api-client'
import type { ValidationResult, ValidationError, ValidationWarning, TimingReport } from '@/types/api'

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    validateSession: vi.fn(),
    getSessionEvents: vi.fn(),
  },
}))

const mockedApiClient = vi.mocked(apiClient)

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    )
  }
}

describe('ValidationPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders empty state with run button initially', () => {
    render(<ValidationPanel sessionId="session-1" />, {
      wrapper: createWrapper(),
    })

    expect(screen.getByTestId('validation-panel')).toBeInTheDocument()
    expect(screen.getByTestId('run-validation-btn')).toBeInTheDocument()
    expect(screen.getByTestId('validation-empty')).toBeInTheDocument()
  })

  it('calls validation API when button is clicked', async () => {
    const result: ValidationResult = {
      sessionId: 'session-1',
      valid: true,
      errors: [],
      warnings: [],
      timing: {
        totalDurationNanos: 1_000_000_000,
        eventCount: 50,
        coroutineCount: 5,
        avgEventIntervalNanos: 20_000_000,
        maxGapNanos: 100_000_000,
        suspendResumeLatencies: [],
      },
    }

    mockedApiClient.validateSession.mockResolvedValue(result)

    render(<ValidationPanel sessionId="session-1" />, {
      wrapper: createWrapper(),
    })

    const button = screen.getByTestId('run-validation-btn')
    fireEvent.click(button)

    await waitFor(() => {
      expect(mockedApiClient.validateSession).toHaveBeenCalledWith('session-1')
    })

    // Should show pass summary
    await waitFor(() => {
      expect(screen.getByTestId('validation-summary')).toBeInTheDocument()
    })
    expect(screen.getByText('Validation Passed')).toBeInTheDocument()
  })

  it('shows error state when validation API fails', async () => {
    mockedApiClient.validateSession.mockRejectedValue(new Error('Server error'))

    render(<ValidationPanel sessionId="session-1" />, {
      wrapper: createWrapper(),
    })

    fireEvent.click(screen.getByTestId('run-validation-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('validation-error')).toBeInTheDocument()
    })
    expect(screen.getByText(/Server error/)).toBeInTheDocument()
  })
})

describe('ValidationPassCard', () => {
  it('renders pass state with green check', () => {
    render(<ValidationPassCard valid={true} errorCount={0} warningCount={0} />)
    expect(screen.getByTestId('validation-summary')).toBeInTheDocument()
    expect(screen.getByText('Validation Passed')).toBeInTheDocument()
  })

  it('renders fail state with error count', () => {
    render(<ValidationPassCard valid={false} errorCount={3} warningCount={1} />)
    expect(screen.getByTestId('validation-summary')).toBeInTheDocument()
    expect(screen.getByText('Validation Failed')).toBeInTheDocument()
    expect(screen.getByText(/3 errors/)).toBeInTheDocument()
  })
})

describe('ValidationErrorCard', () => {
  it('renders error with code and message', () => {
    const error: ValidationError = {
      code: 'INVALID_ORDER',
      message: 'Event 5 arrived before event 4',
      eventSeq: 5,
      coroutineId: 'c1',
    }

    render(<ValidationErrorCard error={error} />)
    expect(screen.getByTestId('validation-error-card')).toBeInTheDocument()
    expect(screen.getByText('INVALID_ORDER')).toBeInTheDocument()
    expect(screen.getByText('Event 5 arrived before event 4')).toBeInTheDocument()
  })
})

describe('ValidationWarningCard', () => {
  it('renders warning with suggestion', () => {
    const warning: ValidationWarning = {
      code: 'SLOW_SUSPEND',
      message: 'Coroutine c1 was suspended for over 5s',
      suggestion: 'Consider adding a timeout',
      coroutineId: 'c1',
    }

    render(<ValidationWarningCard warning={warning} />)
    expect(screen.getByTestId('validation-warning-card')).toBeInTheDocument()
    expect(screen.getByText('SLOW_SUSPEND')).toBeInTheDocument()
    expect(screen.getByText('Consider adding a timeout')).toBeInTheDocument()
  })
})

describe('TimingReportView', () => {
  it('renders timing metrics and latency buckets', () => {
    const timing: TimingReport = {
      totalDurationNanos: 2_500_000_000,
      eventCount: 100,
      coroutineCount: 10,
      avgEventIntervalNanos: 25_000_000,
      maxGapNanos: 500_000_000,
      suspendResumeLatencies: [
        { label: '0-1ms', minNanos: 0, maxNanos: 1_000_000, count: 30 },
        { label: '1-10ms', minNanos: 1_000_000, maxNanos: 10_000_000, count: 50 },
        { label: '10-100ms', minNanos: 10_000_000, maxNanos: 100_000_000, count: 15 },
        { label: '100ms+', minNanos: 100_000_000, maxNanos: 999_000_000, count: 5 },
      ],
    }

    render(<TimingReportView timing={timing} />)
    expect(screen.getByTestId('timing-report')).toBeInTheDocument()
    expect(screen.getByText('100')).toBeInTheDocument() // event count
    expect(screen.getByText('10')).toBeInTheDocument() // coroutine count
    // Latency buckets
    const buckets = screen.getAllByTestId('latency-bucket')
    expect(buckets).toHaveLength(4)
  })
})
