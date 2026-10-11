# @jolly-pixel/editor.voxel-map ROADMAP

Open work, in the order it should land. Each step ends with
`pnpm --filter @jolly-pixel/editor.voxel-map test`, `pnpm run typecheck` and
`pnpm run lint` green, plus the painting e2e suites
(`pnpm --filter @jolly-pixel/editor.voxel-map test:e2e test/e2e/painting.e2e.ts test/e2e/mergedCells.e2e.ts`)
when the step changes how the brush behaves. Rebuild
`@jolly-pixel/voxel.renderer` first when a step touches it, and
`@jolly-pixel/asset.voxel-map` when it touches the network code: the e2e
back-end loads its `dist/`.

## Merged cells

Two complementary shapes can share a cell (phase 1, 2026-10-05), and each
shape can be aimed at on its own at brush size 1 (phase 2, 2026-10-05): a
right click removes the aimed shape, Ctrl+click picks it, Replace repaints it,
and a red overlay shows the shape a right click removes. The aimed shape comes
from `view.pickVoxelPart()`, see the renderer's
[merged cells](../../voxel-renderer/docs/api/world/VoxelWorld.md#merged-cells)
section. Strokes and larger brushes still treat a merged cell as a whole.

Open points:

- **Strokes.** A dragged stroke crosses cells whose halves face different
  ways, and "the same half" has no clear meaning there. Only the cell a
  stroke starts on is split. Revisit if users ask for it.
- **Pick highlight.** The removal overlay also shows while Ctrl is held, in
  the removal tint, although Ctrl+click picks rather than removes.

## Engine follow-ups

- **Mesh build A/B.** Phase 1 added a merged-bit check per voxel in
  `ChunkMesher` and per neighbour lookup in `ChunkNeighbourhood`. Not measured
  yet. Run `bench/mesh-build.bench.ts` against a baseline worktree at the
  commit before merged cells, on a world without merged cells.
- **Partial face splitting.** A face next to a merged cell is culled when the
  combined occluder covers it, and kept whole otherwise. A face half-covered
  by an opaque shape and half by a see-through one is drawn whole. Correct,
  slightly more overdraw; only worth splitting if profiling points at it.

## Not planned

- **Pairs that do not fill the cell**, such as a pole through a slab. The
  storage takes any pair and the view draws it, but `canMergeVoxelPart()` refuses it,
  and there is no rule yet for overlapping shapes or for which faces to hide.
- **More than two shapes per cell.** The partner store holds one extra shape
  per cell.
- **Peer cursors.** Presence shares the brush footprint, a whole-cell outline.
  Peers do not need to see which half another user aims at.
