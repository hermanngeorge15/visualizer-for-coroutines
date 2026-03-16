import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { VizEventKind, VizEvent } from '@/types/api'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Map backend event type (PascalCase) to frontend kind (kebab-case with prefix)
 * Backend: CoroutineCreated, CoroutineStarted, ThreadAssigned, etc.
 * Frontend: coroutine.created, coroutine.started, thread.assigned, etc.
 */
const EVENT_TYPE_TO_KIND: Record<string, VizEventKind> = {
  'CoroutineCreated': 'coroutine.created',
  'CoroutineStarted': 'coroutine.started',
  'CoroutineSuspended': 'coroutine.suspended',
  'CoroutineResumed': 'coroutine.resumed',
  'CoroutineBodyCompleted': 'coroutine.body-completed',
  'CoroutineCompleted': 'coroutine.completed',
  'CoroutineCancelled': 'coroutine.cancelled',
  'CoroutineFailed': 'coroutine.failed',
  'ThreadAssigned': 'thread.assigned',
  'DispatcherSelected': 'DispatcherSelected',
  'DeferredValueAvailable': 'DeferredValueAvailable',
  'DeferredAwaitStarted': 'DeferredAwaitStarted',
  'DeferredAwaitCompleted': 'DeferredAwaitCompleted',
  'JobStateChanged': 'JobStateChanged',
  'JobCancellationRequested': 'JobCancellationRequested',
  'JobJoinRequested': 'JobJoinRequested',
  'JobJoinCompleted': 'JobJoinCompleted',
}

/**
 * Convert backend event type to frontend kind
 */
export function eventTypeToKind(type: string): VizEventKind {
  return EVENT_TYPE_TO_KIND[type] || type as VizEventKind
}

/**
 * Normalize an event from the backend API format to frontend format
 * Handles the `type` -> `kind` property mapping
 */
export function normalizeEvent(event: any): VizEvent {
  // If event already has `kind`, return as-is
  if (event.kind) {
    return event as VizEvent
  }
  
  // Map `type` to `kind`
  if (event.type) {
    const normalized = { ...event }
    normalized.kind = eventTypeToKind(event.type)
    delete normalized.type
    return normalized as VizEvent
  }
  
  return event as VizEvent
}

/**
 * Normalize an array of events
 */
export function normalizeEvents(events: any[]): VizEvent[] {
  return events.map(normalizeEvent)
}

export function formatNanoTime(nanos: number): string {
  const ms = nanos / 1_000_000
  if (ms < 1000) {
    return `${ms.toFixed(2)}ms`
  }
  return `${(ms / 1000).toFixed(2)}s`
}

export function formatRelativeTime(nanos: number, baseNanos: number): string {
  const deltaMs = (nanos - baseNanos) / 1_000_000
  return `+${deltaMs.toFixed(2)}ms`
}

export function buildCoroutineTree(nodes: Array<{ id: string; parentId: string | null }>) {
  const nodeMap = new Map(nodes.map(n => [n.id, { ...n, children: [] as typeof nodes }]))
  const roots: typeof nodes = []

  nodes.forEach(node => {
    if (node.parentId && nodeMap.has(node.parentId)) {
      nodeMap.get(node.parentId)?.children.push(nodeMap.get(node.id)!)
    } else {
      roots.push(nodeMap.get(node.id)!)
    }
  })

  return roots
}

