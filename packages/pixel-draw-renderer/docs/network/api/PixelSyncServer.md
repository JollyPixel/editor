# PixelSyncServer

Authoritative room extension for one shared `PixelBuffer`.

Import this class from the server-only entry point:

```ts
import {
  PixelSyncServer
} from "@jolly-pixel/pixel-draw.renderer/network/server.ts";
```

## Constructor

```ts
new PixelSyncServer(options?: PixelSyncServerOptions)

interface PixelSyncServerOptions {
  id?: string;
  buffer?: PixelBuffer;
  conflictResolver?: ConflictResolver;
}
```

| Option | Default | Description |
|---|---|---|
| `id` | `"pixel-draw"` | Room name registered by `@jolly-pixel/network` |
| `buffer` | Blank 1 by 1 `PixelBuffer` | Authoritative pixels and UV regions |
| `conflictResolver` | `LastWriteWinsResolver` | Resolver used by the pixel and UV conflict trackers |

## Properties

### `id` / `name`

```ts
readonly id: string
readonly name: "pixel-draw.renderer"
```

`id` identifies the room. `name` scopes rights keys shared by every `PixelSyncServer` instance.

### `events`

```ts
readonly events: readonly PixelBufferHookAction[]
```

Lists the accepted command actions for rights configuration and API discovery.

### `buffer`

```ts
readonly buffer: PixelBuffer
```

The authoritative buffer supplied to the constructor or created by default.

## Methods

### `snapshot()`

```ts
snapshot(): PixelBufferSnapshot
```

Returns the current size, base64 RGBA pixels and serialized UV regions. A snapshot is sent to each client when it joins.

### `receive(command, context)`

```ts
receive(
  command: PixelNetworkCommand,
  context: RoomContext
): void
```

Resolves, applies and broadcasts a trusted typed command. Tests and replay tools can call it with a room context. Network transports should call the extension lifecycle through `@jolly-pixel/network`, which validates unknown input and replaces the embedded `clientId` with the connection ID.

### `getEventName(payload)`

```ts
getEventName(payload: unknown): string
```

Returns a recognized command action or `"invalid"`. The network server uses this value for rights checks before `onMessage()` runs.

## Incoming validation

`onMessage()` accepts commands with:

- A recognized action, string `clientId`, non-negative integer `seq` and finite `timestamp`
- Metadata matching that action
- Integer positions and sizes, with positive widths and heights
- Matching `positions` and `colors` lengths for `select-edit`
- Valid serialized UV region geometry

Malformed commands are ignored. A size rejected by `PixelBuffer` is also ignored. The connection ID replaces the command's claimed `clientId` before conflict resolution and broadcast.

## Conflict resolution

The default resolver tracks strokes and selection edits per pixel. A partially stale command is reduced to its accepted positions; no broadcast occurs when every position is rejected.

UV moves use `<region-id>:<face>` as the conflict key. Collapsed moves use `<region-id>:*`. Delete and state-change commands cover every key for that region and are accepted or rejected as a unit.

Resize, texture replacement, global fill and UV creation bypass conflict trackers and are always accepted after validation. For one tracked key, commands from the same client are accepted in sequence. Commands from different clients compare `timestamp`; a tied timestamp uses the lexicographically greater `clientId`.
