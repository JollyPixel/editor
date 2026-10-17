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

An asset root on disk plus its configuration, `.jollypixel/project.json`,
which lists its editor packages and kind packages. The `JOLLY_PROJECT`
environment variable picks it, defaulting to `packages/studio/project/`.
Its packages resolve from its own `node_modules` before the studio's.
The back-end calls the same assets a workspace; the studio never uses that
word for anything else.

### Seed

The assets written into a project root that lacks them, from
`createStudioSeed`. A seed entry never overwrites an existing path.

### Shell

The studio page: the header with the tab strip, and the workbench below it
that shows Home or one editor frame. It holds data only and never loads a
kind handler or editor code.

### Home

The fixed first tab and the `<studio-home>` page it shows: the asset browser
in the asset dock, and the project overview, which counts the assets per kind
and lists the open editors.

### Asset browser

The `<asset-browser>` element in the asset dock on Home: the kind filter, the
asset actions, the tree of catalog records and the details of the selection.

### Folder

A directory of the asset source, listed by the catalog room. It stays, empty
or not, until it is deleted: moving its last asset out keeps it. Renaming or
deleting one sends one catalog command per asset under it, then one per
folder.

### Companion

An asset nested under another in the tree: same folder, same name before the
first dot, and referenced by that other asset, its owner
(`overworld.blockset.json` under `overworld.voxelmap.json`). An owner cannot be
collapsed, so its companions always show. Renaming or moving the owner takes
its companions
along; deleting it offers to delete them too. The pairing is derived from
paths and dependency edges, never stored.

### Kind filter

The button group above the tree. A kind shows only its assets and their
companions; every folder still shows. The choice is kept per browser.

### Kind descriptor

The `AssetKindDescriptor` an asset package exports: kind, label and optional
icon. The shell registers one per kind it can show.

### Editor manifest

The `jollypixel.editor` field of an editor package's `package.json`:
`{ name, kinds, dist?, page? }`. It tells the studio which kinds the editor
opens, which folder holds its built page and, with `page`, which source HTML
the studio build compiles together with the shell.

### Project manifest

`ProjectManifest`: the editor and kind descriptors of the project, served as
`project-manifest.json` and fetched by the shell at boot. Not to be confused
with an editor manifest.

### Editor registry

`EditorRegistry`: resolves a kind to its icon and to its editor page URL. A
kind opens in at most one editor.

### Editor page

An editor's built `index.html`, served at `editors/<name>/` beside the shell.
Each one runs `editor.host` with its own client, session and runtime.

### Tab

One open editor page in the shell, keyed by the asset id it opened. The
first tab, Home, is fixed and opens no editor; Settings is closable and
opens no editor either. A tab shows the asset name
without its kind extension and the full path on hover. A tab loads its frame
when first focused, and the open tabs are saved under `studio:tabs`.

### Tab cap

The most editor tabs open at once, four. Opening another asks to close the
least recently active tab; Home and Settings do not count.

### Launch handshake

The editor page posts `jolly-ready` to the shell; the shell answers
`jolly-launch` with the target id. The `?target=` query is the fallback when
no answer comes.

### Shell command

A `jolly-shell` message an editor page posts back through its
`ShellChannel`. The shell handles `open-asset` like a tree activation,
`toggle-console` by toggling its console, `session-refused` by renewing the
session, and `unsaved` and `editor-state` by marking the tab of the frame
that posted it.

### Account

A user of the online studio, signed in with a session cookie. Its id is the
peer `subject` the event store records and the `peerId` presence colours.

### Role

What an account may do, a key of the project's `access.roles` rights table.
`admin` is built in; an undeclared role falls back to `defaultRole`.

### Project owner

The one admin account no other admin can demote or remove, first the account
that registered first. Only the owner hands the title to another account.
Unrelated to the owner of a companion.

### Share link

A view-only link to one asset, `/view/<token>`, for people without an
account. It opens the asset's editor page alone and reaches the asset and its
dependency closure. Its creator picks a lifetime (1, 7 or 30 days, or never);
the creator or an admin copies or revokes it, from the asset's Share dialog
or the Share links pane on Home. A role needs write on `studio.$share` to
create one.

### Guest

Whoever opens a share link: the built-in `guest` role, read-only, shown as
"Guest" with a "via link" badge. A project cannot declare that role.

### Roster

The accounts, their role and whether they are online, pushed by the
`accounts` room to every shell and drawn by the Users pane.

### Offline workspace

The asset back-end the shell runs in the browser when the catalog is
unreachable, under `?offline`, or in a static build. The shell and its editor
frames share it as the `studio` workspace.
