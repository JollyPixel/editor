# ShellChannel

The protocol between a shell, such as the studio, and the editor pages it
frames. A launch read from the parent's `jolly-launch` carries a
`ShellChannel` as `launch.shell` and `context.shell`. Any other launch has
none, and an editor hides what only a shell can do.

## Messages

```ts
// frame → shell
{ type: "jolly-ready" }
{ type: "jolly-shell", command: "open-asset", target: string }
{ type: "jolly-shell", command: "toggle-console" }
{ type: "jolly-shell", command: "session-refused" }
{ type: "jolly-shell", command: "unsaved", unsaved: boolean }
{ type: "jolly-shell", command: "editor-state", state: EditorState }

// shell → frame
{
  type: "jolly-launch",
  target: string,
  appearance?: Appearance,
  identity: { username: string; peerId: string; avatar?: string; } | null,
  ports: { catalog?: MessagePort; console?: MessagePort; }
}
{ type: "jolly-appearance", appearance: Appearance }
{ type: "jolly-session-renewed" }
```

The shell builds its messages with `launchMessage`, `appearanceMessage` and
`sessionRenewedMessage`, and narrows what a frame posts with
`isReadyMessage` and `isShellCommand`. The frame reads `jolly-launch` with
`parseLaunchMessage`, which drops an invalid `appearance`, `identity` or
`ports` instead of rejecting the message.

## ShellChannel

```ts
class ShellChannel {
  readonly origin: string;
  readonly appearance: Appearance | null;
  readonly catalog: ShellCatalog | null;
  readonly console: MessagePort | null;
  readonly identity: PeerIdentity | null;

  openAsset(id: AssetId | string): void;
  toggleConsole(): void;
  reportUnsaved(unsaved: boolean): void;
  reportState(state: EditorState): void;
  renewWhenRefused(client: RenewableClient): void;
  onAppearance(listener: (appearance: Appearance) => void, signal: AbortSignal): void;
}
```

The channel is bound to the parent and the origin of its `jolly-launch`. It
posts commands and receives appearance changes; commands get no reply.

### identity

The shell's user as a `PeerIdentity` colored from `peerId`. The session joins
as that peer instead of prompting, so every frame of one shell shares a name
and a presence color.

### reportUnsaved(unsaved)

`mountStandalone` calls it each time the
[unsaved state](../lease/AssetLeases.md#unsaved-changes) of the session flips.

### reportState(state)

`mountStandalone` calls it with the current
[page state](../editor/mountStandalone.md#page-lifecycle) once the launch is
read, then on every change. The studio shows a spinner on the tab while the
state is `booting` or `switching`, and a warning once it is `failed`.

### renewWhenRefused(client)

Posts `session-refused` each time the server refuses `client`'s session, then
calls `client.reconnect()` when the shell answers `jolly-session-renewed`.
The session calls it on the client it creates, so a framed editor keeps its
rooms and pending changes while the user signs in again.

## Catalog port

With `ports.catalog`, the session opens its catalog through the shell's
instead of joining the catalog room itself. The shell shares its own catalog
with `CatalogShare`:

```ts
const share = await CatalogShare.open(client, { timeoutMs: 5_000 });
const channel = new MessageChannel();
const stop = share.serve(channel.port1);

frame.contentWindow.postMessage(
  launchMessage({ target, appearance, ports: { catalog: channel.port2 } }),
  origin,
  [channel.port2]
);
```

Each port gets a snapshot, then every message of the catalog room. A command
sent by a frame goes out on the room and its reply comes back to that frame.
`stop()` closes the port; `share.dispose()` stops every frame and disposes
`share.catalog`.

## Console port

With `ports.console`, the page serves the namespaces of `context.commands` on
it with a [`ConsoleServer`](../../../../console/docs/remote.md). Root variables
stay on the page. The shell mirrors them with `FrameConsoles`:

```ts
class FrameConsoles {
  constructor(options: { commands: CommandConsole; logger?: HostLogger; });
  connect(id: string, port: MessagePort): () => void;
  focus(id: string | null): void;
}
```

Only the focused frame's namespaces show on the shell console. Connecting an
id again replaces its port, which is how a reloaded frame takes over. A frame
namespace whose name the shell already uses stays hidden, with a warning on
`host.console`.

## Appearance

The shell sends its theme and density in `jolly-launch`, then each change as
`jolly-appearance`. The page applies them to its `jolly-scope` elements before
`mount` and after. `auto` removes the `theme` attribute.

`PageAppearance` reads and writes the `jolly-scope` elements under a root,
`document` by default:

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

The getters read the first scope. The setters write every scope and throw
when there is none; `apply` does nothing then. `watch` reports attribute
changes on any scope, including scopes added later.
