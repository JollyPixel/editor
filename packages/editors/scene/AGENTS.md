# AGENTS.md

## Boundaries

- A component type ships in its asset kind package: the definition in its
  `jollypixel.runtime` entry and the slot kinds in `jollypixel.sceneComponents`
  (see `assets/model`). Its forms go in the kind's editor, under
  `jollypixel.scene`. Never add one by editing this workspace; the built-in
  ones live in `assets/scene`.
- This workspace depends on no component package. Its standalone page edits a
  seed scene; try components through the studio.
- Each component kind sets `category` (`SceneComponentPackage.ts` in
  `editor.host`), which groups the Add component menu. There are no actor
  presets: actors start empty.
- New viewport click behavior goes in `ViewportClick`, not in another component
  gated on modifiers.
