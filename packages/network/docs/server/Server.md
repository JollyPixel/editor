# Server

`Server`
authenticates connections and routes room activity to extensions.

```ts
import { PresenceOnlyExtension, Server } from "@jolly-pixel/network";

const server = new Server();
server.register(new PresenceOnlyExtension("lobby"));
```

## Constructor

```ts
interface ServerOptions {
  logger?: Logger;
  rights?: RightsMap;
  defaultRole?: string;
  auth?: AuthenticationProvider;
  admits?: RoomAdmission;
  roomGraceMs?: number;
  limits?: RoomLimits;
  validateOutbound?: boolean;
}
```

`new Server(options?)` configures logging, [access](./Access.md), grace periods,
and room limits.

`validateOutbound` defaults to `true`. With `false`, rooms name each outbound
message from its tags (`MessageParser.identify`) without validating it, and
drop a message no tag names. A server running in the browser uses it to skip
checking the messages it produces itself.

## Methods

### `register(extension): void`

Mounts a static room at `extension.id`.

### `authenticate(attempt): Promise<PeerIdentity | null>`

Resolves a trusted identity or `null`.

### `connect(handle, identity): ServerConnection`

Returns a session with `receive(raw)` and `close()`.
Activity is ordered per connection and room.

### `revoke(subject): void`

Blocks further activity, then requests reauthentication after in-flight work drains.

### `updateProfile(subject, patch): void`

Merges `patch` into the server-owned profile of every connection of `subject`, so
rooms it joins later carry it. After in-flight work drains, each room it is in
sends `peer-profile` to every member, the subject's own connections included.

### `close(): Promise<void>`

Disposes rooms and workers. Await it; close transport resources too.

## Dynamic rooms

`setRoomResolver(resolver)` handles unknown names on join. Return
`{ extension, onEvict?, graceMs?, readOnly? }` or `null`; promises are
supported.

`readOnly: true` caps every message right in that room at `read`, whatever
the rights table says: members still join and update presence, their sync
reports `read` for each message event, and their messages are denied. The
extension must declare an inbound message protocol, or the join is refused
with `UngatedExtensionError`.

Empty resolved rooms expire after `roomGraceMs` (default `30_000` ms).
Eviction awaits `onEvict`, then `dispose()`.

A join cancels pending eviction or waits for active eviction.
`settled(roomName?)` waits for eviction already running.
