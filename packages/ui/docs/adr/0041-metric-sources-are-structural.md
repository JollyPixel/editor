---
status: accepted
---

# A metric source is structural, and `unit` replaces an imported formatter

`MetricSource` is `{ readonly metrics: readonly MetricDefinition[] }`, and a source satisfies it by
shape. `VoxelInspector` describes what it counts without `@jolly-pixel/voxel.renderer` depending on
`ui`, the way `THREE.Vector3` satisfies `Vec3Like` in [ADR-0021](./0021-structural-math-types.md).
Each such package declares its own descriptor and pins the compatibility with a type test, against
the `ui` it already has as a dev dependency.

`MetricDefinition.unit` exists for the same reason. A definition carrying `format:
formatMilliseconds` forces its author to import a formatter from `ui`; naming `unit: "ms"` leaves
that to the display, and `resolveMetricFormat()` resolves it. `format` still wins where a consumer
wants something the units do not cover.

`group` and `tile` are the other half: a definition already knows its label and its units, so a full
readout builds its folders and rows from the definitions alone rather than from a table restating
them. `tile: false` keeps a readout metric out of the one-at-a-time cycle, which would otherwise
grow a stop per registered metric, as
[ADR-0015](./0015-stats-measurement-separate-from-display.md) predicted.

## Considered Options

- **Importing `MetricDefinition` where sources live.** `voxel-renderer` publishes a renderer; a peer
  dependency on a Lit UI package to name a number is a cost its consumers pay for nothing.
- **Moving the recorder to a leaf package.** `loop` or a new `metrics` workspace would make the
  import honest, but moves a published API and buys nothing the structural contract does not.
- **A `MetricSource` carrying its own id, namespacing metric ids.** Nothing needed it yet: a
  collision throws on registration, naming the id, which is a build-time mistake rather than a
  runtime condition.
- **Formatting from the unit alone.** `formatCount` and `formatInteger` differ only in grouping, and
  the built-in metrics want the second inside a 112x56 tile. Units name formatters rather than
  describing quantities exactly.

## Consequences

Two packages now declare a descriptor structurally compatible with `MetricDefinition`, and a
required field added here breaks them silently at their next build rather than at ours. The type
tests make that a failure in their own suite, and a new optional field remains free.

`resolveMetricFormat()` falls back to `formatInteger`, which is what `jolly-stats` did for a
definition carrying no `format`, so the tile renders unchanged.
