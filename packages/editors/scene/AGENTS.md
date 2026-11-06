# AGENTS.md

## Boundaries

- A component type ships in its own package, declared with `jollypixel.scene`
  in that package's `package.json` (see `editors/model`). Never add one by
  editing this workspace.
- This workspace depends on no component package. Its standalone page edits a
  seed scene; try components through the studio.
- Each component kind sets `category` (`SceneComponentPackage.ts` in
  `editor.host`), which groups the Add component menu. There are no actor
  presets: actors start empty.
- New viewport click behavior goes in `ViewportClick`, not in another component
  gated on modifiers.
