import { useState, useEffect, useCallback } from 'react'
import {
  HierarchyNode,
  VizEvent,
  WaitingForChildrenEvent,
  JobStateChangedEvent,
  ThreadAssignedEvent,
  DispatcherSelectedEvent,
  CoroutineState
} from '../types/api'

/**
 * Enhanced hierarchy hook that handles job status updates
 * including waiting-for-children states
 */
export function useEnhancedHierarchy(
  events: VizEvent[],
  initialNodes: HierarchyNode[] = []
) {
  const [nodes, setNodes] = useState<Map<string, HierarchyNode>>(
    new Map(initialNodes.map(node => [node.id, node]))
  )

  // Update hierarchy based on events
  const handleEvent = useCallback((event: VizEvent) => {
    setNodes(prev => {
      const newNodes = new Map(prev)

      switch (event.kind) {
        case 'coroutine.created': {
          const newNode: HierarchyNode = {
            id: event.coroutineId,
            parentId: event.parentCoroutineId,
            children: [],
            name: event.label || event.coroutineId,
            scopeId: event.scopeId,
            state: 'CREATED' as CoroutineState,
            createdAtNanos: event.tsNanos,
            jobId: event.jobId,
            activeChildrenIds: [],
            activeChildrenCount: 0,
          }
          newNodes.set(event.coroutineId, newNode)

          // Add to parent's children
          if (event.parentCoroutineId) {
            const parent = newNodes.get(event.parentCoroutineId)
            if (parent && !parent.children.includes(event.coroutineId)) {
              newNodes.set(event.parentCoroutineId, {
                ...parent,
                children: [...parent.children, event.coroutineId],
              })
            }
          }
          break
        }

        case 'coroutine.started': {
          const node = newNodes.get(event.coroutineId)
          if (node) {
            newNodes.set(event.coroutineId, {
              ...node,
              state: 'ACTIVE' as CoroutineState,
            })
          }
          break
        }

        case 'coroutine.suspended': {
          const node = newNodes.get(event.coroutineId)
          if (node) {
            newNodes.set(event.coroutineId, {
              ...node,
              state: 'SUSPENDED' as CoroutineState,
            })
          }
          break
        }

        case 'coroutine.resumed': {
          const node = newNodes.get(event.coroutineId)
          if (node) {
            newNodes.set(event.coroutineId, {
              ...node,
              state: 'ACTIVE' as CoroutineState,
            })
          }
          break
        }

        case 'coroutine.body-completed': {
          const node = newNodes.get(event.coroutineId)
          if (node) {
            // Check if has active children
            const hasActiveChildren = node.children.some(childId => {
              const child = newNodes.get(childId)
              return child && ['ACTIVE', 'SUSPENDED', 'CREATED'].includes(child.state)
            })

            newNodes.set(event.coroutineId, {
              ...node,
              state: hasActiveChildren 
                ? ('WAITING_FOR_CHILDREN' as CoroutineState)
                : node.state, // Keep current state if no children
            })
          }
          break
        }

        case 'WaitingForChildren': {
          const waitingEvent = event as WaitingForChildrenEvent
          const node = newNodes.get(waitingEvent.coroutineId)
          if (node) {
            newNodes.set(waitingEvent.coroutineId, {
              ...node,
              state: 'WAITING_FOR_CHILDREN' as CoroutineState,
              activeChildrenIds: waitingEvent.activeChildrenIds,
              activeChildrenCount: waitingEvent.activeChildrenCount,
            })
          }
          break
        }

        case 'JobStateChanged': {
          const jobEvent = event as JobStateChangedEvent
          const node = newNodes.get(jobEvent.coroutineId)
          if (node) {
            // Update state based on job properties
            let newState: CoroutineState = node.state
            
            if (jobEvent.isCancelled) {
              newState = 'CANCELLED' as CoroutineState
            } else if (jobEvent.isCompleted) {
              newState = 'COMPLETED' as CoroutineState
            } else if (!jobEvent.isActive && jobEvent.childrenCount > 0) {
              newState = 'WAITING_FOR_CHILDREN' as CoroutineState
            } else if (jobEvent.isActive) {
              newState = 'ACTIVE' as CoroutineState
            }

            newNodes.set(jobEvent.coroutineId, {
              ...node,
              state: newState,
              // Update children count if waiting
              activeChildrenCount: newState === 'WAITING_FOR_CHILDREN' 
                ? jobEvent.childrenCount 
                : node.activeChildrenCount,
            })
          }
          break
        }

        case 'coroutine.completed': {
          const node = newNodes.get(event.coroutineId)
          if (node) {
            newNodes.set(event.coroutineId, {
              ...node,
              state: 'COMPLETED' as CoroutineState,
              completedAtNanos: event.tsNanos,
              activeChildrenCount: 0,
              activeChildrenIds: [],
            })
          }
          break
        }

        case 'coroutine.cancelled': {
          const node = newNodes.get(event.coroutineId)
          if (node) {
            newNodes.set(event.coroutineId, {
              ...node,
              state: 'CANCELLED' as CoroutineState,
              completedAtNanos: event.tsNanos,
              activeChildrenCount: 0,
              activeChildrenIds: [],
            })
          }
          break
        }

        case 'coroutine.failed': {
          const node = newNodes.get(event.coroutineId)
          if (node) {
            newNodes.set(event.coroutineId, {
              ...node,
              state: 'FAILED' as CoroutineState,
              completedAtNanos: event.tsNanos,
              activeChildrenCount: 0,
              activeChildrenIds: [],
            })
          }
          break
        }

        case 'thread.assigned': {
          const threadEvent = event as ThreadAssignedEvent
          const node = newNodes.get(event.coroutineId)
          if (node) {
            newNodes.set(event.coroutineId, {
              ...node,
              currentThreadId: threadEvent.threadId,
              currentThreadName: threadEvent.threadName,
            })
          }
          break
        }

        case 'DispatcherSelected': {
          const dispatcherEvent = event as DispatcherSelectedEvent
          const node = newNodes.get(event.coroutineId)
          if (node) {
            newNodes.set(event.coroutineId, {
              ...node,
              dispatcherId: dispatcherEvent.dispatcherId,
              dispatcherName: dispatcherEvent.dispatcherName,
            })
          }
          break
        }
      }

      return newNodes
    })
  }, [])

  // Process events
  useEffect(() => {
    events.forEach(handleEvent)
  }, [events, handleEvent])

  // Get root nodes (nodes without parents)
  const getRootNodes = useCallback(() => {
    return Array.from(nodes.values()).filter(node => !node.parentId)
  }, [nodes])

  // Get children of a node
  const getChildren = useCallback((nodeId: string): HierarchyNode[] => {
    const node = nodes.get(nodeId)
    if (!node) return []
    
    return node.children
      .map(childId => nodes.get(childId))
      .filter((child): child is HierarchyNode => child !== undefined)
  }, [nodes])

  // Get active children count
  const getActiveChildrenCount = useCallback((nodeId: string): number => {
    const children = getChildren(nodeId)
    return children.filter(child => 
      ['ACTIVE', 'SUSPENDED', 'CREATED', 'WAITING_FOR_CHILDREN'].includes(child.state)
    ).length
  }, [getChildren])

  // Check if node is waiting for children
  const isWaitingForChildren = useCallback((nodeId: string): boolean => {
    const node = nodes.get(nodeId)
    return node?.state === 'WAITING_FOR_CHILDREN'
  }, [nodes])

  return {
    nodes,
    nodesArray: Array.from(nodes.values()),
    getRootNodes,
    getChildren,
    getActiveChildrenCount,
    isWaitingForChildren,
    getNode: (id: string) => nodes.get(id),
  }
}

