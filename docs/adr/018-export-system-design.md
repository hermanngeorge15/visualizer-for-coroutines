# ADR-018: Export System Design

## Status
Accepted

## Date
2026-03-18

## Context
Users want to share visualizations in presentations, documentation, and bug reports. Currently there is no way to export any panel's visual output. Engineers frequently need to capture coroutine execution traces to communicate concurrency issues to teammates who may not have access to the visualizer.

## Decision
Implement a three-tier export system, all operating client-side. Add an `ExportMenu` dropdown to the `SessionDetails` toolbar and per-panel export buttons.

### Tier 1: PNG Export
Capture any panel's DOM subtree as a raster image.

- Use `html2canvas` library to render a DOM element to a Canvas
- Apply a white background and padding for clean output
- Include a header with session name, timestamp, and event count
- Download as `{session-name}-{panel}-{timestamp}.png`

```typescript
async function exportToPng(element: HTMLElement, filename: string) {
  const canvas = await html2canvas(element, {
    backgroundColor: '#ffffff',
    scale: 2, // retina quality
    useCORS: true,
  });
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/png');
  link.click();
}
```

### Tier 2: SVG Export
Serialize the graph-based views (CoroutineTreeGraph) as standalone SVG files.

- Clone the SVG DOM element
- Inline all computed styles (Tailwind classes are not portable)
- Embed font references as data URIs or fall back to system fonts
- Add metadata: session ID, export timestamp, event range
- Download as `{session-name}-graph-{timestamp}.svg`

SVG export is only available for panels that render SVG natively (tree graph, flow operator chain). DOM-based panels fall back to PNG.

### Tier 3: Video/GIF Export
Record a replay session as a video file using the browser's MediaRecorder API.

- User enters "record mode" which starts a replay (ADR-017) and captures the canvas
- `captureStream()` on a canvas element feeds into `MediaRecorder`
- Output format: WebM (VP8/VP9) — universally supported by MediaRecorder
- Recording controls: start/stop, with a red recording indicator
- Download as `{session-name}-replay-{timestamp}.webm`

```typescript
function startRecording(canvas: HTMLCanvasElement): MediaRecorder {
  const stream = canvas.captureStream(30); // 30 fps
  const recorder = new MediaRecorder(stream, {
    mimeType: 'video/webm;codecs=vp9',
    videoBitsPerSecond: 2_500_000,
  });
  // collect chunks, assemble Blob on stop
  return recorder;
}
```

### ExportMenu Component
Dropdown in the `SessionDetails` toolbar:

```
[Export v]
  ├─ Export Current View as PNG
  ├─ Export Graph as SVG
  ├─ Export All Events as JSON
  ├─ ──────────────
  └─ Record Replay as Video
```

JSON export is a bonus — serializes the raw event array as a formatted JSON file for offline analysis or re-import.

### Per-Panel Export Buttons
Each panel (`CoroutineTree`, `ThreadLanesView`, `EventsList`, etc.) gets a small export icon button in its header. Clicking it exports that specific panel as PNG.

### User Feedback
- Show a toast notification on successful export ("Exported coroutine-tree.png")
- Show a loading spinner during html2canvas rendering (can take 1-2s for large panels)
- Show an error toast if export fails (e.g., SecurityError on tainted canvas)

## Alternatives Considered

### Server-Side Rendering with Puppeteer
Run a headless browser on the server to generate screenshots. This produces pixel-perfect output but requires a Puppeteer/Playwright dependency on the server, significant memory overhead, and added infrastructure complexity. Not justified when client-side rendering is sufficient.

### PDF Export
PDF is useful for documents but poorly suited for interactive visualizations. Embedding SVGs in PDF loses interactivity, and rasterizing to PDF offers no advantage over PNG. If needed later, a PDF can wrap exported PNGs.

### Clipboard API (Copy to Clipboard)
Copying images to the clipboard is useful but browser support is inconsistent (especially for SVG). Added as a future enhancement alongside download, not a replacement.

## Consequences

### Positive
- Users can share visualizations without requiring recipients to run the tool
- PNG export works for any panel regardless of rendering technology
- SVG export produces resolution-independent, editable vector graphics
- Video export combined with replay creates shareable debugging walkthroughs
- JSON export enables offline analysis and data portability
- All exports are client-side, adding zero backend load

### Negative
- `html2canvas` has known limitations: CSS filters, transforms, and some pseudo-elements may not render correctly
- SVG style inlining is fragile — Tailwind class changes require updating the inlining logic
- Video export requires canvas-based rendering, which may not work for all panel types (DOM-only panels need an intermediate canvas step)
- Large panels or high-DPI exports may consume significant memory temporarily
- WebM format is not natively playable on all platforms (iOS Safari) — users may need to convert to MP4

## Related
- ADR-017: Replay Engine Design (video export depends on replay)
- ADR-011: Animation System Design (exported PNGs capture a single animation frame)
