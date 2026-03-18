/**
 * Mock Data Generators for Frontend Development
 * 
 * These utilities generate realistic mock data for the new backend APIs
 * while the backend implementation is in progress.
 */

import {
  CoroutineState,
} from '@/types/api'
import type {
  HierarchyNode,
  HierarchyNodeTree,
  ThreadActivityResponse,
  ThreadLaneData,
  ThreadSegment,
  DispatcherInfo,
  CoroutineTimeline,
  TimelineEvent,
  SuspensionPoint,
} from '@/types/api'

// ============================================================================
// HIERARCHY MOCK DATA
// ============================================================================

export function generateMockHierarchyNode(
  id: string,
  parentId: string | null,
  state: CoroutineState = CoroutineState.COMPLETED,
  options?: {
    name?: string
    scopeId?: string
    childCount?: number
    dispatcherName?: string
  }
): HierarchyNode {
  const now = Date.now() * 1_000_000  // Convert to nanos
  const duration = Math.random() * 1000 * 1_000_000  // 0-1000ms
  
  return {
    id,
    parentId,
    children: options?.childCount 
      ? Array.from({ length: options.childCount }, (_, i) => `${id}-child-${i}`)
      : [],
    name: options?.name || `coroutine-${id}`,
    scopeId: options?.scopeId || 'scope-root',
    state,
    createdAtNanos: now,
    completedAtNanos: state === CoroutineState.COMPLETED || state === CoroutineState.FAILED || state === CoroutineState.CANCELLED
      ? now + duration
      : null,
    currentThreadId: state === CoroutineState.ACTIVE ? Math.floor(Math.random() * 4) + 1 : null,
    currentThreadName: state === CoroutineState.ACTIVE ? `DefaultDispatcher-worker-${Math.floor(Math.random() * 4) + 1}` : null,
    dispatcherId: options?.dispatcherName ? `dispatcher-${options.dispatcherName}` : 'dispatcher-Default',
    dispatcherName: options?.dispatcherName || 'Default',
    jobId: `job-${id}`,
    activeTime: duration * 0.7,  // 70% active
    suspendedTime: duration * 0.3,  // 30% suspended
    suspensionPoints: state === CoroutineState.SUSPENDED ? [generateMockSuspensionPoint()] : []
  }
}

export function generateMockHierarchyTree(depth: number = 3, breadth: number = 2): HierarchyNodeTree {
  function buildTree(
    id: string,
    parentId: string | null,
    currentDepth: number,
    maxDepth: number
  ): HierarchyNodeTree {
    const hasChildren = currentDepth < maxDepth
    const childCount = hasChildren ? breadth : 0
    const state: CoroutineState = currentDepth === 0 ? CoroutineState.COMPLETED : (Math.random() > 0.7 ? CoroutineState.ACTIVE : CoroutineState.COMPLETED)
    
    const node = generateMockHierarchyNode(id, parentId, state, {
      name: `${currentDepth === 0 ? 'root' : `level-${currentDepth}`}-${id}`,
      childCount,
      dispatcherName: Math.random() > 0.5 ? 'Default' : 'IO'
    })

    const children = hasChildren
      ? Array.from({ length: childCount }, (_, i) => 
          buildTree(`${id}-${i}`, id, currentDepth + 1, maxDepth)
        )
      : []

    return { ...node, children }
  }

  return buildTree('coro-root', null, 0, depth)
}

// ============================================================================
// SUSPENSION POINT MOCK DATA
// ============================================================================

export function generateMockSuspensionPoint(): SuspensionPoint {
  const reasons = ['delay', 'withContext', 'join', 'await', 'mutex.lock', 'channel.send']
  const functions = [
    'processData',
    'fetchUser',
    'computeResult',
    'handleRequest',
    'syncDatabase'
  ]
  const files = [
    'UserService.kt',
    'DataProcessor.kt',
    'ApiHandler.kt',
    'DatabaseSync.kt'
  ]

  return {
    function: functions[Math.floor(Math.random() * functions.length)] ?? 'unknown',
    fileName: files[Math.floor(Math.random() * files.length)],
    lineNumber: Math.floor(Math.random() * 200) + 10,
    reason: reasons[Math.floor(Math.random() * reasons.length)] ?? 'unknown',
    timestamp: Date.now() * 1_000_000
  }
}

// ============================================================================
// THREAD ACTIVITY MOCK DATA
// ============================================================================

export function generateMockThreadSegment(
  coroutineId: string,
  startNanos: number,
  duration: number = 100_000_000  // 100ms default
): ThreadSegment {
  return {
    coroutineId,
    coroutineName: `coroutine-${coroutineId}`,
    startNanos,
    endNanos: startNanos + duration,
    state: Math.random() > 0.3 ? 'ACTIVE' : 'SUSPENDED'
  }
}

export function generateMockThreadLane(
  threadId: number,
  dispatcherName: string = 'Default',
  segmentCount: number = 5
): ThreadLaneData {
  const baseTime = Date.now() * 1_000_000
  const segments: ThreadSegment[] = []
  
  let currentTime = baseTime
  for (let i = 0; i < segmentCount; i++) {
    const duration = (Math.random() * 200 + 50) * 1_000_000  // 50-250ms
    segments.push(generateMockThreadSegment(`coro-${threadId}-${i}`, currentTime, duration))
    currentTime += duration + (Math.random() * 50 * 1_000_000)  // Add gap
  }

  // Calculate utilization
  const totalTime = currentTime - baseTime
  const activeTime = segments.reduce((sum, seg) => 
    sum + (seg.endNanos ? seg.endNanos - seg.startNanos : 0), 0
  )
  const utilization = activeTime / totalTime

  return {
    threadId,
    threadName: `${dispatcherName}Dispatcher-worker-${threadId}`,
    dispatcherId: `dispatcher-${dispatcherName}`,
    dispatcherName,
    segments,
    utilization
  }
}

export function generateMockThreadActivity(
  threadCount: number = 4,
  segmentsPerThread: number = 5
): ThreadActivityResponse {
  const dispatchers = ['Default', 'IO']
  const threads: ThreadLaneData[] = []
  const dispatcherMap = new Map<string, number[]>()

  for (let i = 1; i <= threadCount; i++) {
    const dispatcherName = dispatchers[i % 2] ?? 'Default'
    threads.push(generateMockThreadLane(i, dispatcherName, segmentsPerThread))

    if (!dispatcherMap.has(dispatcherName)) {
      dispatcherMap.set(dispatcherName, [])
    }
    dispatcherMap.get(dispatcherName)!.push(i)
  }

  const dispatcherInfo: DispatcherInfo[] = Array.from(dispatcherMap.entries()).map(
    ([name, threadIds]) => ({
      id: `dispatcher-${name}`,
      name,
      threadIds,
      queueDepth: Math.floor(Math.random() * 10)
    })
  )

  return {
    threads,
    dispatcherInfo
  }
}

// ============================================================================
// TIMELINE MOCK DATA
// ============================================================================

export function generateMockTimelineEvent(
  seq: number,
  kind: TimelineEvent['kind'],
  baseTime: number
): TimelineEvent {
  const event: TimelineEvent = {
    seq,
    timestamp: baseTime + seq * 10_000_000,  // 10ms between events
    kind,
  }

  if (kind === 'coroutine.started' || kind === 'coroutine.resumed') {
    event.threadId = Math.floor(Math.random() * 4) + 1
    event.threadName = `DefaultDispatcher-worker-${event.threadId}`
    event.dispatcherId = 'dispatcher-Default'
    event.dispatcherName = 'Default'
  }

  if (kind === 'coroutine.suspended') {
    event.suspensionPoint = generateMockSuspensionPoint()
  }

  return event
}

export function generateMockCoroutineTimeline(
  coroutineId: string,
  _eventCount: number = 10
): CoroutineTimeline {
  const baseTime = Date.now() * 1_000_000
  const events: TimelineEvent[] = []
  
  const eventSequence: Array<TimelineEvent['kind']> = [
    'coroutine.created',
    'coroutine.started',
    'coroutine.suspended',
    'coroutine.resumed',
    'coroutine.completed'
  ]

  eventSequence.forEach((kind, i) => {
    events.push(generateMockTimelineEvent(i, kind, baseTime))
  })

  // Add computed durations for suspend/resume pairs
  events.forEach((event, i) => {
    if (event.kind === 'coroutine.resumed' && i > 0) {
      const suspendEvent = events[i - 1]
      if (suspendEvent?.kind === 'coroutine.suspended') {
        event.duration = event.timestamp - suspendEvent.timestamp
      }
    }
  })

  const lastEvent = events[events.length - 1]
  const firstEvent = events[0]
  const totalDuration = lastEvent && firstEvent ? lastEvent.timestamp - firstEvent.timestamp : 0
  const suspendedTime = events
    .filter(e => e.kind === 'coroutine.suspended')
    .reduce((sum, e, i) => {
      const nextEvent = events[i + 1]
      return sum + (nextEvent ? nextEvent.timestamp - e.timestamp : 0)
    }, 0)

  return {
    coroutineId,
    name: `coroutine-${coroutineId}`,
    state: CoroutineState.COMPLETED,
    parentId: null,
    childrenIds: [],
    totalDuration,
    activeTime: totalDuration - suspendedTime,
    suspendedTime,
    events
  }
}

// ============================================================================
// COMPLETE MOCK SCENARIOS
// ============================================================================

/**
 * Generate a complete mock scenario with hierarchy, threads, and timelines
 */
export function generateCompleteScenario(options?: {
  hierarchyDepth?: number
  hierarchyBreadth?: number
  threadCount?: number
  segmentsPerThread?: number
}) {
  const hierarchyTree = generateMockHierarchyTree(
    options?.hierarchyDepth ?? 3,
    options?.hierarchyBreadth ?? 2
  )
  
  const threadActivity = generateMockThreadActivity(
    options?.threadCount ?? 4,
    options?.segmentsPerThread ?? 5
  )

  // Flatten hierarchy to get all coroutine IDs
  const allCoroutines: HierarchyNode[] = []
  function flattenTree(node: HierarchyNodeTree) {
    allCoroutines.push(node)
    node.children.forEach(flattenTree)
  }
  flattenTree(hierarchyTree)

  // Generate timeline for first few coroutines
  const timelines = allCoroutines.slice(0, 3).map(node =>
    generateMockCoroutineTimeline(node.id, 10)
  )

  return {
    hierarchy: hierarchyTree,
    hierarchyFlat: allCoroutines,
    threadActivity,
    timelines
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Convert flat hierarchy list to tree structure
 */
export function hierarchyListToTree(nodes: HierarchyNode[]): HierarchyNodeTree[] {
  const nodeMap = new Map<string, HierarchyNodeTree>()
  
  // Create map with empty children arrays
  nodes.forEach(node => {
    nodeMap.set(node.id, { ...node, children: [] })
  })

  // Build tree structure
  const roots: HierarchyNodeTree[] = []
  nodes.forEach(node => {
    const treeNode = nodeMap.get(node.id)!
    if (node.parentId && nodeMap.has(node.parentId)) {
      nodeMap.get(node.parentId)!.children.push(treeNode)
    } else {
      roots.push(treeNode)
    }
  })

  return roots
}

/**
 * Flatten tree structure to list
 */
export function hierarchyTreeToList(tree: HierarchyNodeTree | HierarchyNodeTree[]): HierarchyNode[] {
  const result: HierarchyNode[] = []
  const trees = Array.isArray(tree) ? tree : [tree]

  function traverse(node: HierarchyNodeTree) {
    const { children, ...nodeData } = node
    result.push({
      ...nodeData,
      children: children.map(c => c.id)
    })
    children.forEach(traverse)
  }

  trees.forEach(traverse)
  return result
}

