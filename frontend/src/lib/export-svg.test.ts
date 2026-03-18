import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { exportToSvg } from './export-svg'

/**
 * Helper that temporarily overrides globalThis.Blob to capture SVG content
 * passed to the Blob constructor during export.
 */
function withSvgCapture(fn: (getSvg: () => string) => void): void {
  let captured = ''
  const origBlob = globalThis.Blob
  globalThis.Blob = class extends origBlob {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(parts?: any[], options?: { type?: string }) {
      super(parts, options)
      if (parts && options?.type?.includes('svg')) {
        captured = parts.map(String).join('')
      }
    }
  } as typeof Blob

  try {
    fn(() => captured)
  } finally {
    globalThis.Blob = origBlob
  }
}

describe('exportToSvg', () => {
  let mockElement: HTMLElement
  let mockLink: { href: string; download: string; click: ReturnType<typeof vi.fn> }
  const originalCreateObjectURL = URL.createObjectURL
  const originalRevokeObjectURL = URL.revokeObjectURL

  beforeEach(() => {
    vi.clearAllMocks()

    // Build a small DOM tree so embedStyles has children to traverse
    mockElement = document.createElement('div')
    mockElement.textContent = 'Hello Coroutines'
    const child = document.createElement('span')
    child.textContent = 'child'
    mockElement.appendChild(child)

    // getBoundingClientRect is not implemented in jsdom — stub it
    vi.spyOn(mockElement, 'getBoundingClientRect').mockReturnValue({
      width: 800,
      height: 600,
      x: 0,
      y: 0,
      top: 0,
      right: 800,
      bottom: 600,
      left: 0,
      toJSON: () => ({}),
    })

    // Mock URL.createObjectURL / revokeObjectURL
    URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-svg-url')
    URL.revokeObjectURL = vi.fn()

    // Mock document.createElement('a') to track the download link
    mockLink = { href: '', download: '', click: vi.fn() }
    const originalCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') return mockLink as unknown as HTMLAnchorElement
      return originalCreateElement(tag)
    })
    vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node)
    vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node)
  })

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL
    URL.revokeObjectURL = originalRevokeObjectURL
    vi.restoreAllMocks()
  })

  it('produces valid SVG with foreignObject, content, and correct dimensions', () => {
    withSvgCapture((getSvg) => {
      exportToSvg(mockElement)

      const svg = getSvg()
      expect(svg).toContain('<svg')
      expect(svg).toContain('<foreignObject')
      expect(svg).toContain('Hello Coroutines')
      expect(svg).toContain('width="800"')
      expect(svg).toContain('height="600"')
      expect(svg).toContain('xmlns="http://www.w3.org/1999/xhtml"')

      const blob = (URL.createObjectURL as ReturnType<typeof vi.fn>).mock.calls[0]![0] as Blob
      expect(blob.type).toBe('image/svg+xml;charset=utf-8')
    })
  })

  it('triggers download with the correct custom filename', () => {
    exportToSvg(mockElement, 'my-diagram.svg')

    expect(mockLink.download).toBe('my-diagram.svg')
    expect(mockLink.click).toHaveBeenCalledOnce()
  })

  it('uses default filename with timestamp when none provided', () => {
    const before = Date.now()
    exportToSvg(mockElement)
    const after = Date.now()

    expect(mockLink.download).toMatch(/^coroutine-viz-\d+\.svg$/)

    const match = mockLink.download.match(/coroutine-viz-(\d+)\.svg/)
    expect(match).not.toBeNull()
    const timestamp = Number(match![1])
    expect(timestamp).toBeGreaterThanOrEqual(before)
    expect(timestamp).toBeLessThanOrEqual(after)
  })

  it('revokes the object URL after download', () => {
    exportToSvg(mockElement)

    expect(URL.createObjectURL).toHaveBeenCalledOnce()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-svg-url')
  })

  it('embeds inline styles on cloned elements', () => {
    withSvgCapture((getSvg) => {
      exportToSvg(mockElement)

      // The root div and its child span should both have inline style attrs
      expect(getSvg()).toContain('style="')
    })
  })
})
