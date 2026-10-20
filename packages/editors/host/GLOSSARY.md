# Editor host glossary

An editor page edits one asset at a time, its **target**. Before the editor
can show anything, the host works out which asset that is, connects to it and
loads the other assets the target uses. The editor then builds its view on
what the host prepared. The host keeps the connection for as long as the page
lives, so opening another asset swaps the editor without reloading the page.

Each term below describes the idea first. The *In code* line names where it
shows up in the API. The [architecture](./ARCHITECTURE.md) shows how the parts
fit together.

## Opening an editor

### Target

The asset an editor page is editing. A page has one target at a time; every
other asset it loads is there because the target uses it.

*In code:* `launch.target` is its id, `session.target` the open asset.

### Launch

The request that names the target. It comes from the app framing the page,
from the page address, or from data written into the page when it was served.
The host asks them in that order and the first answer wins.

*In code:* [`EditorLaunch`](./docs/launch/EditorLaunch.md) and its
`LaunchSource` list. `LaunchNotFoundError` when none answers.

### Editor

What an editor declares to the host before anything opens: the kind of asset
it edits, the other kinds it can load, and how to build itself. The host only
loads what the editor declared, so the textures of a voxel map stay closed
when the editor never said it can read textures.

*In code:* the [editor definition](./docs/editor/mountStandalone.md#editor-definition):
`accepts`, `kinds`, `mount` and the optional `createRuntime`.

### Mount

Building the editor on the page. The host hands over everything it prepared,
and the editor gives back a handle that can undo what it built. The editor
never tears down what the host prepared, since the next mount reuses it.

*In code:* `mount(context)` returns an `EditorHandle`, whose `dispose()`
releases what `mount` built.
[`mountStandalone`](./docs/editor/mountStandalone.md) runs the whole boot.

### Switch

Opening another asset, or a saved version of the same one, without reloading
the page. The host first waits until the server has received every pending
edit, then opens the new target and mounts the editor again. The connection
and the 3D view stay, and assets both targets use are not loaded twice.
Anything the editor kept to itself, such as the selected brush, starts over.

*In code:* `LaunchNavigator.navigate(target, tag)`, called by the toolbar's
`EditorTargets.open()` and `EditorTags.view()`. See
[switching](./docs/editor/mountStandalone.md#switching-target-or-tag).

## Holding assets open

### Session

Everything held open for the current target: the target and its
dependencies. Each switch opens a new session. Sessions open on a connection
that lasts as long as the page, so a switch never reconnects.

*In code:* [`EditorSession`](./docs/session/EditorSession.md), given to the
editor as `context.session` and opened on a `SessionConnection`.

### Dependency

An asset the target uses, directly or through another dependency, such as
the textures of a voxel map. The session loads every dependency of a declared
kind before the editor mounts. It then follows the target while the editor
runs: when someone adds or removes a reference, it loads or drops the
matching dependency.

*In code:* `session.dependencies()`, `session.dependency(id)`, and the
`dependency-added` and `dependency-removed` events.

### Lease

A hold on a shared asset. Everything on the page that needs the same asset
shares one live copy, kept up to date with other people's edits. Each holder
releases its lease when done, and the copy closes when the last one lets go.
A panel that needs an asset for longer than the session keeps it takes its
own lease.

*In code:* [`AssetLeases`](./docs/lease/AssetLeases.md) as `session.assets`.
An `AssetDocumentKind` creates the `SyncedDocument` its holders share.

## Where the page runs

### Placement

Where the page runs, decided once from the launch: framed by another app such
as the studio, or alone in a browser tab; connected to a server, opened from a
share link, or in offline mode. It sets what the page offers. A framed
page hands its console and its unsaved-changes warning to the app around it,
while a page in a tab shows its own console and asks the browser to warn
before leaving. The asset picker appears only in a tab, the version picker
only on a server, and a share link gets neither.

*In code:* read from `launch.shell`, `launch.credential` and
`session.offline`. An editor sees the result in `context.shell` and in which
of `context.toolbar.targets` and `tags` are set.

### Offline mode

Assets stored in the browser instead of on a server, so an editor works with
no back-end. The host runs the asset back-end inside the page and the editor
mounts exactly as it does online. Assets stored in IndexedDB outlive the
page: one tab owns them and the other tabs of that browser go through it.
Assets kept in memory are lost on reload. Without a target in the address,
the page opens the asset last opened in this browser.

*In code:* the `@jolly-pixel/editor.host/offline` entry,
`openOfflineBackend()`, and `session.offline`, which is `null` on a
server. [`bootStandalone`](./docs/editor/bootStandalone.md#offline-mode)
offers it when the server cannot be reached.
