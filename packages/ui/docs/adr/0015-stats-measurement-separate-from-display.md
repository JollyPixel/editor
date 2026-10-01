---
status: accepted
---

# Measurement is separate from display, `./stats` is DOM-free, and metric sources are structural

`StatsRecorder` is a plain class — no DOM, no Lit, no element — owning frame timing, the refresh
window and one ring buffer per metric; `jolly-stats` subscribes and renders snapshots. It keeps
stats.js's `begin()` and `end()` names so `Runtime.ts` call sites are unchanged, is unit-testable
with a fake clock, and is usable headlessly from `voxel-renderer/bench`.

The `./stats` subpath exports the recorder alone, so `runtime` can drop its `stats.js` dependency and
import the recorder dynamically behind `includePerformanceStats` without pulling Lit into a game
bundle. `jolly-stats` matches stats.js's footprint: one metric at a time in a small tile, canvas
rendered, click to advance.

`MetricSource` is `{ readonly metrics: readonly MetricDefinition[] }`, and a source satisfies it by
shape. `VoxelInspector` describes what it counts without `@jolly-pixel/voxel.renderer` depending on
`ui`, the way `THREE.Vector3` satisfies `Vec3Like` in [ADR-0021](./0021-structural-math-types.md).
Each such package declares its own descriptor and pins the compatibility with a type test, against
the `ui` it already has as a dev dependency. `MetricDefinition.unit` exists for the same reason:
`format: formatMilliseconds` would force the author to import a formatter from `ui`, while
`unit: "ms"` leaves that to the display. `format` still wins where the units do not cover a case.

`group` and `tile` let a full readout build its folders and rows from the definitions alone.
`tile: false` keeps a readout metric out of the one-at-a-time cycle.

## Considered Options

- **`begin()` and `end()` on the element.** Timing state inside a Lit element cannot be tested
  without a DOM and cannot be reused by `bench/`.
- **Tweakpane-style monitor rows for the HUD.** A graph plus seven rows costs about fifteen times
  stats.js's area for the same information — the layout four existing readouts already duplicate.
- **DOM or SVG per sample.** Layout thrash at sixty frames per second.
- **Sampling only the visible metric.** Cycling would reveal an empty graph, so every registered
  metric is sampled every window.
- **Keeping stats.js in `runtime`.** Its inline styles are already fought with
  `removeAttribute("style")` and cannot be themed.
- **Importing `MetricDefinition` where sources live.** `voxel-renderer` publishes a renderer; a peer
  dependency on a Lit UI package to name a number is a cost its consumers pay for nothing.
- **Moving the recorder to a leaf package.** Makes the import honest, but moves a published API and
  buys nothing the structural contract does not.
- **Formatting from the unit alone.** `formatCount` and `formatInteger` differ only in grouping, so
  units name formatters rather than describing quantities exactly.

## Consequences

Two metrics cannot be correlated visually on the tile. A full readout of every metric at once is a
pane of `jolly-monitor` rows, which is what keeps this component from drifting back into the layout
it replaces.

Canvas cannot read custom properties, so theme tokens are resolved through `getComputedStyle` on
connect and re-resolved when the theme or colour scheme changes.

Packages declaring a structurally compatible descriptor break silently when a required field is
added here. Their type tests make that a failure in their own suite; a new optional field stays
free.
