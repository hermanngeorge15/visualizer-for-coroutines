// API Types matching backend DTOs

export enum CoroutineState {
  CREATED = 'CREATED',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  WAITING_FOR_CHILDREN = 'WAITING_FOR_CHILDREN',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  FAILED = 'FAILED',
}

export interface CoroutineNode {
  id: string
  jobId: string
  parentId: string | null
  scopeId: string
  label: string | null
  state: CoroutineState
}

export interface SessionInfo {
  sessionId: string
  coroutineCount: number
}

export interface SessionSnapshot {
  sessionId: string
  coroutineCount: number
  eventCount: number
  coroutines: CoroutineNode[]
}

export interface ScenarioCompletion {
  success: boolean
  sessionId: string
  message: string
  coroutineCount: number
  eventCount: number
}

export interface Scenario {
  id: string
  name: string
  description: string
  endpoint: string
  category?: 'realistic' | 'basic'
  duration?: string
}

// Custom Scenario Configuration Types
export type ActionType = 'delay' | 'throw' | 'log' | 'custom'

export interface ActionConfig {
  type: ActionType
  params: Record<string, string>
}

export interface CoroutineConfigNode {
  id: string
  label: string
  parentId?: string | null
  actions: ActionConfig[]
  children: CoroutineConfigNode[]
}

export interface ScenarioConfigRequest {
  name: string
  description?: string | null
  sessionId?: string | null
  root: CoroutineConfigNode
}

export interface ScenarioExecutionResponse {
  success: boolean
  sessionId: string
  message: string
  coroutineCount: number
  eventCount: number
  errors?: string[]
}

// Event Types
export type VizEventKind = 
  | 'coroutine.created'
  | 'coroutine.started'
  | 'coroutine.suspended'
  | 'coroutine.resumed'
  | 'coroutine.body-completed'
  | 'coroutine.completed'
  | 'coroutine.cancelled'
  | 'coroutine.failed'
  | 'thread.assigned'
  | 'DispatcherSelected'
  | 'DeferredValueAvailable'
  | 'DeferredAwaitStarted'
  | 'DeferredAwaitCompleted'
  | 'JobStateChanged'
  | 'JobCancellationRequested'
  | 'JobJoinRequested'
  | 'JobJoinCompleted'
  | 'WaitingForChildren'

export interface BaseVizEvent {
  sessionId: string
  seq: number
  tsNanos: number
  kind: VizEventKind
}

export interface CoroutineEvent extends BaseVizEvent {
  coroutineId: string
  jobId: string
  parentCoroutineId: string | null
  scopeId: string
  label: string | null
}

// Job-related event types
export interface JobStateChangedEvent extends CoroutineEvent {
  kind: 'JobStateChanged'
  isActive: boolean
  isCompleted: boolean
  isCancelled: boolean
  childrenCount: number
}

export interface JobCancellationRequestedEvent extends CoroutineEvent {
  kind: 'JobCancellationRequested'
  requestedBy: string | null
  cause: string | null
}

export interface JobJoinRequestedEvent extends CoroutineEvent {
  kind: 'JobJoinRequested'
  waitingCoroutineId: string | null
}

export interface JobJoinCompletedEvent extends CoroutineEvent {
  kind: 'JobJoinCompleted'
  waitingCoroutineId: string | null
}

// Structured Concurrency event
export interface WaitingForChildrenEvent extends CoroutineEvent {
  kind: 'WaitingForChildren'
  activeChildrenCount: number
  activeChildrenIds: string[]
}

// Dispatcher-related events
export interface DispatcherSelectedEvent extends CoroutineEvent {
  kind: 'DispatcherSelected'
  dispatcherId: string
  dispatcherName: string
  queueDepth?: number | null
}

export interface ThreadAssignedEvent extends CoroutineEvent {
  kind: 'thread.assigned'
  threadId: number
  threadName: string
  dispatcherName: string
}

// Deferred/Async events
export interface DeferredValueAvailableEvent extends CoroutineEvent {
  kind: 'DeferredValueAvailable'
  deferredId: string
}

export interface DeferredAwaitStartedEvent extends CoroutineEvent {
  kind: 'DeferredAwaitStarted'
  deferredId: string
  awaitingCoroutineId: string
}

export interface DeferredAwaitCompletedEvent extends CoroutineEvent {
  kind: 'DeferredAwaitCompleted'
  deferredId: string
  awaitingCoroutineId: string
}

export type VizEvent = 
  | CoroutineEvent 
  | CoroutineSuspendedEvent
  | JobStateChangedEvent 
  | JobCancellationRequestedEvent
  | JobJoinRequestedEvent
  | JobJoinCompletedEvent
  | WaitingForChildrenEvent
  | DispatcherSelectedEvent
  | ThreadAssignedEvent
  | DeferredValueAvailableEvent
  | DeferredAwaitStartedEvent
  | DeferredAwaitCompletedEvent

// Event filtering and pagination
export interface EventFilter {
  coroutineId?: string
  scopeId?: string
  kind?: VizEventKind | VizEventKind[]
  fromTimestamp?: number
  toTimestamp?: number
}

export interface PaginatedEventsRequest {
  sessionId: string
  sinceStep?: number
  limit?: number
  filter?: EventFilter
}

export interface PaginatedEventsResponse {
  events: VizEvent[]
  nextStep?: number | null
  hasMore: boolean
  total: number
}

// API Response types
export interface CreateSessionResponse {
  sessionId: string
  message: string
}

export interface ErrorResponse {
  error: string
}

// Thread activity types
export interface ThreadEvent {
  coroutineId: string
  threadId: number
  threadName: string
  timestamp: number
  eventType: 'ASSIGNED' | 'RELEASED'
}

export interface ThreadActivity {
  [threadId: string]: ThreadEvent[]
}

// Hierarchy types (Enhanced for new backend API)
export interface HierarchyNode {
  id: string
  parentId: string | null
  children: string[]
  name: string
  scopeId: string
  state: CoroutineState
  createdAtNanos: number
  completedAtNanos?: number | null
  currentThreadId?: number | null
  currentThreadName?: string | null
  dispatcherId?: string | null
  dispatcherName?: string | null
  jobId: string
  // Structured concurrency tracking
  activeChildrenIds?: string[]
  activeChildrenCount?: number
  // Additional metadata for enhanced visualization
  suspensionPoints?: SuspensionPoint[]
  activeTime?: number  // Total active time in nanos
  suspendedTime?: number  // Total suspended time in nanos
}

// Hierarchy tree response (nested structure from backend)
export interface HierarchyTree {
  root: HierarchyNodeTree
}

export interface HierarchyNodeTree extends HierarchyNode {
  children: HierarchyNodeTree[]  // Full nested children, not just IDs
}

// Suspension Point tracking
export interface SuspensionPoint {
  function: string
  fileName?: string | null
  lineNumber?: number | null
  reason: string  // "delay", "withContext", "join", etc.
  timestamp: number
}

// Enhanced Coroutine Suspended event with suspension point
export interface CoroutineSuspendedEvent extends CoroutineEvent {
  kind: 'coroutine.suspended'
  suspensionPoint?: SuspensionPoint | null
}

// Timeline data structures
export interface CoroutineTimeline {
  coroutineId: string
  name: string | null
  state: CoroutineState
  parentId: string | null
  childrenIds: string[]
  totalDuration: number  // in nanos
  activeTime: number  // in nanos
  suspendedTime: number  // in nanos
  events: TimelineEvent[]
}

export interface TimelineEvent {
  seq: number
  timestamp: number  // in nanos
  kind: VizEventKind
  threadId?: number | null
  threadName?: string | null
  dispatcherId?: string | null
  dispatcherName?: string | null
  suspensionPoint?: SuspensionPoint | null
  duration?: number | null  // For computed durations (suspend → resume)
}

// Thread Activity - Enhanced structure
export interface ThreadActivityResponse {
  threads: ThreadLaneData[]
  dispatcherInfo: DispatcherInfo[]
}

export interface ThreadLaneData {
  threadId: number
  threadName: string
  dispatcherId?: string | null
  dispatcherName?: string | null
  segments: ThreadSegment[]
  utilization: number  // 0-1 representing how busy the thread was
}

export interface ThreadSegment {
  coroutineId: string
  coroutineName: string | null
  startNanos: number
  endNanos?: number | null
  state: 'ACTIVE' | 'SUSPENDED'
}

export interface DispatcherInfo {
  id: string
  name: string
  threadIds: number[]
  queueDepth?: number | null
}

