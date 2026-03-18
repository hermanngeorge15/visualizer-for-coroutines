import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { createElement } from 'react'
import { useHierarchy, useHierarchyTree, useHierarchyStats } from './use-hierarchy'
import { apiClient } from '@/lib/api-client'
import type { HierarchyNode } from '@/types/api'
import { CoroutineState } from '@/types/api'

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    getHierarchy: vi.fn(),
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

function createMockNode(overrides: Partial<HierarchyNode> & { id: string }): HierarchyNode {
  return {
    parentId: null,
    children: [],
    name: `coroutine-${overrides.id}`,
    scopeId: 'scope-1',
    state: CoroutineState.ACTIVE,
    createdAtNanos: Date.now() * 1_000_000,
    jobId: `job-${overrides.id}`,
    ...overrides,
  }
}

describe('useHierarchy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches hierarchy data for a session', async () => {
    const nodes: HierarchyNode[] = [
      createMockNode({ id: 'c1' }),
      createMockNode({ id: 'c2', parentId: 'c1' }),
    ]
    mockedApiClient.getHierarchy.mockResolvedValue(nodes)

    const { result } = renderHook(
      () => useHierarchy('session-1'),
      { wrapper: createWrapper() }
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(nodes)
    expect(mockedApiClient.getHierarchy).toHaveBeenCalledWith('session-1', undefined)
  })

  it('does not fetch when sessionId is undefined', () => {
    const { result } = renderHook(
      () => useHierarchy(undefined),
      { wrapper: createWrapper() }
    )

    expect(result.current.isFetching).toBe(false)
    expect(mockedApiClient.getHierarchy).not.toHaveBeenCalled()
  })

  it('passes scopeId to API call', async () => {
    mockedApiClient.getHierarchy.mockResolvedValue([])

    const { result } = renderHook(
      () => useHierarchy('session-1', 'scope-abc'),
      { wrapper: createWrapper() }
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockedApiClient.getHierarchy).toHaveBeenCalledWith('session-1', 'scope-abc')
  })
})

describe('useHierarchyTree', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('builds tree structure from flat list', async () => {
    const nodes: HierarchyNode[] = [
      createMockNode({ id: 'root', children: ['c1', 'c2'] }),
      createMockNode({ id: 'c1', parentId: 'root', children: ['c3'] }),
      createMockNode({ id: 'c2', parentId: 'root', children: [] }),
      createMockNode({ id: 'c3', parentId: 'c1', children: [] }),
    ]
    mockedApiClient.getHierarchy.mockResolvedValue(nodes)

    const { result } = renderHook(
      () => useHierarchyTree('session-1'),
      { wrapper: createWrapper() }
    )

    await waitFor(() => expect(result.current.data.length).toBeGreaterThan(0))

    // Root should be the only top-level node
    expect(result.current.data).toHaveLength(1)
    const root = result.current.data[0]!
    expect(root.id).toBe('root')

    // Root should have 2 children
    expect(root.children).toHaveLength(2)
    const rootChildren = root.children as HierarchyNode[]
    expect(rootChildren.map((c: HierarchyNode) => c.id)).toContain('c1')
    expect(rootChildren.map((c: HierarchyNode) => c.id)).toContain('c2')

    // c1 should have 1 child (c3)
    const c1 = rootChildren.find((c: HierarchyNode) => c.id === 'c1')
    expect(c1?.children).toHaveLength(1)
    expect((c1?.children as HierarchyNode[] | undefined)?.[0]?.id).toBe('c3')
  })

  it('returns empty array when no nodes', async () => {
    mockedApiClient.getHierarchy.mockResolvedValue([])

    const { result } = renderHook(
      () => useHierarchyTree('session-1'),
      { wrapper: createWrapper() }
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual([])
  })

  it('provides flatData alongside tree data', async () => {
    const nodes: HierarchyNode[] = [
      createMockNode({ id: 'root' }),
      createMockNode({ id: 'c1', parentId: 'root' }),
    ]
    mockedApiClient.getHierarchy.mockResolvedValue(nodes)

    const { result } = renderHook(
      () => useHierarchyTree('session-1'),
      { wrapper: createWrapper() }
    )

    await waitFor(() => expect(result.current.data.length).toBeGreaterThan(0))

    expect(result.current.flatData).toEqual(nodes)
  })
})

describe('useHierarchyStats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calculates stats from hierarchy nodes', async () => {
    const nodes: HierarchyNode[] = [
      createMockNode({
        id: 'root',
        state: CoroutineState.ACTIVE,
        dispatcherName: 'Default',
        activeTime: 100_000_000,
        suspendedTime: 50_000_000,
        children: ['c1', 'c2'],
      }),
      createMockNode({
        id: 'c1',
        parentId: 'root',
        state: CoroutineState.SUSPENDED,
        dispatcherName: 'IO',
        activeTime: 80_000_000,
        suspendedTime: 120_000_000,
        children: [],
      }),
      createMockNode({
        id: 'c2',
        parentId: 'root',
        state: CoroutineState.COMPLETED,
        dispatcherName: 'Default',
        activeTime: 60_000_000,
        suspendedTime: 40_000_000,
        children: [],
      }),
    ]
    mockedApiClient.getHierarchy.mockResolvedValue(nodes)

    const { result } = renderHook(
      () => useHierarchyStats('session-1'),
      { wrapper: createWrapper() }
    )

    await waitFor(() => expect(result.current.total).toBe(3))

    expect(result.current.byState).toEqual({
      ACTIVE: 1,
      SUSPENDED: 1,
      COMPLETED: 1,
    })
    expect(result.current.byDispatcher).toEqual({
      Default: 2,
      IO: 1,
    })
    expect(result.current.maxDepth).toBe(1)
    expect(result.current.avgActiveTime).toBe(80_000_000)
    expect(result.current.avgSuspendedTime).toBe(70_000_000)
  })

  it('returns zeroed stats when no nodes', async () => {
    mockedApiClient.getHierarchy.mockResolvedValue([])

    const { result } = renderHook(
      () => useHierarchyStats('session-1'),
      { wrapper: createWrapper() }
    )

    await waitFor(() => expect(result.current.total).toBe(0))

    expect(result.current.byState).toEqual({})
    expect(result.current.byDispatcher).toEqual({})
    expect(result.current.maxDepth).toBe(0)
    expect(result.current.avgActiveTime).toBe(0)
    expect(result.current.avgSuspendedTime).toBe(0)
  })

  it('calculates maxDepth correctly for deeper trees', async () => {
    const nodes: HierarchyNode[] = [
      createMockNode({ id: 'root', children: ['c1'] }),
      createMockNode({ id: 'c1', parentId: 'root', children: ['c2'] }),
      createMockNode({ id: 'c2', parentId: 'c1', children: ['c3'] }),
      createMockNode({ id: 'c3', parentId: 'c2', children: [] }),
    ]
    mockedApiClient.getHierarchy.mockResolvedValue(nodes)

    const { result } = renderHook(
      () => useHierarchyStats('session-1'),
      { wrapper: createWrapper() }
    )

    await waitFor(() => expect(result.current.total).toBe(4))

    expect(result.current.maxDepth).toBe(3)
  })
})
