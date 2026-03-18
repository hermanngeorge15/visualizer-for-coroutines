/**
 * Exports an HTML element as a self-contained SVG file using foreignObject.
 *
 * Computed styles are embedded inline on every element so the exported SVG
 * renders correctly without external stylesheets.
 */

/**
 * Properties that are safe to skip when embedding inline styles because they
 * match the default or have no visual impact inside a foreignObject wrapper.
 */
const SKIP_PROPERTIES = new Set([
  'animation',
  'animation-delay',
  'animation-direction',
  'animation-duration',
  'animation-fill-mode',
  'animation-iteration-count',
  'animation-name',
  'animation-play-state',
  'animation-timing-function',
  'transition',
  'transition-delay',
  'transition-duration',
  'transition-property',
  'transition-timing-function',
])

/**
 * Recursively embeds computed styles as inline style attributes on every
 * Element node in the cloned DOM tree.
 */
function embedStyles(
  original: Element,
  clone: Element,
  win: Window,
): void {
  const computed = win.getComputedStyle(original)
  let styleText = ''
  for (let i = 0; i < computed.length; i++) {
    const prop = computed[i]!
    if (SKIP_PROPERTIES.has(prop)) continue
    styleText += `${prop}:${computed.getPropertyValue(prop)};`
  }
  clone.setAttribute('style', styleText)

  const origChildren = original.children
  const cloneChildren = clone.children
  for (let i = 0; i < origChildren.length; i++) {
    const origChild = origChildren[i]
    const cloneChild = cloneChildren[i]
    if (origChild && cloneChild) {
      embedStyles(origChild, cloneChild, win)
    }
  }
}

/**
 * Serialises a cloned element tree into an SVG string that wraps the HTML
 * content in a `<foreignObject>`.
 */
function buildSvgString(clone: Element, width: number, height: number): string {
  clone.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml')
  const serializer = new XMLSerializer()
  const htmlString = serializer.serializeToString(clone)

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`,
    `<foreignObject width="100%" height="100%">`,
    htmlString,
    `</foreignObject>`,
    `</svg>`,
  ].join('\n')
}

/**
 * Triggers a file download in the browser by creating a temporary anchor
 * element.
 */
function triggerDownload(svgContent: string, filename: string): void {
  const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  try {
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * Captures an HTML element as a self-contained SVG file and triggers a
 * download.
 *
 * The exported SVG uses a `<foreignObject>` to embed the HTML content with
 * all computed styles inlined, making the file completely self-contained.
 *
 * @param element - The HTML element to export
 * @param filename - Optional filename (defaults to `coroutine-viz-{timestamp}.svg`)
 */
export function exportToSvg(element: HTMLElement, filename?: string): void {
  const resolvedFilename =
    filename ?? `coroutine-viz-${Date.now()}.svg`

  const rect = element.getBoundingClientRect()
  const clone = element.cloneNode(true) as Element

  embedStyles(element, clone, window)

  const svgString = buildSvgString(clone, rect.width, rect.height)
  triggerDownload(svgString, resolvedFilename)
}
