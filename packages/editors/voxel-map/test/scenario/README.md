# Voxel-map scenarios

Each headed Playwright test starts from a blank offline map. They need Google
Chrome and do not run in CI. The runner and checkpoints are described in
`@jolly-pixel/e2e`.

- `build-house`: paints a Door block in the texture editor, imports the
  placeholder tileset, then builds a cottage: a cobble foundation with a planks
  floor in replace mode, two wall courses with undo and redo, windows and a
  door, and a gable roof of ramps on its own layer. The roof is merged down,
  the house saved as a template and placed again to make a street, the door
  gets a gold material, and the street survives a reload and an archive round
  trip.
- `shape-terrain`: imports the tileset and duplicates blocks into a water slab,
  a bridge slab and a ramp. It paints a round island and a hill with the circle
  brush, replaces a sand path into it, digs a pond with the corner select,
  merges a bridge over the water, turns and flips a compass signpost, lays
  slopes around the hill, moves the signpost with the marquee, and copies a tree
  with the connected select.

```bash
$ pnpm --filter @jolly-pixel/editor.voxel-map test:scenario
$ pnpm --filter @jolly-pixel/editor.voxel-map test:scenario shapeTerrain
$ SCENARIO_FROM=marquee pnpm --filter @jolly-pixel/editor.voxel-map test:scenario shapeTerrain
```

Both scenarios pin the camera in `ready`, after the map opens and after a
resume, so chapters can aim at cells without moving the view. Cells hidden
behind a built block cannot be aimed at, so chapters build from back to front.

## Tileset

`support/tileset.ts` turns `fixtures/placeholder_tileset_256.png` into a
`.blockset.json` at test time and names one block per tile it uses. The
`Compass` block shows the `+X`, `-Y` and other face tiles, so its rotation and
flip can be read from a screenshot.

## Blueprints

A `Blueprint` draws the expected map as ASCII, one level per height, rows from
north (`-z`) to south, columns from west (`-x`) to east. A legend maps each
symbol to a block, rotation and flip; `.` is empty. `with()` overlays a stage
on the previous one, where a space keeps the cell. A chapter reads the
exported voxels back into the same drawing, so a failure prints the plan with
the wrong cells. Voxels outside the site or missing from the legend are listed
under `strays`.

## Not covered yet

Brackets name the deleted e2e spec that covered each item.

- Peers: a second browser context that joins, sees edits and presence, and
  edits a template with the host (`collaboration`, `peer`, `templateEditing`).
  Needs a second page, so likely its own scenario.
- Roles: a spectator gets a view-only map, then edits once promoted (`access`).
- Version tags: restore a saved version read-only (`tags`).
- Blocksets: rename a blockset from its tab, remove one and see the orphaned
  blocks flagged (`blocksets`).
- Block library: search, active-blockset scope, drag to reorder, alpha mode and
  sides of a transparent block, custom properties (`blocks`, `blockReorder`).
- Placement controls: rotate and mirror a template before committing
  (`templates`).
- Texture: UV regions follow the selected block, unfold a block
  (`texture`).
- Dock layout: the texture editor moves between Blocks and Paint, panes dragged
  to other docks (`layout`).
- Console: theme switch, keybind rebinding (`console`).
- Tours: walk each tour to its last step (`tours`).
- Rendering: chapter screenshots are saved but nobody compares them. A
  tolerant image diff on a few chapters would catch a block that exports fine
  but draws wrong.
