/**
 * React Query hooks for Hierarchy API
 * 
 * Provides access to the coroutine hierarchy tree with enhanced metadata
 * including dispatcher information and suspension points.
 */

import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { useMemo } from 'react'
import type { HierarchyNode } from '@/types/api'

/**
 * Fetch hierarchy for a session
 * @param sessionId - The session ID
 * @param scopeId - Optional scope ID to filter by
 */
export function useHierarchy(sessionId: string | undefined, scopeId?: string) {
  return useQuery({
    queryKey: ['sessions', sessionId, 'hierarchy', scopeId],
    queryFn: () => apiClient.getHierarchy(sessionId!, scopeId),
    enabled: !!sessionId,
    // Refetch when window gains focus to catch updates
    refetchOnWindowFocus: true,
    // Keep data fresh
    staleTime: 5000, // 5 seconds
  })
}

/**
 * Build a tree structure from flat hierarchy list
 * Useful for tree visualization components
 */
export function useHierarchyTree(sessionId: string | undefined, scopeId?: string) {
  const { data: nodes, ...query } = useHierarchy(sessionId, scopeId)

  const tree = useMemo(() => {
    if (!nodes || nodes.length === 0) return []

    const nodeMap = new Map(nodes.map(n => [n.id, { ...n, children: [] as typeof nodes }]))
    const roots: typeof nodes = []

    nodes.forEach(node => {
      const treeNode = nodeMap.get(node.id)
      if (!treeNode) return

      if (node.parentId && nodeMap.has(node.parentId)) {
        const parent = nodeMap.get(node.parentId)
        if (parent) {
          parent.children.push(treeNode)
        }
      } else {
        roots.push(treeNode)
      }
    })

    return roots
  }, [nodes])

  return {
    ...query,
    data: tree,
    flatData: nodes
  }
}

/**
 * Get statistics about the hierarchy
 */
export function useHierarchyStats(sessionId: string | undefined) {
  const { data: nodes } = useHierarchy(sessionId)

  const stats = useMemo(() => {
    if (!nodes || nodes.length === 0) {
      return {
        total: 0,
        byState: {} as Record<string, number>,
        byDispatcher: {} as Record<string, number>,
        maxDepth: 0,
        avgActiveTime: 0,
        avgSuspendedTime: 0
      }
    }

    const byState: Record<string, number> = {}
    const byDispatcher: Record<string, number> = {}
    let totalActiveTime = 0
    let totalSuspendedTime = 0
    let countWithTime = 0

    // Calculate depth for each node
    const depths = new Map<string, number>()
    function calculateDepth(node: HierarchyNode): number {
      if (depths.has(node.id)) return depths.get(node.id)!
      
      if (!node.parentId) {
        depths.set(node.id, 0)
        return 0
      }

      const parent = nodes.find(n => n.id === node.parentId)
      const depth = parent ? calculateDepth(parent) + 1 : 0
      depths.set(node.id, depth)
      return depth
    }

    nodes.forEach(node => {
      // Count by state
      byState[node.state] = (byState[node.state] || 0) + 1

      // Count by dispatcher
      if (node.dispatcherName) {
        byDispatcher[node.dispatcherName] = (byDispatcher[node.dispatcherName] || 0) + 1
      }

      // Accumulate time metrics
      if (node.activeTime !== undefined && node.suspendedTime !== undefined) {
        totalActiveTime += node.activeTime
        totalSuspendedTime += node.suspendedTime
        countWithTime++
      }

      // Calculate depth
      calculateDepth(node)
    })

    const maxDepth = Math.max(...Array.from(depths.values()), 0)

    return {
      total: nodes.length,
      byState,
      byDispatcher,
      maxDepth,
      avgActiveTime: countWithTime > 0 ? totalActiveTime / countWithTime : 0,
      avgSuspendedTime: countWithTime > 0 ? totalSuspendedTime / countWithTime : 0
    }
  }, [nodes])

  return stats
}

/**
 * Find a specific coroutine in the hierarchy
 */
export function useCoroutineInHierarchy(sessionId: string | undefined, coroutineId: string | undefined) {
  const { data: nodes } = useHierarchy(sessionId)

  const coroutine = useMemo(() => {
    if (!nodes || !coroutineId) return null
    return nodes.find(n => n.id === coroutineId) || null
  }, [nodes, coroutineId])

  const parent = useMemo(() => {
    if (!nodes || !coroutine?.parentId) return null
    return nodes.find(n => n.id === coroutine.parentId) || null
  }, [nodes, coroutine])

  const children = useMemo(() => {
    if (!nodes || !coroutine) return []
    return nodes.filter(n => n.parentId === coroutine.id)
  }, [nodes, coroutine])

  const siblings = useMemo(() => {
    if (!nodes || !coroutine) return []
    return nodes.filter(n => n.parentId === coroutine.parentId && n.id !== coroutine.id)
  }, [nodes, coroutine])

  return {
    coroutine,
    parent,
    children,
    siblings,
    hasParent: !!parent,
    hasChildren: children.length > 0,
    hasSiblings: siblings.length > 0
  }
}

