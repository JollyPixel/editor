---
status: accepted
---

# The project file lists editors and kinds

`.jollypixel/project.json` names the editor packages and the kind packages a project uses:

```json
{
  "version": 1,
  "editors": ["@jolly-pixel/editor.voxel-map"],
  "kinds": {
    "@jolly-pixel/asset.voxel-map": { "voxelmap": { "chunkSize": 16 } }
  }
}
```

asset-server owns the file and its `kinds` section: `ProjectFile` parses it and `ProjectKinds` loads
each package's `ASSET_KINDS` export (an `AssetKindPackage`: descriptors plus a `handlers(options)`
factory). The `editors` section is the studio's, read by `StudioProject` into `EditorPackages`. A
server hosting several projects reads each project's kinds without going through the studio.

Each package's `optionsSchema` checks the options the file gives it when the project loads.
`texture` stays built in: `ProjectKinds.handlers()` ends with it, and a package claiming `texture`
or `binary` throws. When the root has no project file, the studio writes the default one (the three
studio editors and their kinds) with an exclusive create, so an existing file is never replaced.
The `e2e` and `static` modes load that default without reading the root.

An entry is a package name or, when it starts with `./` or `../`, a folder of the project
holding a `package.json`. asset-server's `PackageResolver` resolves a name from the project
root's `node_modules` first, then from the studio's, so a project without `node_modules` still
gets the studio's editors and kinds, and a project's own copy wins. Listing a package trusts it
([ADR-0017](./0017-project-packages-are-trusted-code.md)).

The shell still loads no kind code ([ADR-0002](./0002-the-shell-consumes-data-only.md)): the server
serves the editor and kind descriptors as `project-manifest.json`, and a static build writes that
file. The offline workspace, which runs a back-end in the browser, imports the kind
packages through `virtual:jolly-pixel/handlers`, which asset-server's `createProjectKindsPlugin`
serves. Each editor's Vite config loads its kinds from a project file of its own through
`ProjectKinds` and the same plugin, so no handler list is written twice.

## Considered Options

- **A factory per kind** instead of per package. `asset.voxel-map` ships `tileset` and `voxelmap`
  together, and a project picks packages, not kinds.
- **Descriptors kept in the shell.** A kind added to the file would show the generic `file` icon
  until the shell changed.
- **Failing on a missing project file.** The default project folder is gitignored, so a fresh clone
  would fail to boot.
- **`texture` listed under `kinds`.** It is part of asset-server, not a package a project picks.

## Consequences

- The dev server restarts when the project file holds another document
  (asset-server's `createProjectFileWatchPlugin`), so adding an editor or a kind needs neither a
  studio change nor a manual restart. The editors' dev servers do the same with their own file.
- Kind code for the offline workspace is bundled: a static build lists the kinds it was built
  with, and adding one needs a rebuild.
- A kind package resolved from a project's `node_modules` may bring its own copy of
  `@jolly-pixel/asset-server`. Handlers are plain objects, so this works, but kind packages should
  declare it as a peer dependency.
