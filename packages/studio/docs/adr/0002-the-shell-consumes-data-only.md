---
status: accepted
---

# The shell consumes data only

The shell never loads an asset kind's handler or an editor's code. It learns a kind from the
`AssetKindDescriptor` the asset package exports (kind, label, icon) and an editor from the
`jollypixel.editor` field of its `package.json`:

```json
"jollypixel": {
  "editor": {
    "name": "voxel-map",
    "kinds": ["voxelmap"],
    "dist": "dist"
  }
}
```

`EditorPackages` reads the manifests when the server starts. The server serves their
`{ name, kinds }[]` and the descriptors of the project's kind packages as
`project-manifest.json` ([ADR-0016](./0016-the-project-file-lists-editors-and-kinds.md)); the
shell fetches it at boot, and `EditorRegistry` turns it into kind icons and page URLs.
Kind code runs in the back-end handlers, editor code in the frames, and the shell talks to the
frames through `postMessage` only.

This is what lets kinds and editors come from outside the monorepo: the shell needs a descriptor
and a manifest, never an import, and its bundle carries no project data.

## Considered Options

- **Importing the handlers in the shell** to read their extension and icon. It ships server code to
  the browser and ties the shell to every kind package.
- **Hard-coded editor routes** in the shell. Every new editor would need a studio change.

## Consequences

- A kind opened by two editors throws at registration.
- A kind with no editor, such as `texture` or `tileset`, opens nothing and its rows say
  `no editor`.
- A kind registered twice throws, and a kind without an icon shows `file`.
