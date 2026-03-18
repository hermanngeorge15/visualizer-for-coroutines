import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { createElement } from 'react'
import { useThreadActivity, useThreadUtilizationStats } from './use-thread-activity'
import { apiClient } from '@/lib/api-client'
import type { ThreadActivityResponse, ThreadLaneData, DispatcherInfo } from '@/types/api'

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    getThreadActivity: vi.fn(),
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
    },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

function makeThreadLane(overrides: Partial<ThreadLaneData> & { threadId: number }): ThreadLaneData {
  return {
    threadName: `thread-${overrides.threadId}`,
    dispatcherId: null,
    dispatcherName: null,
    segments: [],
    utilization: 0,
    ...overrides,
  }
}

function makeDispatcherInfo(overrides: Partial<DispatcherInfo> & { id: string; name: string }): DispatcherInfo {
  return {
    threadIds: [],
    queueDepth: null,
    ...overrides,
  }
}

function makeActivity(
  threads: ThreadLaneData[],
  dispatchers: DispatcherInfo[]
): ThreadActivityResponse {
  return {
    threads,
    dispatcherInfo: dispatchers,
  }
}

describe('useThreadActivity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches thread data', async () => {
    const mockActivity = makeActivity(
      [makeThreadLane({ threadId: 1, utilization: 0.8 })],
      [makeDispatcherInfo({ id: 'd1', name: 'Default', threadIds: [1] })]
    )
    mockedApiClient.getThreadActivity.mockResolvedValue(mockActivity)

    const { result } = renderHook(
      () => useThreadActivity('session-1'),
      { wrapper: createWrapper() }
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(mockActivity)
    expect(mockedApiClient.getThreadActivity).toHaveBeenCalledWith('session-1')
  })

  it('does not fetch when sessionId is undefined', () => {
    const { result } = renderHook(
      () => useThreadActivity(undefined),
      { wrapper: createWrapper() }
    )

    expect(result.current.isFetching).toBe(false)
    expect(mockedApiClient.getThreadActivity).not.toHaveBeenCalled()
  })
})

describe('useThreadUtilizationStats', () => {
  it('returns zeros for undefined activity', () => {
    const { result } = renderHook(() => useThreadUtilizationStats(undefined))

    expect(result.current).toEqual({
      avgUtilization: 0,
      maxUtilization: 0,
      minUtilization: 0,
      byDispatcher: new Map(),
    })
  })

  it('returns zeros for activity with empty threads', () => {
    const activity = makeActivity([], [])

    const { result } = renderHook(() => useThreadUtilizationStats(activity))

    expect(result.current).toEqual({
      avgUtilization: 0,
      maxUtilization: 0,
      minUtilization: 0,
      byDispatcher: new Map(),
    })
  })

  it('calculates min/max/avg utilization', () => {
    const activity = makeActivity(
      [
        makeThreadLane({ threadId: 1, utilization: 0.2 }),
        makeThreadLane({ threadId: 2, utilization: 0.6 }),
        makeThreadLane({ threadId: 3, utilization: 0.8 }),
      ],
      []
    )

    const { result } = renderHook(() => useThreadUtilizationStats(activity))

    expect(result.current.minUtilization).toBeCloseTo(0.2)
    expect(result.current.maxUtilization).toBeCloseTo(0.8)
    // avg = (0.2 + 0.6 + 0.8) / 3 ≈ 0.5333
    expect(result.current.avgUtilization).toBeCloseTo(0.5333, 3)
  })

  it('groups by dispatcher', () => {
    const activity = makeActivity(
      [
        makeThreadLane({ threadId: 1, dispatcherId: 'd1', utilization: 0.4 }),
        makeThreadLane({ threadId: 2, dispatcherId: 'd1', utilization: 0.6 }),
        makeThreadLane({ threadId: 3, dispatcherId: 'd2', utilization: 0.9 }),
      ],
      [
        makeDispatcherInfo({ id: 'd1', name: 'Default', threadIds: [1, 2] }),
        makeDispatcherInfo({ id: 'd2', name: 'IO', threadIds: [3] }),
      ]
    )

    const { result } = renderHook(() => useThreadUtilizationStats(activity))

    // Default dispatcher: avg of threads with dispatcherId === 'd1' -> (0.4 + 0.6) / 2 = 0.5
    expect(result.current.byDispatcher.get('Default')).toBeCloseTo(0.5)
    // IO dispatcher: avg of threads with dispatcherId === 'd2' -> 0.9 / 1 = 0.9
    expect(result.current.byDispatcher.get('IO')).toBeCloseTo(0.9)
    expect(result.current.byDispatcher.size).toBe(2)
  })

  it('handles single thread', () => {
    const activity = makeActivity(
      [makeThreadLane({ threadId: 1, utilization: 0.75 })],
      []
    )

    const { result } = renderHook(() => useThreadUtilizationStats(activity))

    expect(result.current.avgUtilization).toBe(0.75)
    expect(result.current.minUtilization).toBe(0.75)
    expect(result.current.maxUtilization).toBe(0.75)
  })
})
