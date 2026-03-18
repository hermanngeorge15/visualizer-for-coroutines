import html2canvas from 'html2canvas'

/**
 * Captures an HTML element as a PNG image and triggers a download.
 *
 * @param elementRef - The HTML element to capture
 * @param filename - Optional filename (defaults to `coroutine-viz-{timestamp}.png`)
 */
export async function exportToPng(
  elementRef: HTMLElement,
  filename?: string
): Promise<void> {
  const resolvedFilename =
    filename ?? `coroutine-viz-${Date.now()}.png`

  const canvas = await html2canvas(elementRef, {
    backgroundColor: '#18181b',
    scale: 2,
    useCORS: true,
    logging: false,
  })

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) {
        resolve(b)
      } else {
        reject(new Error('Failed to create PNG blob from canvas'))
      }
    }, 'image/png')
  })

  const url = URL.createObjectURL(blob)
  try {
    const link = document.createElement('a')
    link.href = url
    link.download = resolvedFilename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } finally {
    URL.revokeObjectURL(url)
  }
}
