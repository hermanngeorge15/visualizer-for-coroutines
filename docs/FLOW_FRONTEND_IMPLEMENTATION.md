# Flow Visualization - Frontend Implementation Guide

**Date:** December 3, 2025  
**Status:** Backend Complete - Frontend Implementation Required  
**Type:** Implementation Guide

---

## 📋 Overview

This document describes what needs to be implemented on the frontend to visualize Kotlin Flow operations. The backend now fully supports:

- **Cold Flows** - `vizFlow`, `vizWrap`, operators
- **Hot Flows** - `InstrumentedStateFlow`, `InstrumentedSharedFlow`
- **All Operators** - map, filter, transform, flatMap, buffer, debounce, etc.
- **Async Operations** - launchIn, shareIn, stateIn, terminal operators

---

## 🎯 What's Already Implemented (Backend)

### New Event Types

| Event | Description | Key Fields |
|-------|-------------|------------|
| `FlowCreated` | Flow instance created | `flowId`, `flowType`, `label`, `scopeId` |
| `FlowCollectionStarted` | Collection begins | `flowId`, `collectorId`, `coroutineId` |
| `FlowValueEmitted` | Value emitted | `flowId`, `collectorId`, `sequenceNumber`, `valuePreview`, `valueType` |
| `FlowCollectionCompleted` | Collection ends | `flowId`, `collectorId`, `totalEmissions`, `durationNanos` |
| `FlowCollectionCancelled` | Collection cancelled | `flowId`, `collectorId`, `reason`, `emittedCount` |
| `FlowBufferOverflow` | Backpressure event | `flowId`, `droppedValue`, `bufferSize`, `overflowStrategy` |
| `FlowOperatorApplied` | Operator added to chain | `flowId`, `sourceFlowId`, `operatorName`, `operatorIndex` |
| `FlowValueTransformed` | Value transformed | `flowId`, `operatorName`, `inputValuePreview`, `outputValuePreview` |
| `FlowValueFiltered` | Value filtered | `flowId`, `operatorName`, `valuePreview`, `passed` |
| `FlowBackpressure` | Backpressure detected | `flowId`, `collectorId`, `reason`, `pendingEmissions` |
| `StateFlowValueChanged` | StateFlow value updated | `flowId`, `oldValuePreview`, `newValuePreview`, `subscriberCount` |
| `SharedFlowEmission` | SharedFlow emission | `flowId`, `valuePreview`, `subscriberCount`, `replayCache` |
| `SharedFlowSubscription` | Subscriber added/removed | `flowId`, `collectorId`, `action`, `subscriberCount` |

---

## 🔧 Frontend Implementation Required

### 1. Type Definitions (`src/types/api.ts`)

Add these TypeScript types:

```typescript
// =============================================================================
// FLOW EVENT TYPES
// =============================================================================

// Flow type enum
export type FlowType = 'Cold' | 'Hot' | 'StateFlow' | 'SharedFlow' | 'Interval' | 'Range' | 'FlowOf'

// Base Flow event
export interface FlowEvent extends BaseVizEvent {
  flowId: string
  coroutineId: string
  label?: string | null
}

// Flow Created
export interface FlowCreatedEvent extends FlowEvent {
  kind: 'FlowCreated'
  flowType: FlowType
  scopeId?: string | null
}

// Flow Collection Started
export interface FlowCollectionStartedEvent extends FlowEvent {
  kind: 'FlowCollectionStarted'
  collectorId: string
}

// Flow Value Emitted
export interface FlowValueEmittedEvent extends FlowEvent {
  kind: 'FlowValueEmitted'
  collectorId: string
  sequenceNumber: number
  valuePreview: string
  valueType: string
}

// Flow Collection Completed
export interface FlowCollectionCompletedEvent extends FlowEvent {
  kind: 'FlowCollectionCompleted'
  collectorId: string
  totalEmissions: number
  durationNanos: number
}

// Flow Collection Cancelled
export interface FlowCollectionCancelledEvent extends FlowEvent {
  kind: 'FlowCollectionCancelled'
  collectorId: string
  reason?: string | null
  emittedCount: number
}

// Flow Buffer Overflow
export interface FlowBufferOverflowEvent extends FlowEvent {
  kind: 'FlowBufferOverflow'
  droppedValue?: string | null
  bufferSize: number
  overflowStrategy: string  // 'SUSPEND' | 'DROP_LATEST' | 'DROP_OLDEST'
}

// Flow Operator Applied
export interface FlowOperatorAppliedEvent extends FlowEvent {
  kind: 'FlowOperatorApplied'
  sourceFlowId: string
  operatorName: string
  operatorIndex: number
}

// Flow Value Transformed
export interface FlowValueTransformedEvent extends FlowEvent {
  kind: 'FlowValueTransformed'
  operatorName: string
  inputValuePreview: string
  outputValuePreview: string
  inputType: string
  outputType: string
  sequenceNumber: number
  collectorId?: string | null
}

// Flow Value Filtered
export interface FlowValueFilteredEvent extends FlowEvent {
  kind: 'FlowValueFiltered'
  operatorName: string
  valuePreview: string
  valueType: string
  passed: boolean  // true = passed filter, false = dropped
  sequenceNumber: number
  collectorId?: string | null
}

// Flow Backpressure
export interface FlowBackpressureEvent extends FlowEvent {
  kind: 'FlowBackpressure'
  collectorId: string
  reason: string  // 'slow_collector' | 'buffer_full' | 'conflated'
  pendingEmissions: number
  bufferCapacity?: number | null
  durationNanos?: number | null
}

// StateFlow Value Changed
export interface StateFlowValueChangedEvent extends FlowEvent {
  kind: 'StateFlowValueChanged'
  oldValuePreview: string
  newValuePreview: string
  valueType: string
  subscriberCount: number
}

// SharedFlow Emission
export interface SharedFlowEmissionEvent extends FlowEvent {
  kind: 'SharedFlowEmission'
  valuePreview: string
  valueType: string
  subscriberCount: number
  replayCache: number
  extraBufferCapacity: number
}

// SharedFlow Subscription
export interface SharedFlowSubscriptionEvent extends FlowEvent {
  kind: 'SharedFlowSubscription'
  collectorId: string
  action: 'subscribed' | 'unsubscribed'
  subscriberCount: number
}

// =============================================================================
// UPDATE VizEventKind UNION
// =============================================================================

export type VizEventKind = 
  // Existing coroutine events...
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
  // NEW: Flow events
  | 'FlowCreated'
  | 'FlowCollectionStarted'
  | 'FlowValueEmitted'
  | 'FlowCollectionCompleted'
  | 'FlowCollectionCancelled'
  | 'FlowBufferOverflow'
  | 'FlowOperatorApplied'
  | 'FlowValueTransformed'
  | 'FlowValueFiltered'
  | 'FlowBackpressure'
  | 'StateFlowValueChanged'
  | 'SharedFlowEmission'
  | 'SharedFlowSubscription'

// =============================================================================
// UPDATE VizEvent UNION
// =============================================================================

export type VizEvent = 
  // Existing events...
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
  // NEW: Flow events
  | FlowCreatedEvent
  | FlowCollectionStartedEvent
  | FlowValueEmittedEvent
  | FlowCollectionCompletedEvent
  | FlowCollectionCancelledEvent
  | FlowBufferOverflowEvent
  | FlowOperatorAppliedEvent
  | FlowValueTransformedEvent
  | FlowValueFilteredEvent
  | FlowBackpressureEvent
  | StateFlowValueChangedEvent
  | SharedFlowEmissionEvent
  | SharedFlowSubscriptionEvent

// =============================================================================
// FLOW DATA STRUCTURES
// =============================================================================

// Flow node for visualization
export interface FlowNode {
  id: string
  flowType: FlowType
  label?: string | null
  scopeId?: string | null
  createdAtNanos: number
  
  // Operator chain
  sourceFlowId?: string | null
  operatorName?: string | null
  operatorIndex: number
  
  // Collection state
  collectors: FlowCollectorInfo[]
  totalEmissions: number
  
  // For StateFlow
  currentValue?: string | null
  
  // For SharedFlow
  subscriberCount: number
  replayCache: number
}

export interface FlowCollectorInfo {
  collectorId: string
  coroutineId: string
  startedAtNanos: number
  completedAtNanos?: number | null
  status: 'collecting' | 'completed' | 'cancelled'
  emissionCount: number
}

// Flow operator chain for visualization
export interface FlowOperatorChain {
  rootFlowId: string
  operators: FlowOperatorNode[]
}

export interface FlowOperatorNode {
  flowId: string
  operatorName: string
  operatorIndex: number
  sourceFlowId: string
  transformations: number  // Count of values transformed
  filtered: number  // Count of values filtered out
  passed: number  // Count of values passed through
}
```

---

### 2. New Components

#### 2.1 `FlowVisualization.tsx` - Main Flow Visualization

```typescript
// src/components/FlowVisualization.tsx

interface FlowVisualizationProps {
  sessionId: string
  flows: FlowNode[]
  events: VizEvent[]
}

/**
 * Main component for visualizing Flow operations.
 * Shows:
 * - Flow creation and type (Cold/Hot/StateFlow/SharedFlow)
 * - Operator chain with transformations
 * - Value emissions in real-time
 * - Collector subscriptions
 * - Backpressure indicators
 */
export function FlowVisualization({ sessionId, flows, events }: FlowVisualizationProps) {
  // Implementation needed:
  // 1. Group flows by type
  // 2. Show operator chains
  // 3. Real-time emission tracking
  // 4. Collector lifecycle
}
```

#### 2.2 `FlowOperatorChain.tsx` - Operator Chain Visualization

```typescript
// src/components/FlowOperatorChain.tsx

interface FlowOperatorChainProps {
  chain: FlowOperatorChain
  events: VizEvent[]
}

/**
 * Visualizes a Flow operator chain.
 * Shows:
 * - Source flow → operator → operator → collector
 * - Transformation counts at each step
 * - Filter pass/drop ratios
 * - Value previews
 */
export function FlowOperatorChainView({ chain, events }: FlowOperatorChainProps) {
  // Implementation needed:
  // 1. Render chain as connected nodes
  // 2. Show transformation arrows
  // 3. Display filter statistics
  // 4. Animate value flow
}
```

#### 2.3 `FlowEmissionTimeline.tsx` - Emission Timeline

```typescript
// src/components/FlowEmissionTimeline.tsx

interface FlowEmissionTimelineProps {
  flowId: string
  events: FlowValueEmittedEvent[]
  transformations?: FlowValueTransformedEvent[]
}

/**
 * Timeline view of Flow emissions.
 * Shows:
 * - Emissions over time
 * - Value previews
 * - Transformation history
 * - Backpressure events
 */
export function FlowEmissionTimeline({ flowId, events, transformations }: FlowEmissionTimelineProps) {
  // Implementation needed:
  // 1. Time-based x-axis
  // 2. Value cards at emission points
  // 3. Transformation indicators
  // 4. Backpressure warnings
}
```

#### 2.4 `StateFlowCard.tsx` - StateFlow Visualization

```typescript
// src/components/StateFlowCard.tsx

interface StateFlowCardProps {
  flow: FlowNode
  valueChanges: StateFlowValueChangedEvent[]
  subscriptions: SharedFlowSubscriptionEvent[]
}

/**
 * Card component for StateFlow visualization.
 * Shows:
 * - Current value (always visible)
 * - Value change history
 * - Subscriber count
 * - Real-time updates
 */
export function StateFlowCard({ flow, valueChanges, subscriptions }: StateFlowCardProps) {
  // Implementation needed:
  // 1. Large current value display
  // 2. Change history list
  // 3. Subscriber badges
  // 4. Animation on value change
}
```

#### 2.5 `SharedFlowCard.tsx` - SharedFlow Visualization

```typescript
// src/components/SharedFlowCard.tsx

interface SharedFlowCardProps {
  flow: FlowNode
  emissions: SharedFlowEmissionEvent[]
  subscriptions: SharedFlowSubscriptionEvent[]
}

/**
 * Card component for SharedFlow visualization.
 * Shows:
 * - Emission stream
 * - Subscriber list
 * - Replay cache size
 * - Buffer state
 */
export function SharedFlowCard({ flow, emissions, subscriptions }: SharedFlowCardProps) {
  // Implementation needed:
  // 1. Emission stream display
  // 2. Subscriber icons
  // 3. Replay cache indicator
  // 4. Buffer overflow warnings
}
```

#### 2.6 `FlowBackpressureIndicator.tsx` - Backpressure Warning

```typescript
// src/components/FlowBackpressureIndicator.tsx

interface FlowBackpressureIndicatorProps {
  events: FlowBackpressureEvent[]
  bufferOverflows: FlowBufferOverflowEvent[]
}

/**
 * Shows backpressure status for flows.
 * Displays:
 * - Pending emissions count
 * - Buffer capacity
 * - Dropped values
 * - Overflow strategy
 */
export function FlowBackpressureIndicator({ events, bufferOverflows }: FlowBackpressureIndicatorProps) {
  // Implementation needed:
  // 1. Warning badge
  // 2. Buffer fill meter
  // 3. Dropped count
  // 4. Strategy label
}
```

---

### 3. New Hooks

#### 3.1 `use-flows.ts` - Flow Data Hook

```typescript
// src/hooks/use-flows.ts

interface UseFlowsResult {
  flows: FlowNode[]
  operatorChains: FlowOperatorChain[]
  isLoading: boolean
  error: Error | null
}

/**
 * Hook to fetch and manage Flow data from a session.
 */
export function useFlows(sessionId: string): UseFlowsResult {
  // Implementation needed:
  // 1. Subscribe to Flow events
  // 2. Build FlowNode objects
  // 3. Track operator chains
  // 4. Update on new events
}
```

#### 3.2 `use-flow-emissions.ts` - Emission Stream Hook

```typescript
// src/hooks/use-flow-emissions.ts

interface UseFlowEmissionsResult {
  emissions: FlowValueEmittedEvent[]
  transformations: FlowValueTransformedEvent[]
  filters: FlowValueFilteredEvent[]
  backpressure: FlowBackpressureEvent[]
}

/**
 * Hook to track emissions for a specific flow.
 */
export function useFlowEmissions(sessionId: string, flowId: string): UseFlowEmissionsResult {
  // Implementation needed:
  // 1. Filter events by flowId
  // 2. Track emission sequence
  // 3. Monitor transformations
  // 4. Detect backpressure
}
```

#### 3.3 `use-flow-collectors.ts` - Collector Tracking Hook

```typescript
// src/hooks/use-flow-collectors.ts

interface UseFlowCollectorsResult {
  collectors: FlowCollectorInfo[]
  subscriptions: SharedFlowSubscriptionEvent[]
}

/**
 * Hook to track collectors for a flow.
 */
export function useFlowCollectors(sessionId: string, flowId: string): UseFlowCollectorsResult {
  // Implementation needed:
  // 1. Track collection start/complete
  // 2. Monitor subscriptions
  // 3. Calculate emission counts
}
```

---

### 4. Update Existing Components

#### 4.1 `EventsList.tsx` - Add Flow Event Rendering

```typescript
// Update src/components/EventsList.tsx

// Add Flow event rendering:
function renderFlowEvent(event: VizEvent) {
  switch (event.kind) {
    case 'FlowCreated':
      return <FlowCreatedBadge flow={event} />
    case 'FlowValueEmitted':
      return <FlowEmissionBadge emission={event} />
    case 'FlowOperatorApplied':
      return <FlowOperatorBadge operator={event} />
    case 'StateFlowValueChanged':
      return <StateFlowChangeBadge change={event} />
    // ... etc
  }
}
```

#### 4.2 `SessionDetails.tsx` - Add Flow Section

```typescript
// Update src/components/SessionDetails.tsx or EnhancedSessionDetails.tsx

// Add Flow visualization tab/section:
<Tabs>
  <Tab label="Coroutines">...</Tab>
  <Tab label="Timeline">...</Tab>
  <Tab label="Flows">  {/* NEW */}
    <FlowVisualization 
      sessionId={sessionId}
      flows={flows}
      events={events}
    />
  </Tab>
</Tabs>
```

---

### 5. Styling Suggestions

#### 5.1 Flow Type Colors

```css
/* Cold Flow - Blue (inactive until collected) */
.flow-cold { color: #3B82F6; }

/* Hot Flow - Orange (always active) */
.flow-hot { color: #F97316; }

/* StateFlow - Green (stateful) */
.flow-state { color: #22C55E; }

/* SharedFlow - Purple (multicasted) */
.flow-shared { color: #A855F7; }
```

#### 5.2 Operator Chain Visualization

```css
/* Operator nodes in chain */
.operator-node {
  @apply rounded-lg border-2 p-2;
}

.operator-map { @apply border-blue-400 bg-blue-50; }
.operator-filter { @apply border-yellow-400 bg-yellow-50; }
.operator-transform { @apply border-green-400 bg-green-50; }
.operator-buffer { @apply border-purple-400 bg-purple-50; }
```

#### 5.3 Emission Animation

```css
/* Animate value flowing through chain */
@keyframes flow-value {
  from { transform: translateX(-100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

.emission-value {
  animation: flow-value 0.3s ease-out;
}
```

---

### 6. API Integration

The backend exposes these events through the existing event stream. Filter by `kind` to get Flow events:

```typescript
// Filter Flow events
const flowEvents = events.filter(e => 
  e.kind.startsWith('Flow') || 
  e.kind.startsWith('StateFlow') || 
  e.kind.startsWith('SharedFlow')
)

// Group by flowId
const flowsById = groupBy(flowEvents, 'flowId')

// Build operator chains
const operatorChains = buildOperatorChains(
  flowEvents.filter(e => e.kind === 'FlowOperatorApplied')
)
```

---

## 📊 Implementation Priority

### Phase 1: Core Types & Basic Display (Week 1)
- [ ] Add Flow event types to `api.ts`
- [ ] Create `FlowVisualization.tsx` basic structure
- [ ] Update `EventsList.tsx` to render Flow events
- [ ] Add Flow section to session details

### Phase 2: Operator Chain Visualization (Week 2)
- [ ] Create `FlowOperatorChain.tsx`
- [ ] Implement `use-flows.ts` hook
- [ ] Add operator chain grouping logic
- [ ] Style operator nodes

### Phase 3: StateFlow/SharedFlow Cards (Week 2)
- [ ] Create `StateFlowCard.tsx`
- [ ] Create `SharedFlowCard.tsx`
- [ ] Implement real-time value updates
- [ ] Add subscriber tracking

### Phase 4: Emission Timeline (Week 3)
- [ ] Create `FlowEmissionTimeline.tsx`
- [ ] Implement `use-flow-emissions.ts`
- [ ] Add value transformation tracking
- [ ] Create emission animations

### Phase 5: Backpressure & Polish (Week 3)
- [ ] Create `FlowBackpressureIndicator.tsx`
- [ ] Add buffer overflow warnings
- [ ] Polish animations
- [ ] Add documentation

---

## 🎨 Design Mockups

### Flow Operator Chain

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   vizFlow    │───▶│     map      │───▶│    filter    │───▶│   collect    │
│   "source"   │    │  transform   │    │  predicate   │    │  collector-1 │
│  emissions:5 │    │  applied:5   │    │ passed:3/5   │    │  received:3  │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
```

### StateFlow Card

```
┌────────────────────────────────────────┐
│  StateFlow: "userState"                │
│  ┌──────────────────────────────────┐  │
│  │  Current Value:                  │  │
│  │  { name: "John", age: 30 }       │  │
│  └──────────────────────────────────┘  │
│  Subscribers: 3  │  Changes: 5         │
│  ────────────────────────────────────  │
│  History:                              │
│  • 10:32:15 - { name: "John", age: 29 }│
│  • 10:32:10 - { name: "Jane", age: 28 }│
└────────────────────────────────────────┘
```

### SharedFlow Card

```
┌────────────────────────────────────────┐
│  SharedFlow: "events"                  │
│  Replay: 3  │  Buffer: 64  │  Subs: 2  │
│  ────────────────────────────────────  │
│  Recent Emissions:                     │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐   │
│  │ E1 │ │ E2 │ │ E3 │ │ E4 │ │ E5 │   │
│  └────┘ └────┘ └────┘ └────┘ └────┘   │
│  ▲ replay cache ▲                      │
│  ────────────────────────────────────  │
│  Subscribers:                          │
│  • collector-1 (coroutine-5)           │
│  • collector-2 (coroutine-8)           │
└────────────────────────────────────────┘
```

---

## ✅ Checklist

### Backend (Complete ✅)
- [x] FlowCreated event
- [x] FlowCollectionStarted event
- [x] FlowValueEmitted event
- [x] FlowCollectionCompleted event
- [x] FlowCollectionCancelled event
- [x] FlowBufferOverflow event
- [x] FlowOperatorApplied event
- [x] FlowValueTransformed event
- [x] FlowValueFiltered event
- [x] FlowBackpressure event
- [x] StateFlowValueChanged event
- [x] SharedFlowEmission event
- [x] SharedFlowSubscription event
- [x] InstrumentedFlow with all operators
- [x] InstrumentedStateFlow
- [x] InstrumentedSharedFlow
- [x] VizScope.vizFlow() builder
- [x] Async operations (launchIn, shareIn, stateIn)
- [x] Terminal operators (first, last, toList, count, reduce, fold)

### Frontend (To Implement)
- [ ] Flow event types in api.ts
- [ ] FlowVisualization component
- [ ] FlowOperatorChain component
- [ ] FlowEmissionTimeline component
- [ ] StateFlowCard component
- [ ] SharedFlowCard component
- [ ] FlowBackpressureIndicator component
- [ ] use-flows hook
- [ ] use-flow-emissions hook
- [ ] use-flow-collectors hook
- [ ] EventsList Flow rendering
- [ ] SessionDetails Flow tab
- [ ] Flow styling

---

# Channel Visualization - Frontend Implementation Guide

**Date:** December 3, 2025  
**Status:** Backend Complete - Frontend Implementation Required

---

## 📋 Channel Overview

The backend now supports comprehensive Channel visualization:

- **Rendezvous Channels** - No buffer, strict synchronization
- **Buffered Channels** - Configurable buffer size
- **Unlimited Channels** - Unbounded buffer
- **Conflated Channels** - Single-element buffer with overwrite

---

## 🎯 Channel Events (Backend)

| Event | Description | Key Fields |
|-------|-------------|------------|
| `ChannelCreated` | Channel instance created | `channelId`, `capacity`, `capacityName`, `onBufferOverflow`, `label` |
| `ChannelSendStarted` | Send operation begins | `channelId`, `senderId`, `coroutineId`, `valuePreview`, `bufferSize` |
| `ChannelSendCompleted` | Send operation completes | `channelId`, `senderId`, `durationNanos`, `wasSuspended`, `bufferSize` |
| `ChannelSendSuspended` | Send suspends (buffer full) | `channelId`, `senderId`, `reason`, `bufferSize`, `pendingSenders` |
| `ChannelReceiveStarted` | Receive operation begins | `channelId`, `receiverId`, `coroutineId`, `bufferSize` |
| `ChannelReceiveCompleted` | Receive completes | `channelId`, `receiverId`, `valuePreview`, `wasSuspended`, `bufferSize` |
| `ChannelReceiveSuspended` | Receive suspends (buffer empty) | `channelId`, `receiverId`, `reason`, `pendingReceivers` |
| `ChannelClosed` | Channel closed | `channelId`, `cause`, `totalSent`, `totalReceived`, `remainingInBuffer` |
| `ChannelBufferOverflow` | Buffer overflow (DROP strategies) | `channelId`, `droppedValuePreview`, `strategy`, `bufferSize` |
| `ChannelReceiveFailed` | Receive failed | `channelId`, `receiverId`, `reason`, `cause` |

---

## 🔧 Channel Frontend Implementation

### 1. Type Definitions (`src/types/api.ts`)

Add these TypeScript types:

```typescript
// =============================================================================
// CHANNEL EVENT TYPES
// =============================================================================

// Channel capacity type
export type ChannelCapacity = 'RENDEZVOUS' | 'UNLIMITED' | 'CONFLATED' | 'BUFFERED' | string

// Channel Buffer Overflow
export type ChannelBufferOverflowStrategy = 'SUSPEND' | 'DROP_OLDEST' | 'DROP_LATEST'

// Channel Created
export interface ChannelCreatedEvent extends BaseVizEvent {
  kind: 'ChannelCreated'
  channelId: string
  capacity: number
  capacityName: ChannelCapacity
  onBufferOverflow: ChannelBufferOverflowStrategy
  onUndeliveredElement: boolean
  label?: string | null
  scopeId?: string | null
  coroutineId?: string | null
}

// Channel Send Started
export interface ChannelSendStartedEvent extends BaseVizEvent {
  kind: 'ChannelSendStarted'
  channelId: string
  senderId: string
  coroutineId: string
  valuePreview: string
  valueType: string
  bufferSize: number
  bufferCapacity: number
  label?: string | null
}

// Channel Send Completed
export interface ChannelSendCompletedEvent extends BaseVizEvent {
  kind: 'ChannelSendCompleted'
  channelId: string
  senderId: string
  coroutineId: string
  valuePreview: string
  durationNanos: number
  wasSuspended: boolean
  bufferSize: number
  label?: string | null
}

// Channel Send Suspended
export interface ChannelSendSuspendedEvent extends BaseVizEvent {
  kind: 'ChannelSendSuspended'
  channelId: string
  senderId: string
  coroutineId: string
  reason: string  // 'buffer_full' | 'no_receiver'
  bufferSize: number
  bufferCapacity: number
  pendingSenders: number
  label?: string | null
}

// Channel Receive Started
export interface ChannelReceiveStartedEvent extends BaseVizEvent {
  kind: 'ChannelReceiveStarted'
  channelId: string
  receiverId: string
  coroutineId: string
  bufferSize: number
  label?: string | null
}

// Channel Receive Completed
export interface ChannelReceiveCompletedEvent extends BaseVizEvent {
  kind: 'ChannelReceiveCompleted'
  channelId: string
  receiverId: string
  coroutineId: string
  valuePreview: string
  valueType: string
  durationNanos: number
  wasSuspended: boolean
  bufferSize: number
  label?: string | null
}

// Channel Receive Suspended
export interface ChannelReceiveSuspendedEvent extends BaseVizEvent {
  kind: 'ChannelReceiveSuspended'
  channelId: string
  receiverId: string
  coroutineId: string
  reason: string  // 'buffer_empty' | 'no_sender'
  pendingReceivers: number
  label?: string | null
}

// Channel Closed
export interface ChannelClosedEvent extends BaseVizEvent {
  kind: 'ChannelClosed'
  channelId: string
  coroutineId?: string | null
  cause?: string | null
  totalSent: number
  totalReceived: number
  remainingInBuffer: number
  label?: string | null
}

// Channel Buffer Overflow Event
export interface ChannelBufferOverflowEvent extends BaseVizEvent {
  kind: 'ChannelBufferOverflow'
  channelId: string
  coroutineId?: string | null
  droppedValuePreview?: string | null
  droppedValueType?: string | null
  strategy: string
  bufferSize: number
  bufferCapacity: number
  label?: string | null
}

// Channel Receive Failed
export interface ChannelReceiveFailedEvent extends BaseVizEvent {
  kind: 'ChannelReceiveFailed'
  channelId: string
  receiverId: string
  coroutineId: string
  reason: string  // 'channel_closed' | 'cancelled' | 'channel_failed'
  cause?: string | null
  label?: string | null
}

// =============================================================================
// UPDATE VizEventKind UNION - Add Channel events
// =============================================================================

export type VizEventKind = 
  // ... existing events ...
  // NEW: Channel events
  | 'ChannelCreated'
  | 'ChannelSendStarted'
  | 'ChannelSendCompleted'
  | 'ChannelSendSuspended'
  | 'ChannelReceiveStarted'
  | 'ChannelReceiveCompleted'
  | 'ChannelReceiveSuspended'
  | 'ChannelClosed'
  | 'ChannelBufferOverflow'
  | 'ChannelReceiveFailed'

// =============================================================================
// CHANNEL DATA STRUCTURES
// =============================================================================

// Channel node for visualization
export interface ChannelNode {
  id: string
  capacity: number
  capacityName: ChannelCapacity
  onBufferOverflow: ChannelBufferOverflowStrategy
  label?: string | null
  createdAtNanos: number
  closedAtNanos?: number | null
  
  // Buffer state
  currentBufferSize: number
  maxBufferSize: number
  
  // Statistics
  totalSent: number
  totalReceived: number
  droppedCount: number
  
  // Pending operations
  pendingSenders: number
  pendingReceivers: number
  
  // Status
  isClosed: boolean
  closeCause?: string | null
}

// Channel operation for visualization
export interface ChannelOperation {
  operationId: string
  channelId: string
  coroutineId: string
  type: 'send' | 'receive'
  startedAtNanos: number
  completedAtNanos?: number | null
  wasSuspended: boolean
  valuePreview?: string | null
  status: 'started' | 'suspended' | 'completed' | 'failed'
}
```

---

### 2. New Channel Components

#### 2.1 `ChannelVisualization.tsx` - Main Channel Visualization

```typescript
// src/components/ChannelVisualization.tsx

interface ChannelVisualizationProps {
  sessionId: string
  channels: ChannelNode[]
  events: VizEvent[]
}

/**
 * Main component for visualizing Channel operations.
 * Shows:
 * - Channel creation and capacity type
 * - Buffer fill level meter
 * - Send/receive operations in real-time
 * - Pending senders/receivers
 * - Backpressure indicators
 */
export function ChannelVisualization({ sessionId, channels, events }: ChannelVisualizationProps) {
  // Implementation needed:
  // 1. Group channels by session
  // 2. Show buffer state
  // 3. Real-time send/receive tracking
  // 4. Suspension indicators
}
```

#### 2.2 `ChannelCard.tsx` - Single Channel Card

```typescript
// src/components/ChannelCard.tsx

interface ChannelCardProps {
  channel: ChannelNode
  operations: ChannelOperation[]
}

/**
 * Card component for single channel visualization.
 * Shows:
 * - Channel name and type
 * - Buffer fill meter (visual)
 * - Active producers/consumers
 * - Recent operations
 */
export function ChannelCard({ channel, operations }: ChannelCardProps) {
  // Implementation needed:
  // 1. Channel header with label and type
  // 2. Buffer fill progress bar
  // 3. Producer/consumer badges
  // 4. Operation history list
}
```

#### 2.3 `ChannelBufferMeter.tsx` - Buffer Visualization

```typescript
// src/components/ChannelBufferMeter.tsx

interface ChannelBufferMeterProps {
  currentSize: number
  capacity: number
  pendingSenders: number
  pendingReceivers: number
}

/**
 * Visual meter showing channel buffer state.
 * Shows:
 * - Current fill level
 * - Capacity limit
 * - Waiting producers (above buffer)
 * - Waiting consumers (below buffer)
 */
export function ChannelBufferMeter(props: ChannelBufferMeterProps) {
  // Implementation needed:
  // 1. Vertical bar showing fill %
  // 2. Icons for pending producers above
  // 3. Icons for pending consumers below
  // 4. Color coding (green = ok, yellow = filling, red = full)
}
```

#### 2.4 `ChannelOperationTimeline.tsx` - Operation Timeline

```typescript
// src/components/ChannelOperationTimeline.tsx

interface ChannelOperationTimelineProps {
  channelId: string
  operations: ChannelOperation[]
}

/**
 * Timeline view of channel operations.
 * Shows:
 * - Send/receive pairs over time
 * - Suspension periods
 * - Value flow animation
 */
export function ChannelOperationTimeline({ channelId, operations }: ChannelOperationTimelineProps) {
  // Implementation needed:
  // 1. Two lanes: producers (top) and consumers (bottom)
  // 2. Operations as blocks on timeline
  // 3. Arrows showing value transfer
  // 4. Suspension indicators
}
```

---

### 3. New Channel Hooks

#### 3.1 `use-channels.ts` - Channel Data Hook

```typescript
// src/hooks/use-channels.ts

interface UseChannelsResult {
  channels: ChannelNode[]
  isLoading: boolean
  error: Error | null
}

/**
 * Hook to fetch and manage Channel data from a session.
 */
export function useChannels(sessionId: string): UseChannelsResult {
  // Implementation needed:
  // 1. Subscribe to Channel events
  // 2. Build ChannelNode objects
  // 3. Track buffer state changes
  // 4. Update on new events
}
```

#### 3.2 `use-channel-operations.ts` - Operations Hook

```typescript
// src/hooks/use-channel-operations.ts

interface UseChannelOperationsResult {
  operations: ChannelOperation[]
  sends: ChannelSendCompletedEvent[]
  receives: ChannelReceiveCompletedEvent[]
  suspensions: (ChannelSendSuspendedEvent | ChannelReceiveSuspendedEvent)[]
}

/**
 * Hook to track operations for a specific channel.
 */
export function useChannelOperations(sessionId: string, channelId: string): UseChannelOperationsResult {
  // Implementation needed:
  // 1. Filter events by channelId
  // 2. Match send/receive pairs
  // 3. Track suspensions
}
```

---

### 4. Styling Suggestions

#### 4.1 Channel Type Colors

```css
/* Rendezvous - Red (strict synchronization) */
.channel-rendezvous { color: #EF4444; }

/* Buffered - Blue (normal) */
.channel-buffered { color: #3B82F6; }

/* Unlimited - Green (no backpressure) */
.channel-unlimited { color: #22C55E; }

/* Conflated - Orange (overwrites) */
.channel-conflated { color: #F97316; }
```

#### 4.2 Buffer Fill Visualization

```css
/* Buffer meter */
.buffer-meter {
  @apply h-32 w-8 bg-gray-200 rounded relative;
}

.buffer-fill {
  @apply absolute bottom-0 w-full rounded-b transition-all;
}

.buffer-fill-ok { @apply bg-green-500; }
.buffer-fill-warning { @apply bg-yellow-500; }
.buffer-fill-full { @apply bg-red-500; }
```

---

### 5. Design Mockups

#### Channel Card

```
┌────────────────────────────────────────┐
│  Channel: "orders"                     │
│  Type: BUFFERED(10)  │  Overflow: SUSPEND
│  ────────────────────────────────────  │
│                                        │
│   Producers [P1] [P2]    ┌────┐       │
│                          │████│ 7/10   │
│                          │████│        │
│                          │████│        │
│                          │░░░░│        │
│   Consumers [C1]         └────┘        │
│                                        │
│  Sent: 42  │  Received: 35  │  Dropped: 0
└────────────────────────────────────────┘
```

#### Operation Timeline

```
┌────────────────────────────────────────┐
│  Channel "events" - Operation Timeline │
│  ────────────────────────────────────  │
│                                        │
│  Producers:                            │
│  ───●──────●────●─────────●───────→    │
│     S1     S2   S3(wait)  S4           │
│                                        │
│  Buffer: ════════╗                     │
│                  ║  (suspended)        │
│          ════════╝                     │
│                                        │
│  Consumers:                            │
│  ────────●─────────●──────●───────→    │
│          R1        R2     R3           │
│                                        │
└────────────────────────────────────────┘
```

---

## ✅ Channel Checklist

### Backend (Complete ✅)
- [x] ChannelCreated event
- [x] ChannelSendStarted event
- [x] ChannelSendCompleted event
- [x] ChannelSendSuspended event
- [x] ChannelReceiveStarted event
- [x] ChannelReceiveCompleted event
- [x] ChannelReceiveSuspended event
- [x] ChannelClosed event
- [x] ChannelBufferOverflow event
- [x] ChannelReceiveFailed event
- [x] InstrumentedChannel wrapper
- [x] VizScope.vizChannel() builder
- [x] Rendezvous channel support
- [x] Buffered channel support
- [x] Unlimited channel support
- [x] Conflated channel support

### Frontend (To Implement)
- [ ] Channel event types in api.ts
- [ ] ChannelVisualization component
- [ ] ChannelCard component
- [ ] ChannelBufferMeter component
- [ ] ChannelOperationTimeline component
- [ ] use-channels hook
- [ ] use-channel-operations hook
- [ ] EventsList Channel rendering
- [ ] SessionDetails Channel tab
- [ ] Channel styling

---

## 📚 References

- [Kotlin Flow Documentation](https://kotlinlang.org/docs/flow.html)
- [StateFlow and SharedFlow](https://kotlinlang.org/docs/stateflow-and-sharedflow.html)
- [Flow Operators](https://kotlinlang.org/docs/flow.html#flow-operators)
- [Kotlin Channels](https://kotlinlang.org/docs/channels.html)
- [Channel Capacity](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines.channels/-channel/)

---

**End of Document**

