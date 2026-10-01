---
status: accepted
---

# Editor page URLs are relative to the shell, back-end URLs are origin-absolute

`EditorRegistry.pageUrl` returns `editors/<name>/?<query>&target=<id>`, resolved against the
shell page. Editor pages build with `base: "./"`. A static build, which copies the pages into
`dist/editors/`, therefore works at the site root and under any sub-path.

Every URL an editor uses to reach the back-end stays origin-absolute: the WebSocket path, the
catalog path and the `/assets/` prefix. A page framed from `/editors/<name>/` on the studio origin
reaches the studio back-end with no editor change, which is what makes
[ADR-0001](./0001-editors-are-built-pages-in-iframes.md) work. `base: "./"` also keeps the
pages' bundles off the asset server's `/assets/` route.

## Consequences

- The dev server serves the pages at the absolute `/editors/` prefix, since dev always runs at the
  root.
- A studio with a back-end still needs the origin root; only the static, offline build can move to
  a sub-path.
