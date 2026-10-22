# @jolly-pixel/studio — ROADMAP

Open work, in the order it should land. Decisions already taken are in the
[ADRs](./docs/adr/README.md). Each step ends with
`pnpm --filter @jolly-pixel/studio test`, `pnpm run typecheck` and
`pnpm run lint` green.

## Next

### 1. Voxel-model keybindings

Undo, redo and `k` (key the selected block) are hardcoded in
`historyShortcuts.ts` and `animationShortcuts.ts`, so voxel-model is the only
editor missing from Settings › Keybindings. Follow voxel-map's layout:

- `MODEL_KEY_BINDINGS` (`edit.undo`, `edit.redo`, `animation.key`) in
  `src/keybindings/`, and `VOXEL_MODEL_KEYBINDINGS` from `defineKeyBindings`
  in `preferences.ts`, added to its default export.
- A `ModelKeyBindingSettings.follow(preferences)` replaces
  `HISTORY_SHORTCUTS` and `KEY_BLOCK_SHORTCUT`. `HistoryButtons` and
  `AnimatePanel` format their tooltips from it, so a rebind shows there too.

### 2. Per-editor launch preferences

Each frame gets every scope's overrides, since `EditorFrames` does not know
which editor a tab hosts. No scope holds anything private yet; land this
before one does.

- `EditorTab` carries its editor's name. `EditorFrames` sends a frame the
  `HOST_PREFERENCES` scopes plus that editor's `scopes` and `shared` from
  `ProjectManifest.editorScopes()`.
- The launch message and every later `preferences` push go through that
  filter.

## Long-term goals

### Project policy for editors

Kind options are the only editor configuration a project sets. A project
could also give defaults for editor preferences, or force values a user
cannot override, such as baked voxel-map lighting or `uvSync: live` for
collaboration. Preference descriptors leave room for a project scope per
field.

### Audit history

Diffs for asset edit runs, opening an asset at the version a row points to,
CSV export and retention. Edits only reach back to each asset's last
snapshot, because compaction drops older events from `events.db`, and
folder changes write no event. Keeping that history means recording it in
`audit.db` as it happens, or compacting less.

### Runtime tab

Another page in another iframe that plays the project. No editor contract
involved; its action goes in the header toolbar.

### In-process editors

Mount editors in the shell's document instead of iframes. The
`EditorDefinition` contract assumes one editor per document:

- `mountStandalone` owns page-wide state: `data-editor-state` on `<html>`,
  the `jollyEditor` debug global and `LastOpenedLaunchSource`.
- `EditorContext` carries no container, so editors mount into the page's own
  DOM.
- Embedded panels (voxel-map's `TextureEditor`, voxel-model's texture panel)
  take an `AssetLeases` lease, not a context.

A starting shape: a base context every mounted piece gets,
`{ container, assets, shell, logger }`, that a full editor extends with
`launch` and `session`. A panel is then a smaller definition on the same
contract. `ShellChannel` wraps a `ShellPort`, so an in-process port is
trivial.

To settle in a design pass first:

- One `EditorSession` and WebSocket for every editor, or one each.
- CSS isolation: a shadow root per editor, or stay in iframes.
- One `Runtime` per editor and its WebGL context cost.
- `Keyboard.addGuard` and the input layers assume one editor per page.
- Page-wide state moves to the shell or becomes per editor.
