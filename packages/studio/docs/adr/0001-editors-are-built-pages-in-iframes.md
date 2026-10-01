---
status: accepted
---

# Editors are built pages in same-origin iframes

Each editor tab is an iframe on the editor's built page, served by the studio at
`/editors/<name>/` from the folder its `jollypixel.editor` manifest names. The studio runs one
asset back-end, and every page reaches it on the same origin, so no editor changes to run inside
the studio.

Editors were page-scoped when the studio started: they query `document`, own the dock layout and
boot at module top level. Framing a page needs none of that to change. Mounting editors in the
shell's own document waits for the `EditorDefinition` revisit in the
[editor host roadmap](../../../editors/host/ROADMAP.md).

## Considered Options

- **A dev-server proxy** to each editor's own Vite server. Three extra servers per run, and a page
  that only works while they are up.
- **One multi-page Vite root** compiling every editor from source. HMR for editor code, at the cost
  of merging three Vite configs, their aliases and their optimized dependencies into the studio's.
- **In-process mounting.** Blocked by the page-scoped editors above.

## Consequences

- A tab is a full editor: its own WebSocket client, runtime and WebGL contexts. See
  [ADR-0005](./0005-four-editor-tabs.md).
- Each page bundles its own `editor.host` and `@jolly-pixel/ui`. The pages stay self-contained so
  an external editor can ship prebuilt, and the shell does not pin the host version an editor runs.
  In dev, `pnpm --filter @jolly-pixel/studio dev:editors` rebuilds both libraries and every page
  on change, and the dev server tells the shell to reload the frames of a rebuilt editor.
- An editor's own Vite config and back-end stay for standalone development and its e2e suite.
