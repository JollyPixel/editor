# Studio glossary

This glossary defines the vocabulary of `@jolly-pixel/studio`. Launch,
session and target are the editor host's words, see the
[editor host glossary](../editors/host/GLOSSARY.md). Asset room and asset
kind handler are the asset server's, see the
[asset-server glossary](../asset-server/GLOSSARY.md).

## Terms

### Studio

The app. One studio process opens exactly one project.

### Project

An asset root on disk plus its configuration. The `JOLLY_PROJECT`
environment variable picks it, defaulting to `packages/studio/project/`.
The back-end calls the same assets a workspace; the studio never uses that
word for anything else.

### Seed

The assets written into a project root that lacks them, from
`createStudioProject`. A seed entry never overwrites an existing path.

### Shell

The studio page: the header with the tab strip, the asset dock and the
workbench. It holds data only and never loads a kind handler or editor code.

### Asset browser

The `<asset-browser>` element in the asset dock: the kind filter, the asset
actions and the tree of catalog records.

### Folder

A path prefix shared by assets in the tree. Folders have no catalog record:
renaming or deleting one sends one catalog command per asset under it.

### Draft folder

A folder made with the New folder action that holds no asset yet. It lives
in the browser only: it can be renamed, moved and dropped into, and it
becomes an ordinary folder once an asset lands in it. A reload forgets it.

### Companion

An asset nested under another in the tree: same folder, same name before the
first dot, and referenced by that other asset, its owner
(`overworld.tileset.json` under `overworld.voxelmap.json`). Renaming or
moving the owner takes its companions along; deleting it offers to delete
them too. The pairing is derived from paths and dependency edges, never
stored.

### Kind filter

The button group above the tree. A kind shows only its assets and the
folders holding them. The choice is kept per browser.

### Kind descriptor

The `AssetKindDescriptor` an asset package exports: kind, label and optional
icon. The shell registers one per kind it can show.

### Editor manifest

The `jollypixel.editor` field of an editor package's `package.json`:
`{ name, kinds, dist? }`. It tells the studio which kinds the editor opens
and which folder holds its built page.

### Editor registry

`EditorRegistry`: resolves a kind to its icon and to its editor page URL. A
kind opens in at most one editor.

### Editor page

An editor's built `index.html`, served at `editors/<name>/` beside the shell.
Each one runs `editor.host` with its own client, session and runtime.

### Tab

One open editor page in the shell, keyed by the asset id it opened. The
first tab, Home, is fixed and opens no editor. A tab loads its frame when
first focused, and the open tabs are saved under `studio:tabs`.

### Tab cap

The most editor tabs open at once, four. Opening another asks to close the
least recently active tab; Home does not count.

### Launch handshake

The editor page posts `jolly-ready` to the shell; the shell answers
`jolly-launch` with the target id. The `?target=` query is the fallback when
no answer comes.

### Shell command

A `jolly-shell` message an editor page posts back through its
`ShellChannel`. `open-asset` is the only command; the shell handles it like a
tree activation.

### Offline workspace

The asset back-end the shell runs in the browser when the catalog is
unreachable, under `?offline`, or in a static build. The shell and its editor
frames share it as the `studio` workspace.
