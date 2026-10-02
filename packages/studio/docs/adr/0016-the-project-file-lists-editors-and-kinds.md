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
The `e2e` and `static` modes load that default without reading the root. Packages resolve from the
studio's `node_modules`.

The shell still loads no kind code ([ADR-0002](./0002-the-shell-consumes-data-only.md)):
`virtual:jolly-pixel/project` carries the descriptors as data. The offline workspace, which runs a
back-end in the browser, imports the kind packages through `virtual:jolly-pixel/handlers`.

## Considered Options

- **A factory per kind** instead of per package. `asset.voxel-map` ships `tileset` and `voxelmap`
  together, and a project picks packages, not kinds.
- **Descriptors kept in the shell.** A kind added to the file would show the generic `file` icon
  until the shell changed.
- **Failing on a missing project file.** The default project folder is gitignored, so a fresh clone
  would fail to boot.
- **`texture` listed under `kinds`.** It is part of asset-server, not a package a project picks.

## Consequences

- Adding an editor or a kind to a project needs a dev server restart, not a studio change.
- Each editor's own Vite config and offline workspace still register their handlers.
