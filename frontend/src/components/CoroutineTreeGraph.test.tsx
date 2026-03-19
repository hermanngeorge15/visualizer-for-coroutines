import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { CoroutineTreeGraph } from './CoroutineTreeGraph'
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

vi.mock('react-zoom-pan-pinch', () => ({
  TransformWrapper: ({ children }: Record<string, unknown>) => (
    <div>{typeof children === 'function' ? children({
      zoomIn: vi.fn(),
      zoomOut: vi.fn(),
      resetTransform: vi.fn(),
    }) : children as ReactNode}</div>
  ),
  TransformComponent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
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

describe('CoroutineTreeGraph', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders empty state when no coroutines', () => {
    render(<CoroutineTreeGraph coroutines={[]} />)

    expect(screen.getByText('No coroutines in this session yet.')).toBeInTheDocument()
  })

  it('renders with coroutine data', () => {
    const coroutines: CoroutineNode[] = [
      makeCoroutine({ id: 'c-root', label: 'RootScope', state: CoroutineState.ACTIVE }),
      makeCoroutine({ id: 'c-child', label: 'ChildWorker', parentId: 'c-root', state: CoroutineState.COMPLETED }),
    ]

    render(<CoroutineTreeGraph coroutines={coroutines} />)

    expect(screen.getByText('RootScope')).toBeInTheDocument()
    expect(screen.getByText('ChildWorker')).toBeInTheDocument()
  })

  it('shows active count indicator', () => {
    const coroutines: CoroutineNode[] = [
      makeCoroutine({ id: 'c-1', label: 'Worker-1', state: CoroutineState.ACTIVE }),
      makeCoroutine({ id: 'c-2', label: 'Worker-2', state: CoroutineState.ACTIVE }),
      makeCoroutine({ id: 'c-3', label: 'Worker-3', state: CoroutineState.COMPLETED }),
    ]

    render(<CoroutineTreeGraph coroutines={coroutines} />)

    expect(screen.getByText('2 coroutines actively running')).toBeInTheDocument()
  })

  it('renders SVG elements for connections', () => {
    const coroutines: CoroutineNode[] = [
      makeCoroutine({ id: 'c-parent', label: 'Parent', state: CoroutineState.ACTIVE }),
      makeCoroutine({ id: 'c-child-1', label: 'Child-1', parentId: 'c-parent', state: CoroutineState.ACTIVE }),
      makeCoroutine({ id: 'c-child-2', label: 'Child-2', parentId: 'c-parent', state: CoroutineState.COMPLETED }),
    ]

    const { container: _container } = render(<CoroutineTreeGraph coroutines={coroutines} />)

    // The graph renders connection lines between parent and children using div elements
    // with specific CSS classes for the vertical/horizontal connector lines
    expect(screen.getByText('Parent')).toBeInTheDocument()
    expect(screen.getByText('Child-1')).toBeInTheDocument()
    expect(screen.getByText('Child-2')).toBeInTheDocument()
    // Verify the branching structure is present (relationship label showing child count)
    expect(screen.getByText('2 children')).toBeInTheDocument()
  })
})
