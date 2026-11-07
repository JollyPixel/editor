# @jolly-pixel/utils ROADMAP

Work left after the first slice (2026-11-07). Runtime depends on this package,
directly and through `@jolly-pixel/ui`. Engine, its dependencies and the
renderers stay out.

## Teardown

Two classes share the name and do different things:

- asset-server `src/common/Teardown.ts` runs async steps in reverse, collects
  failures into an `AggregateError`, and has `unwind(error)` to rethrow after
  cleanup.
- editor.host `src/contract/Teardown.ts` runs sync steps in reverse and exposes
  an `AbortSignal`. editor.model and editor.scene import it from
  `@jolly-pixel/editor.host` only for this class.

Decide between one class with both behaviors, two classes, or the native
`DisposableStack` / `AsyncDisposableStack`. Node.js 24 has both; check browser
support before relying on them in the host.

## Error messages outside the first slice

Console (5 sites), lantern (1) and controls (1) still inline
`error instanceof Error ? error.message : String(error)`. Console and lantern
can switch to `errorMessage`. Controls is an engine dependency, so it stays
out.

Two variants are left alone on purpose: editor.model `ModelPreview` appends the
`cause` message, and studio `SignInDialog` maps account errors to its own
copy.

## Hand-written parsers

`asset.voxel-model` `materialTransfer.ts` parses clipboard JSON with a chain of
`is.plainObject` and `typeof` checks. The workspace already depends on zod, so
a schema with `safeParse` should replace the chain. Shape guards such as
voxel-map `isVoxelCoord` (`BrushFootprint.ts`) and `isCellCoord`
(`CellRegion.ts`) are the same pattern.

## Inline clamps

28 `Math.min(Math.max(...))` expressions in 23 files across the in-scope
workspaces do what `clamp` does. Convert them file by file, checking the
argument order of each.

## Candidates with a single consumer today

Move these when a second workspace needs them:

- `contentHash` (SHA-256 to hex) and `yieldToEventLoop`, asset-server
  `src/common/`.
- `randomId` and `NameSet`, asset.common `src/text/`. Moving both empties that
  folder and leaves asset.common with the ordered tree only.
- `LatestFrameThrottle` (editor.voxel-model) and `ResyncThrottle` (network,
  keyed by client). Both are trailing-edge throttles; a shared primitive would
  need to cover the keyed case.

## Smaller duplicates

- editor.pixel-art `src/shared/dom.ts` redefines `isInputElement`, which
  `@jolly-pixel/ui` already exports.
- pixel-draw-renderer keeps its own `src/utils/base64.ts`. It is a renderer,
  so it keeps the copy unless the dependency rule for renderers changes.
