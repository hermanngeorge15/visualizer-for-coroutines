import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useReplay } from './use-replay'
import type { VizEvent } from '@/types/api'

function createMockEvent(seq: number, tsNanos: number): VizEvent {
  return {
    sessionId: 'session-1',
    seq,
    tsNanos,
    kind: 'coroutine.created',
    coroutineId: `coro-${seq}`,
    jobId: `job-${seq}`,
    parentCoroutineId: null,
    scopeId: 'scope-1',
    label: `event-${seq}`,
  }
}

function createMockEvents(count: number, intervalNanos: number = 10_000_000): VizEvent[] {
  const base = 1_000_000_000
  return Array.from({ length: count }, (_, i) =>
    createMockEvent(i, base + i * intervalNanos)
  )
}

describe('useReplay', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('initialises at index 0 with correct defaults', () => {
    const events = createMockEvents(5)
    const { result } = renderHook(() => useReplay(events))

    expect(result.current.isPlaying).toBe(false)
    expect(result.current.currentIndex).toBe(0)
    expect(result.current.currentEvent).toBe(events[0])
    expect(result.current.speed).toBe(1)
    expect(result.current.progress).toBe(0)
    expect(result.current.visibleEvents).toEqual([events[0]])
    expect(result.current.totalEvents).toBe(5)
  })

  it('handles empty events array', () => {
    const { result } = renderHook(() => useReplay([]))

    expect(result.current.isPlaying).toBe(false)
    expect(result.current.currentIndex).toBe(0)
    expect(result.current.currentEvent).toBeNull()
    expect(result.current.progress).toBe(0)
    expect(result.current.visibleEvents).toEqual([])
    expect(result.current.totalEvents).toBe(0)
  })

  describe('play / pause', () => {
    it('toggles play state', () => {
      const events = createMockEvents(5)
      const { result } = renderHook(() => useReplay(events))

      act(() => result.current.play())
      expect(result.current.isPlaying).toBe(true)

      act(() => result.current.pause())
      expect(result.current.isPlaying).toBe(false)
    })

    it('auto-advances through events during playback', () => {
      // 10ms interval between events at speed=1
      const events = createMockEvents(4, 10_000_000)
      const { result } = renderHook(() => useReplay(events))

      act(() => result.current.play())
      expect(result.current.currentIndex).toBe(0)

      // Advance past the first interval (10ms)
      act(() => { vi.advanceTimersByTime(15) })
      expect(result.current.currentIndex).toBe(1)

      // Advance past the second interval
      act(() => { vi.advanceTimersByTime(15) })
      expect(result.current.currentIndex).toBe(2)
    })

    it('stops at the last event', () => {
      const events = createMockEvents(3, 10_000_000)
      const { result } = renderHook(() => useReplay(events))

      act(() => result.current.play())

      // Advance past first interval
      act(() => { vi.advanceTimersByTime(15) })
      expect(result.current.currentIndex).toBe(1)

      // Advance past second interval to reach end
      act(() => { vi.advanceTimersByTime(15) })
      expect(result.current.currentIndex).toBe(2)
      expect(result.current.isPlaying).toBe(false)
    })

    it('does not play when events are empty', () => {
      const { result } = renderHook(() => useReplay([]))

      act(() => result.current.play())
      expect(result.current.isPlaying).toBe(false)
    })

    it('restarts from beginning when play is called at end', () => {
      const events = createMockEvents(3, 10_000_000)
      const { result } = renderHook(() => useReplay(events))

      // Seek to end
      act(() => result.current.seekTo(2))
      expect(result.current.currentIndex).toBe(2)

      // Play should restart from 0
      act(() => result.current.play())
      expect(result.current.currentIndex).toBe(0)
      expect(result.current.isPlaying).toBe(true)
    })
  })

  describe('stepForward / stepBack', () => {
    it('steps forward one event', () => {
      const events = createMockEvents(5)
      const { result } = renderHook(() => useReplay(events))

      act(() => result.current.stepForward())
      expect(result.current.currentIndex).toBe(1)
      expect(result.current.currentEvent).toBe(events[1])
    })

    it('does not step past the last event', () => {
      const events = createMockEvents(3)
      const { result } = renderHook(() => useReplay(events))

      act(() => result.current.seekTo(2))
      act(() => result.current.stepForward())
      expect(result.current.currentIndex).toBe(2)
    })

    it('steps back one event', () => {
      const events = createMockEvents(5)
      const { result } = renderHook(() => useReplay(events))

      act(() => result.current.seekTo(3))
      act(() => result.current.stepBack())
      expect(result.current.currentIndex).toBe(2)
      expect(result.current.currentEvent).toBe(events[2])
    })

    it('does not step before the first event', () => {
      const events = createMockEvents(3)
      const { result } = renderHook(() => useReplay(events))

      act(() => result.current.stepBack())
      expect(result.current.currentIndex).toBe(0)
    })

    it('stops playback when stepping', () => {
      const events = createMockEvents(5, 10_000_000)
      const { result } = renderHook(() => useReplay(events))

      act(() => result.current.play())
      expect(result.current.isPlaying).toBe(true)

      act(() => result.current.stepForward())
      expect(result.current.isPlaying).toBe(false)
    })
  })

  describe('reset', () => {
    it('resets to index 0 and stops playback', () => {
      const events = createMockEvents(5, 10_000_000)
      const { result } = renderHook(() => useReplay(events))

      act(() => result.current.seekTo(3))
      act(() => result.current.play())
      expect(result.current.isPlaying).toBe(true)

      act(() => result.current.reset())
      expect(result.current.currentIndex).toBe(0)
      expect(result.current.isPlaying).toBe(false)
      expect(result.current.progress).toBe(0)
    })
  })

  describe('seekTo', () => {
    it('jumps to a specific index', () => {
      const events = createMockEvents(10)
      const { result } = renderHook(() => useReplay(events))

      act(() => result.current.seekTo(7))
      expect(result.current.currentIndex).toBe(7)
      expect(result.current.currentEvent).toBe(events[7])
    })

    it('clamps to valid range', () => {
      const events = createMockEvents(5)
      const { result } = renderHook(() => useReplay(events))

      act(() => result.current.seekTo(100))
      expect(result.current.currentIndex).toBe(4)

      act(() => result.current.seekTo(-5))
      expect(result.current.currentIndex).toBe(0)
    })

    it('stops playback when seeking', () => {
      const events = createMockEvents(5, 10_000_000)
      const { result } = renderHook(() => useReplay(events))

      act(() => result.current.play())
      act(() => result.current.seekTo(3))
      expect(result.current.isPlaying).toBe(false)
    })
  })

  describe('speed', () => {
    it('defaults to 1x speed', () => {
      const events = createMockEvents(3)
      const { result } = renderHook(() => useReplay(events))

      expect(result.current.speed).toBe(1)
    })

    it('changes speed', () => {
      const events = createMockEvents(3)
      const { result } = renderHook(() => useReplay(events))

      act(() => result.current.setSpeed(2))
      expect(result.current.speed).toBe(2)

      act(() => result.current.setSpeed(0.5))
      expect(result.current.speed).toBe(0.5)
    })

    it('advances faster at higher speed', () => {
      // 100ms intervals at speed=1
      const events = createMockEvents(4, 100_000_000)
      const { result } = renderHook(() => useReplay(events))

      act(() => result.current.setSpeed(5))
      act(() => result.current.play())

      // At 5x speed, 100ms interval becomes 20ms; advance 25ms
      act(() => { vi.advanceTimersByTime(25) })
      expect(result.current.currentIndex).toBe(1)
    })
  })

  describe('visibleEvents', () => {
    it('returns events up to and including currentIndex', () => {
      const events = createMockEvents(5)
      const { result } = renderHook(() => useReplay(events))

      expect(result.current.visibleEvents).toEqual([events[0]])

      act(() => result.current.seekTo(2))
      expect(result.current.visibleEvents).toEqual([events[0], events[1], events[2]])

      act(() => result.current.seekTo(4))
      expect(result.current.visibleEvents).toEqual(events)
    })
  })

  describe('progress', () => {
    it('returns 0 at the beginning', () => {
      const events = createMockEvents(5)
      const { result } = renderHook(() => useReplay(events))

      expect(result.current.progress).toBe(0)
    })

    it('returns 1 at the end', () => {
      const events = createMockEvents(5)
      const { result } = renderHook(() => useReplay(events))

      act(() => result.current.seekTo(4))
      expect(result.current.progress).toBe(1)
    })

    it('returns fractional values in between', () => {
      const events = createMockEvents(5) // indices 0-4
      const { result } = renderHook(() => useReplay(events))

      act(() => result.current.seekTo(2))
      expect(result.current.progress).toBe(0.5)
    })

    it('returns 0 for single event', () => {
      const events = createMockEvents(1)
      const { result } = renderHook(() => useReplay(events))

      expect(result.current.progress).toBe(0)
    })
  })
})
