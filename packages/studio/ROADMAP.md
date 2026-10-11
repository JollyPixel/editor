# @jolly-pixel/studio — ROADMAP

Open work, in the order it should land. Decisions already taken are in the
[ADRs](./docs/adr/README.md). Each step ends with
`pnpm --filter @jolly-pixel/studio test`, `pnpm run typecheck` and
`pnpm run lint` green.

## 1. Preferences and settings pane

A per-user store the shell owns, reached from the header toolbar. The open
tabs, the dock layout and the kind filter move there from `localStorage`. It
becomes the home of the account: the avatar upload moves there from the
`AccountBadge` menu.

## 2. Unsaved changes on tabs

A tab shows a marker while its editor holds changes the server has not
acknowledged, and closing or reloading the studio asks first. Those changes
survive a session renewal ([ADR-0022](./docs/adr/0022-a-refused-session-renews-in-place.md))
but not a reload.

The count is `CommandSync.pending`, but nothing outside the synced documents
can read it:

- `CommandSync` emits `settled` when the count reaches zero, but nothing when
  it leaves zero.
- `SyncedDocument` keeps its sync private. Each implementation would expose
  it: `SyncedPixelDocument`, `SyncedVoxelMap`, `SyncedBlockset` and the
  shared `SyncedCommandDocument` (voxel-model, voxel-animation).
- `EditorSession` sums its leases and posts a `dirty` shell command through
  `ShellChannel`; the shell marks the tab and guards `beforeunload`.

That touches network, three asset packages and editor.host, each with a
changeset.

## Waiting for a trigger

- **Shell commands from editors.** The host posts `toggle-console` on Ctrl+K
  and `session-refused`, but no editor calls `context.shell` since the
  voxel-map Paint action was dropped. A title is the expected next command;
  add it when an editor needs the shell to show one.

## Long-term goals

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
