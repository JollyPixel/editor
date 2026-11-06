# AGENTS.md

## Boundaries

- Before adding to the host, check that the host itself or every editor needs
  it. Otherwise push it down to the lowest package that owns its types.
- The root entry imports `@jolly-pixel/ui`, so it throws in a DOM-free
  `node:test` (`HTMLDialogElement is not defined`). Helpers meant for DOM-free
  models do not go here.
- Editors and the studio load this package from `dist/`. Run
  `pnpm run build` here before checking a consumer.

## Editor lifecycle

- An editor's `dispose()` never disposes the session or the runtime: the host
  owns both and remounts the editor in place on an asset switch. `mount` must
  be safe to run twice on one page.
- Per-mount resources go through `request.own`; page-lifetime ones go into
  `Placement`.
- Never top-level-await in an editor entry or anything bundled into it. The
  built page deadlocks while dev works. Debug a silent boot hang with `?debug=*`
  (`localStorage["jolly-pixel:debug"] = "*"` inside the studio): the last
  started step is the one that hangs.
