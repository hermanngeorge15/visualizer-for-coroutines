# Real-Time Visualization Features

## 🎯 Overview

The Coroutine Visualizer now includes **real-time updates** via Server-Sent Events (SSE) with automatic refresh and live animations.

## ✨ New Real-Time Features

### 1. **Auto-Refresh System**
When you enable "Live Stream", the visualization automatically updates:

- **Event-driven refresh** - Fetches new data when SSE events arrive
- **Periodic refresh** - Updates every 500ms while streaming is active
- **Debounced updates** - Prevents excessive API calls
- **Visual indicator** - Shows "🔄 Auto-updating" badge when active

### 2. **Live Activity Counter**
At the top of the tree visualization:
```
● 3 coroutines actively running
```
- **Pulsing dot** - Animated indicator
- **Real-time count** - Updates as coroutines start/complete
- **Appears/disappears** - Only shows when coroutines are ACTIVE

### 3. **State Transition Animations**
Watch coroutines change state in real-time:

| Transition | Visual Effect |
|------------|---------------|
| CREATED → ACTIVE | Border changes to blue, icon starts spinning |
| ACTIVE → COMPLETED | Spinning stops, turns green with checkmark |
| ACTIVE → CANCELLED | Turns yellow with X mark |

### 4. **Smooth Re-rendering**
- **AnimatePresence** - Smooth entrance/exit animations
- **Key-based updates** - Efficient re-rendering based on state changes
- **Spring physics** - Natural, bouncy animations
- **Layout animations** - Children smoothly reposition

### 5. **Visual Feedback**

#### Active Coroutines
- 🔄 **Rotating icon** - Loader spins continuously
- ✨ **Pulsing glow** - Card shadow pulses
- 🌊 **Flowing particles** - Dots animate down connection lines
- 📊 **Progress bar** - Sliding animation at bottom of card

#### State-Specific Borders
- **Blue pulsing glow** - ACTIVE coroutines
- **Green solid border** - COMPLETED coroutines  
- **Yellow border** - CANCELLED coroutines
- **Gray border** - CREATED/waiting coroutines

## 🚀 How to Use

### Step 1: Run a Scenario
```bash
# From your browser
1. Go to "Scenarios" page
2. Click "Run Scenario" on any scenario (e.g., "Parallel Execution")
3. You'll be redirected to the session page
```

### Step 2: Enable Live Stream
```
1. Click "Enable Live Stream" button
2. Watch for "Connected ✓" indicator
3. See "🔄 Auto-updating" badge appear
4. Tree visualization starts updating in real-time
```

### Step 3: Watch the Animation
- **Root coroutine** appears first (usually coordinator)
- **Blue glow** indicates it's ACTIVE and spawning children
- **Child coroutines** appear one by one with staggered animations
- **Particles flow** down connection lines showing execution
- **States change** in real-time as coroutines complete

### Step 4: Observe State Changes
Watch the progression:
```
1. CREATED (gray) → coroutine just created
2. ACTIVE (blue, spinning) → currently executing
3. COMPLETED (green, checkmark) → finished successfully
4. CANCELLED (yellow, X) → was cancelled
```

## 📊 Example Scenario Flow

### Parallel Execution Scenario (5 workers)

```
Time 0ms:
  coordinator [CREATED]
  
Time 100ms:
  coordinator [ACTIVE] ← Spinning icon, blue glow
      ↓ (particles flowing)
    ●═══●═══●═══●═══●
    ↓   ↓   ↓   ↓   ↓
  [worker-0] [worker-1] [worker-2] [worker-3] [worker-4]
  All [ACTIVE] ← All spinning

Time 1500ms (delay complete):
  coordinator [COMPLETED] ← Green checkmark
      ↓
    ●═══●═══●═══●═══●
    ↓   ↓   ↓   ↓   ↓
  [worker-0] [worker-1] [worker-2] [worker-3] [worker-4]
  All [COMPLETED] ← All green checkmarks
```

## ⚡ Performance Optimizations

### 1. **Debounced Updates**
- 200ms delay after SSE events before fetching
- Prevents rapid successive API calls

### 2. **Efficient Re-rendering**
```typescript
// Keys include state to trigger re-render only when state changes
key={`${node.id}-${node.state}`}
```

### 3. **Memoized Calculations**
```typescript
// Tree only rebuilds when coroutines array changes
const tree = useMemo(() => buildCoroutineTree(coroutines), [coroutines])

// Active count updates efficiently
const activeCount = useMemo(
  () => coroutines.filter(c => c.state === 'ACTIVE').length,
  [coroutines]
)
```

### 4. **Conditional Animations**
- Particles only render for ACTIVE coroutines
- Progress bar only shows for ACTIVE state
- Reduces unnecessary animations

## 🎨 Animation Details

### Entrance Animations
```typescript
initial={{ scale: 0, opacity: 0 }}
animate={{ scale: 1, opacity: 1 }}
// Staggered based on tree level and sibling index
delay: level * 0.1 + siblingIndex * 0.05
```

### Active State Animations
```typescript
// Rotating icon (2s per rotation)
animate={{ rotate: 360 }}
transition={{ duration: 2, repeat: Infinity }}

// Pulsing glow (2s cycle)
animate={{
  boxShadow: [
    'rgba(99, 102, 241, 0.3)',
    'rgba(99, 102, 241, 0.6)',
    'rgba(99, 102, 241, 0.3)',
  ]
}}

// Flowing particles (1.5s from top to bottom)
animate={{
  y: [0, 48],
  opacity: [0, 1, 0],
}}
```

### State Transition Animations
```typescript
// Smooth fade-in when details update
initial={{ opacity: 0.5 }}
animate={{ opacity: 1 }}
transition={{ duration: 0.3 }}
```

## 🔧 Customization

### Adjust Refresh Rate
In `SessionDetails.tsx`:
```typescript
// Change 500ms to your preferred interval
const interval = setInterval(() => {
  refetch()
}, 500) // ← Adjust this value
```

### Adjust Animation Speed
In `CoroutineTreeGraph.tsx`:
```typescript
// Make icons spin faster
transition={{ duration: 1 }} // ← Was 2

// Make particles flow faster  
transition={{ duration: 1 }} // ← Was 1.5
```

## 🐛 Troubleshooting

### Updates Not Showing?
1. **Check SSE connection**: Look for "Connected ✓" badge
2. **Check auto-refresh**: Look for "🔄 Auto-updating" badge
3. **Check browser console**: Look for errors
4. **Refresh page**: Sometimes helps reset SSE connection

### Animations Laggy?
1. **Reduce refresh rate**: Increase interval from 500ms to 1000ms
2. **Close other tabs**: Reduce browser load
3. **Use Chrome/Firefox**: Best performance
4. **Disable browser extensions**: Some block animations

### SSE Not Connecting?
1. **Check backend**: Ensure it's running on port 8080
2. **Check CORS**: Verify CORS is configured (see `CORS_SETUP.md`)
3. **Check network tab**: Look for `/stream` endpoint
4. **Try different browser**: Rule out browser issues

## 📝 Backend Requirements

Your backend delays should be visible:

```kotlin
// This will show 1.5s of ACTIVE animation
vizDelay(1500)

// This will show 2s of ACTIVE animation  
vizDelay(2000)
```

The frontend will:
1. Show coroutine as ACTIVE when it starts
2. Keep showing ACTIVE state during the delay
3. Update to COMPLETED when the delay finishes
4. All in real-time with smooth animations!

## 🎉 Summary

**Before**: Static snapshot, manual refresh needed  
**After**: Real-time updates, automatic refresh, live animations

**Key Features**:
- ✅ Auto-refresh every 500ms when streaming
- ✅ Event-driven updates on SSE events
- ✅ Live activity counter
- ✅ Smooth state transitions
- ✅ Flowing particles for active coroutines
- ✅ Pulsing glows and spinning icons
- ✅ Efficient re-rendering with keys

**Now your 1.5s and 2s delays will be beautifully visualized in real-time!** 🚀

