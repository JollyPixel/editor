# @jolly-pixel/editor.host — ROADMAP

## Host shell

`@jolly-pixel/studio` is the shell since 2026-09-22: it frames each editor
page and launches it over `jolly-ready` / `jolly-launch`, and editors reach it
through `context.shell`. Still open:

- Revisit the `EditorDefinition` contract so the shell can mount editors
  in-process, including how embedded panels (voxel-map's Paint tab,
  voxel-model's texture panel) fit, since today they take a lease rather
  than a context.
- An origin allow-list for the handshake. Today the ready message goes to
  any parent and the channel binds to the origin of the answer.
- Opaque launch tokens: a `/edit/<token>` route that resolves to a target, so
  the id stays out of the URL.
- Boot tracing: `mountStandalone`, `EditorSession.open`, `Runtime.create`
  and the bootstrap steps log nothing, so a page that hangs at boot gives
  no clue without temporary `console.log` inserts. A debug logger that the
  editors, the studio and the e2e suites can switch on.
