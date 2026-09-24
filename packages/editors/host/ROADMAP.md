# @jolly-pixel/editor.host — ROADMAP

## Host shell

`@jolly-pixel/studio` is the shell since 2026-09-22: it frames each editor
page and launches it over `jolly-ready` / `jolly-launch`, and editors reach it
through `context.shell`. Still open:

### In-process editors

Revisit the `EditorDefinition` contract so the shell can mount editors
in-process, including how embedded panels (voxel-map's `TilesetTextures`,
voxel-model's `LeftPanel` texture panel) fit, since today they take an
`AssetLeases` lease rather than a context.

The contract assumes one editor per document today:

- `mountStandalone` owns page-wide state: `data-editor-state` on `<html>`,
  the `jollyEditor` debug global and `LastOpenedLaunchSource`.
- `EditorContext` carries no container element, so editors mount into the
  page's own DOM.

A starting shape: split the context into a base every mounted piece gets,
`{ container, assets: AssetLeases, shell, logger }`, and let a full editor
add `launch` and `session`. A panel is then a smaller definition on the same
contract, fed a lease-provided document. `ShellChannel` already wraps a
`ShellPort`, so an in-process port that calls the studio directly is
trivial.

Decisions to settle first, in a design pass:

- One `EditorSession` and WebSocket client shared by every editor, or one
  each.
- CSS isolation: a shadow root per editor, or stay in iframes.
- One `Runtime` per editor and its WebGL context cost; the voxel-map block
  library leak came from leaked contexts.
- Global input: `Keyboard.addGuard` and the input layers assume one editor
  per page.
- Page-wide state (`data-editor-state`, the debug handle, last opened) moves
  to the shell or becomes per editor.

### Opaque launch tokens

A `/edit/<token>` route that resolves to a target, so the id stays out of the
URL. The asset-server Vite plugin already injects the launch through
`transformIndexHtml` and its `launch()` option, so the route would add a
short-lived token map (`token → target`, with a TTL) and serve the editor
page with the resolved launch injected. `QueryLaunchSource` would stay for
dev.

On hold until a feature needs it:

- The studio already keeps the id out of the URL, since the launch arrives
  by `postMessage`. Only standalone `?target=` links expose it.
- `?offline` has no server to resolve a token.
- The value depends on asset ids being secret. With the RBAC read gate on
  rooms, knowing an id grants no access. A share-link feature is the likely
  trigger.
