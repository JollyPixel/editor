# Shell

A shell is a page that frames editor pages, such as the studio. It launches
each frame with a target, shares its catalog, console, appearance and
preferences with it, and hears back the frame's state.

On the editor side, `context.shell` is a `ShellChannel` when a shell launched
the page and `null` otherwise. `shell.openAsset(id, reveal?)` asks the shell to
open another asset in its own tab.

## Reveals

A reveal names something the opened editor should show, such as a voxel map
anchor key. `shell.openAsset(id, reveal)` passes it on. The editor reads it
with `shell.onReveal(listener, signal)` once it is ready.

- The shell posts it as `jolly-reveal`. For a frame it has not launched yet,
  it sends the reveal in `jolly-launch`.
- The channel keeps the last reveal that arrives while no listener is set and
  hands it to the next `onReveal()` call.
- A channel has one reveal listener: a later `onReveal()` replaces the
  previous one, and aborting the signal removes it.

## Messages

```ts
// frame → shell
{ type: "jolly-ready" }
{ type: "jolly-open-asset", target: string, reveal?: string }
{ type: "jolly-toggle-console" }
{ type: "jolly-session-refused" }
{ type: "jolly-unsaved", unsaved: boolean }
{ type: "jolly-editor-state", state: EditorState }
{ type: "jolly-update-preferences", scope: string, patch: PreferenceOverrides }
{ type: "jolly-notification", id: string, notification: NotificationInit }
{ type: "jolly-notification-update", id: string, patch: NotificationPatch }
{ type: "jolly-notification-dismiss", id: string }

// shell → frame
{
  type: "jolly-launch",
  target: string,
  reveal?: string,
  appearance?: Appearance,
  identity: { username: string; peerId: string; avatar?: string; } | null,
  preferences: Record<string, PreferenceOverrides>,
  ports: { catalog?: MessagePort; console?: MessagePort; }
}
{ type: "jolly-appearance", appearance: Appearance }
{ type: "jolly-preferences", scope: string, overrides: PreferenceOverrides }
{ type: "jolly-session-renewed" }
{ type: "jolly-reveal", key: string }
```

The frame's list is the `FrameMessage` union. The shell's list is
`LaunchMessage`, then the `ShellMessage` union of what follows the launch.
`parseFrameMessage(data)`, `parseLaunchMessage(data)` and
`parseShellMessage(data)` return the message, or `undefined` when it is not
one. `ShellCommand` is a `FrameMessage` other than `jolly-ready` and the
notifications.

- The frame posts `jolly-ready` and waits one second for `jolly-launch` from
  an allowed origin. An invalid `reveal`, `appearance`, `identity`,
  `preferences` or `ports` field is dropped, not the whole launch.
- With `identity`, the frame joins as that peer instead of prompting, so every
  frame shares the shell's name and presence color. `avatar` is the
  same-origin path of the peer's uploaded avatar.
- `shell.onAppearance(listener, signal)` calls the listener with the latest
  appearance at once, then with each `jolly-appearance`.
  `shell.onPreferences(listener, signal)` calls it once per scope with the
  latest overrides, then with each `jolly-preferences`. The latest values start
  from the launch, so a listener added late misses nothing.
- `jolly-editor-state` reports the
  [page state](../boot/bootStandalone.md#page-state). `jolly-unsaved` reports
  `true` as soon as the frame has unsaved changes, and `false` once they have
  stayed saved for 400 ms, so steady editing does not flicker the tab.
- `jolly-update-preferences` carries one change. The shell validates it, stores it,
  and pushes the scope's overrides to every frame as `jolly-preferences`,
  sender included. On a refused patch it pushes its own overrides, so the
  frames drop the refused values.
- `jolly-session-refused` is posted when the server refuses the frame's session.
  The frame reconnects on `jolly-session-renewed` and keeps its rooms and
  pending changes.

## Notifications

`ShellChannel` is a `Notifier` from `@jolly-pixel/ui`:
`shell.notify(init)` posts `jolly-notification`, and the returned handle posts
`jolly-notification-update` and `jolly-notification-dismiss` under the same id.

- Ids are unique per frame, so the shell keys them by frame.
- The shell sets `source` to the frame's name, replacing any the frame sent.
- Under no shell, [`context.notifications`](../contract/EditorDefinition.md#context)
  is a `NotificationQueue` shown by a `jolly-notifications` stack in the page.

## Catalog port

`CatalogShare` serves the shell's catalog to frames, so they do not join the
catalog room themselves:

```ts
const share = await CatalogShare.open(client, { timeoutMs: 5_000 });
const channel = new MessageChannel();
const stop = share.serve(channel.port1);

const launch: LaunchMessage = {
  type: "jolly-launch",
  target,
  appearance,
  identity: null,
  preferences: {},
  ports: { catalog: channel.port2 }
};
frame.contentWindow.postMessage(launch, origin, [channel.port2]);
```

Each port gets a snapshot, then every catalog message. `stop()` closes one
port; `share.dispose()` closes them all.

## Console port

With `ports.console`, the frame serves its console namespaces on that port.
The shell shows them with `FrameConsoles`:

```ts
const consoles = new FrameConsoles({ commands });

const disconnect = consoles.connect(tabId, port);
consoles.focus(tabId);
```

- Only the focused frame's namespaces show.
- Connecting an id again replaces its port, which is how a reloaded frame
  takes over.
- A frame namespace whose name the shell already uses stays hidden.

`mountConsole({ parent?, storage?, appearance?, logger? })` gives the shell
page the same console as an editor page: a `CommandConsole` behind Ctrl+K,
with the `theme` and `density` root variables written to `appearance`.

## Appearance

`PageAppearance` reads and writes theme and density on every `jolly-scope`
element under a root, `document` by default.

```ts
class PageAppearance implements Appearance {
  constructor(root?: ParentNode);
  theme: ThemeMode;
  density: Density;
  apply(appearance: Appearance): void;
  watch(listener: (appearance: Appearance) => void, signal: AbortSignal): void;
  toJSON(): Appearance;
}
```

The setters throw when no scope exists; `apply` does nothing then.

## Offline

`withOfflineFallback({ message, online, offline })` runs `online` and, when
the server cannot be reached, shows the Retry or Work offline dialog of
[`bootStandalone`](../boot/bootStandalone.md#startup).

`openOfflineBackend({ project, name? })` from `@jolly-pixel/editor.host/offline`
runs the asset back-end in the page. `backend.connect().client` feeds a
`CatalogShare`, and `offlineQuery(name)` gives the query that opens editor
frames on the same data:

```ts
const backend = await openOfflineBackend({ project, name: "studio" });
const share = await CatalogShare.open(backend.connect().client);
const editorQuery = offlineQuery("studio"); // { offline: "studio" }
```

## Other helpers

- `readDebugLogger()` builds the [debug logger](../boot/bootStandalone.md#debug-logging)
  from `location.search` and `localStorage`.
- `registerKindIcon(descriptor)` registers an asset kind's icon as
  `kind:<kind>` and returns that name, or `undefined` when the kind has none.
- `askImportConflictPolicy(plan)` asks how an archive import handles existing
  assets, `null` when dismissed.
