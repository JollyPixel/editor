# Voxel-map scenario

One headed Playwright test builds a house, from a blank offline map to the
finished build. It needs Google Chrome and does not run in CI. The runner and
checkpoints are described in `@jolly-pixel/e2e`.

```bash
$ pnpm --filter @jolly-pixel/editor.voxel-map test:scenario
$ SCENARIO_FROM=template pnpm --filter @jolly-pixel/editor.voxel-map test:scenario
```

## Not covered yet

Brackets name the deleted e2e spec that covered each item.

- Peers: a second browser context that joins, sees edits and presence, and
  edits a template with the host (`collaboration`, `peer`, `templateEditing`).
  Needs a second page, so likely its own scenario.
- Roles: a spectator gets a view-only map, then edits once promoted (`access`).
- Version tags: restore a saved version read-only (`tags`).
- Blocksets: add a second blockset, rename it from its tab, remove one and see
  the orphaned blocks flagged (`blocksets`).
- Block library: search, active-blockset scope, drag to reorder, edit a block
  in place, alpha mode and sides of a transparent block, custom properties
  (`blocks`, `blockReorder`).
- Half blocks: merge a complement into a cell, remove one half, pick and
  replace one half (`mergedCells`).
- Selection: marquee cut and commit, corner select, connected select, Delete,
  copy and paste (`selection`, `selection-corners`).
- Placement controls: rotate and mirror a template before committing, cancel
  with Escape (`templates`).
- Brush modes: replace mode, circle pattern, rotation and flip (`painting`).
- Texture: UV regions follow the selected block, unfold a block
  (`texture`).
- Dock layout: the texture editor moves between Blocks and Paint, panes dragged
  to other docks (`layout`).
- Console: theme switch, keybind rebinding (`console`).
- Tours: walk each tour to its last step (`tours`).
- Rendering: chapter screenshots are attached but nobody compares them. A
  tolerant image diff on a few chapters would catch a block that exports fine
  but draws wrong.
