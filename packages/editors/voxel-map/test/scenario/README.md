# Voxel-map scenario

One Playwright test plays a user story from a blank offline map to a finished
house, in installed Chrome on the real GPU. It replaces the per-feature e2e
specs, which ran on SwiftShader and were too flaky to keep in CI.

```bash
$ pnpm --filter @jolly-pixel/editor.voxel-map test:scenario
$ SCENARIO_FROM=template pnpm --filter @jolly-pixel/editor.voxel-map test:scenario
```

The run is headed, uses one worker, and needs Google Chrome installed. It is
not part of CI: the package has no `test:e2e` script. Every run records
`test-results/<test>/video.webm` and attaches a screenshot per chapter.

## How it works

`buildHouse.scenario.ts` lists chapters. Each chapter drives the editor through
its UI and console, then exports the map with `/archive.export`. `MapArchive`
decodes that `.zip` in Node and the chapter compares it with its expectation:
layers and their voxel counts, templates, blocks with the coverage of their
tile, material groups, painted atlas tiles, and named cells. The comparison
retries until it matches or the chapter times out.

The export is also the checkpoint, saved under
`node_modules/.cache/scenario/build-house/<chapter>.zip`. `SCENARIO_FROM`
imports the checkpoint of the chapter before the one named, checks it, and
plays on from there.

Limits: 10 s per action and 45 s per chapter, so a stuck step fails and closes
the browser.

## Writing a chapter

- Set up the session state the chapter needs: open pane, selected block, brush
  size. None of it is saved in the map, so it is lost on resume, and the
  previous chapter may have left another pane in front.
- Assert through the exported archive. Reach for `window.voxelMapEditor` only
  to aim the camera or to wait for an intermediate state inside a chapter.
- Wait on a condition (`expect.poll`, `toPass`), never on a delay.
- Write the expectation as a change from the previous chapter's one.

## Not covered yet

These were covered by the deleted e2e specs (named in brackets) and are
candidates for new chapters or a second scenario.

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
