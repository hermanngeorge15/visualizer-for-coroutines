import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { CoroutineTree } from './CoroutineTree'
import type { CoroutineNode } from '@/types/api'
import { CoroutineState } from '@/types/api'

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: Record<string, unknown>) => <div {...props}>{children as ReactNode}</div>,
    span: ({ children, ...props }: Record<string, unknown>) => <span {...props}>{children as ReactNode}</span>,
  },
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
  LayoutGroup: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock('@/lib/animation-throttle', () => ({
  useAnimationSlot: () => false,
}))

function makeCoroutine(overrides: Partial<CoroutineNode> = {}): CoroutineNode {
  return {
    id: 'c-1',
    jobId: 'j-1',
    parentId: null,
    scopeId: 'scope-1',
    label: 'TestCoroutine',
    state: CoroutineState.ACTIVE,
    ...overrides,
  }
}

describe('CoroutineTree', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders empty state when no coroutines', () => {
    render(<CoroutineTree coroutines={[]} />)

    expect(screen.getByText('No coroutines in this session yet.')).toBeInTheDocument()
  })

  it('renders coroutine nodes with labels', () => {
    const coroutines: CoroutineNode[] = [
      makeCoroutine({ id: 'c-1', label: 'ParentScope' }),
    ]

    render(<CoroutineTree coroutines={coroutines} />)

    expect(screen.getByText('ParentScope')).toBeInTheDocument()
  })

  it('renders state chips for each coroutine', () => {
    const coroutines: CoroutineNode[] = [
      makeCoroutine({ id: 'c-1', label: 'Worker-1', state: CoroutineState.ACTIVE }),
      makeCoroutine({ id: 'c-2', label: 'Worker-2', state: CoroutineState.COMPLETED }),
    ]

    render(<CoroutineTree coroutines={coroutines} />)

    expect(screen.getByText('ACTIVE')).toBeInTheDocument()
    expect(screen.getByText('COMPLETED')).toBeInTheDocument()
  })

  it('renders nested tree with indentation', () => {
    const coroutines: CoroutineNode[] = [
      makeCoroutine({ id: 'c-parent', label: 'Parent', parentId: null }),
      makeCoroutine({ id: 'c-child', label: 'Child', parentId: 'c-parent' }),
    ]

    render(<CoroutineTree coroutines={coroutines} />)

    expect(screen.getByText('Parent')).toBeInTheDocument()
    expect(screen.getByText('Child')).toBeInTheDocument()
  })

  it('shows waiting indicator for WAITING_FOR_CHILDREN state', () => {
    const coroutines: CoroutineNode[] = [
      makeCoroutine({
        id: 'c-parent',
        label: 'WaitingParent',
        state: CoroutineState.WAITING_FOR_CHILDREN,
      }),
      makeCoroutine({
        id: 'c-child',
        label: 'ActiveChild',
        parentId: 'c-parent',
        state: CoroutineState.ACTIVE,
      }),
    ]

    render(<CoroutineTree coroutines={coroutines} />)

    expect(screen.getByText('WAITING_FOR_CHILDREN')).toBeInTheDocument()
    expect(screen.getByText(/Waiting for.*child coroutine/)).toBeInTheDocument()
  })

  it('shows failure indicator for FAILED state', () => {
    const coroutines: CoroutineNode[] = [
      makeCoroutine({
        id: 'c-fail',
        label: 'FailedWorker',
        state: CoroutineState.FAILED,
      }),
    ]

    render(<CoroutineTree coroutines={coroutines} />)

    expect(screen.getByText('FAILED')).toBeInTheDocument()
    expect(screen.getByText('Coroutine Failed')).toBeInTheDocument()
    expect(
      screen.getByText(/Exception thrown.*will cancel parent and siblings/),
    ).toBeInTheDocument()
  })
})
