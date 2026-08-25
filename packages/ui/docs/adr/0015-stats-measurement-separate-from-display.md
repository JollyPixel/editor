---
status: accepted
---

# Measurement is separate from display, and `./stats` is DOM-free

`StatsRecorder` is a plain class — no DOM, no Lit, no element — owning frame timing, the refresh
window and one ring buffer per metric; `jolly-stats` subscribes and renders snapshots. It keeps
stats.js's `begin()` and `end()` names so `Runtime.ts` call sites are unchanged, is unit-testable
with a fake clock, and is usable headlessly from `voxel-renderer/bench`.

The `./stats` subpath exports the recorder alone, so `runtime` can drop its `stats.js` dependency and
import the recorder dynamically behind `includePerformanceStats` without pulling Lit into a game
bundle. `jolly-stats` matches stats.js's footprint: one metric at a time in an 80x48 tile, canvas
rendered, click to advance.

## Considered Options

- **`begin()` and `end()` on the element.** Timing state inside a Lit element cannot be tested
  without a DOM and cannot be reused by `bench/`.
- **Tweakpane-style monitor rows for the HUD.** A graph plus seven rows costs about fifteen times
  stats.js's area for the same information — the layout four existing readouts already duplicate.
- **An expandable or stacked HUD.** Rejected in favour of strict stats.js parity.
- **DOM or SVG per sample.** Layout thrash at sixty frames per second.
- **Sampling only the visible metric.** Cycling would reveal an empty graph, so every registered
  metric is sampled every window.
- **Keeping stats.js in `runtime`.** Its inline styles are already fought with
  `removeAttribute("style")` and cannot be themed.

## Consequences

Two metrics cannot be correlated visually, and a consumer registering ten metrics creates a ten-stop
cycle. A full readout of every metric at once is a pane of `jolly-monitor` rows, which is what keeps
this component from drifting back into the layout it replaces.

Canvas cannot read custom properties, so theme tokens are resolved through `getComputedStyle` on
connect and re-resolved when the theme or colour scheme changes.
