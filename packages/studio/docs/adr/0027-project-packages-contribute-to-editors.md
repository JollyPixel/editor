---
status: accepted
---

# Project packages contribute to editors

A package listed in `.jollypixel/project.json`, under `editors` or `kinds`, can add code to
another editor's page. It names an export subpath under a field of its manifest:

```json
{
  "jollypixel": {
    "scene": "./scene"
  }
}
```

asset-server's `createProjectContributionsPlugin` serves
`virtual:jolly-pixel/contributions/<field>`. The module imports the subpath of every listed
package that declares the field and exports them as `{ name, module }` entries. The editor that
imports the module decides which export it reads and refuses a package that lacks it. The scene
editor reads `SCENE_COMPONENTS`, so `@jolly-pixel/editor.voxel-map` adds the `VoxelMap`
component to scenes without the scene editor importing it.

The studio passes the plugin the project's packages, so it never learns a field name: a new
contribution field needs no studio change. An editor's own Vite config passes the packages of its
standalone project.

## Considered Options

- **A component list inside the scene editor.** Every new component type would need a release of
  the scene editor, and a project could not add its own.
- **Contributions from kind packages only.** The voxel-map contribution opens `VoxelMapViewer`,
  which needs the host's leases, and a kind package would have to depend on `editor.host` to
  hold it.
- **Prebuilt contribution modules loaded at runtime.** A package could be added without a
  rebuild, but each module would bring its own copy of `three`, `@jolly-pixel/engine` and Lit
  unless the pages shared an import map, and `instanceof` checks across copies fail.

## Consequences

- Contributions are bundled like the offline kind handlers
  ([ADR-0016](./0016-the-project-file-lists-editors-and-kinds.md)): adding one needs a rebuild of
  the page that reads it.
- In `dev:editors`, each page is built by its own Vite config, so it sees the packages of its
  standalone project, not the studio's. The studio build compiles the pages with the studio's
  project.
- A contribution runs in the editor's page with the editor's rights, like any project package
  ([ADR-0017](./0017-project-packages-are-trusted-code.md)).
