# Voxel-model scenario

One headed Playwright test builds a blocky figure from the blank offline model:
a body, head, mirrored arms and legs, a top hat, tinted materials and a clip
that raises one arm. It needs Google Chrome and does not run in CI. The runner
and checkpoints are described in `@jolly-pixel/e2e`.

```bash
$ pnpm --filter @jolly-pixel/editor.voxel-model test:scenario
$ SCENARIO_FROM=animate pnpm --filter @jolly-pixel/editor.voxel-model test:scenario
```

A resumed chapter starts on the Texture tab, so a chapter that works in another
tab opens it first.

## Not covered yet

Brackets name the deleted e2e spec that covered each item.

- Peers: a second browser context that sees edits, selections and material
  edits, locked fields and blocks during a peer's drag, refused renames, and
  clip chips and playhead markers (`peers`, `animate/collaboration`,
  `texture`). Needs an online scenario, which the runner cannot open yet.
- Roles: a spectator gets a view-only model, then edits once promoted
  (`access`).
- Asset select: open another model and its texture in place (`switch`).
- Import as copy: a second model and texture next to the original
  (`archive`).
- Transform space: a child read and written in World space, scale on one axis
  for a block with children, a size handle drag (`transform`).
- Hierarchy: rename refused against a sibling inside a block, a name clash left
  by a delete flagged until renamed, delete with children (`hierarchy`).
- Materials: copy and paste, delete with its uses, field groups, info tooltips
  and preset swatches (`material/editing`).
- Animation sets: copy a clip to a set and fork it back, a track left unbound
  by a deleted block and rebound, set clip length, frame rate and loop, unlink
  and link a set, timeline keyboard (`animate/library`, `animate/timeline`).
- View: the Material tab's View panel, the glow pass and runtime idle
  (`view`, `boot`).
- Rendering: the shirt and face tints are read back from the viewport, but the
  attached chapter screenshots are not compared.
