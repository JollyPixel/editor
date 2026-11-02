# Scene scenario

One headed Playwright test furnishes a scene, from the blank offline scene to a
room holding a lamp prefab. It needs Google Chrome and does not run in CI. The
runner and checkpoints are described in `@jolly-pixel/e2e`.

```bash
$ pnpm --filter @jolly-pixel/editor.scene test:scenario
$ SCENARIO_FROM=prefab pnpm --filter @jolly-pixel/editor.scene test:scenario
```

## Not covered yet

- Peers: a second browser context that sees edits, presence badges in the
  hierarchy and the outline of a peer's selection.
- Components from other packages, their asset slots and anchors: the
  standalone editor loads no component package.
- Show in asset: needs the studio shell to open the anchor's map.
- Script components and their properties: need a project script.
- An instance nested inside a prefab.
- Component fields other than the light kind and spot angle, such as mesh
  geometry.
- Rendering: chapter screenshots are attached but nobody compares them.
