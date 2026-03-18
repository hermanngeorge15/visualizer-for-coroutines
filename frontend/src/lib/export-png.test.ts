import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock html2canvas before importing the module under test
const mockToBlob = vi.fn()
const mockCanvas = { toBlob: mockToBlob }
const mockHtml2Canvas = vi.fn().mockResolvedValue(mockCanvas)

vi.mock('html2canvas', () => ({
  default: mockHtml2Canvas,
}))

// Must import after vi.mock
const { exportToPng } = await import('./export-png')

describe('exportToPng', () => {
  let mockElement: HTMLElement
  let mockLink: { href: string; download: string; click: ReturnType<typeof vi.fn> }
  const originalCreateObjectURL = URL.createObjectURL
  const originalRevokeObjectURL = URL.revokeObjectURL

  beforeEach(() => {
    vi.clearAllMocks()

    mockElement = document.createElement('div')

    // Mock URL.createObjectURL / revokeObjectURL
    URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url')
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

    // Default: toBlob succeeds
    mockToBlob.mockImplementation((cb: (blob: Blob | null) => void) => {
      cb(new Blob(['fake-png'], { type: 'image/png' }))
    })
  })

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL
    URL.revokeObjectURL = originalRevokeObjectURL
    vi.restoreAllMocks()
  })

  it('calls html2canvas with the provided element', async () => {
    await exportToPng(mockElement)

    expect(mockHtml2Canvas).toHaveBeenCalledWith(mockElement, {
      backgroundColor: '#18181b',
      scale: 2,
      useCORS: true,
      logging: false,
    })
  })

  it('triggers download with the correct custom filename', async () => {
    await exportToPng(mockElement, 'my-export.png')

    expect(mockLink.download).toBe('my-export.png')
    expect(mockLink.click).toHaveBeenCalledOnce()
  })

  it('uses default filename with timestamp when none provided', async () => {
    const before = Date.now()
    await exportToPng(mockElement)
    const after = Date.now()

    expect(mockLink.download).toMatch(/^coroutine-viz-\d+\.png$/)

    // Extract the timestamp from the filename
    const match = mockLink.download.match(/coroutine-viz-(\d+)\.png/)
    expect(match).not.toBeNull()
    const timestamp = Number(match![1])
    expect(timestamp).toBeGreaterThanOrEqual(before)
    expect(timestamp).toBeLessThanOrEqual(after)
  })

  it('revokes the object URL after download', async () => {
    await exportToPng(mockElement)

    expect(URL.createObjectURL).toHaveBeenCalledOnce()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
  })

  it('throws when canvas.toBlob produces null', async () => {
    mockToBlob.mockImplementation((cb: (blob: Blob | null) => void) => {
      cb(null)
    })

    await expect(exportToPng(mockElement)).rejects.toThrow(
      'Failed to create PNG blob from canvas'
    )
  })
})
