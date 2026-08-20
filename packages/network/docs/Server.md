# Server

Transport-agnostic router between raw connections and registered `Extension` instances. One extension serves one room id, so unrelated features share a single socket without knowing about each other. See [Extension](./Extension.md) for the room-side API, including worker-mode extensions.

```ts
new Server(options?: ServerOptions)

interface ServerOptions {
  logger?: Logger;
  /**
   * Per-role rights table, shared by every room this server registers.
   * Omitted means unrestricted access.
   */
  rights?: RightsMap;
  eventStore?: EventStore.EventStore;
  /**
   * Empty resolved-room grace period in milliseconds.
   * @default 30_000
   */
  roomGraceMs?: number;
  /**
   * Clock behind room eviction. Injected so a caller can drive the grace
   * period instead of waiting on it.
   */
  timers?: Timers;
}
```

- `register(extension)` — registers a static room under `extension.id`. Pass an `Extension` or a [worker descriptor](./Extension.md#worker-extensions).
- `close()` — stops workers and disposes rooms. Call it before process exit when using worker extensions. Also available as `[Symbol.asyncDispose]` for `await using`.
- `logger` — a `loglayer` `ILogLayer` passed to every room.
- `rights` — see [Rights](./Rights.md). One table for the whole server; there is no per-room override.

Transport implementations call `handleConnect`, `handleDisconnect` and `handleMessage`. The message and disconnect handlers return `Promise<void>`. Envelopes from one client are always handled in arrival order.

## Dynamic rooms

`register` covers rooms known up front. Use a resolver when room names are
created at join time, such as one room per open document or match.

```ts
server.setRoomResolver((roomName) => RoomResolution | null);

interface RoomResolution {
  extension: Extension;
  onEvict?: () => void | Promise<void>;
  graceMs?: number;
}
```

The resolver runs when a client joins an unknown room. Return `null` to reject
the room name. Messages to unknown rooms are dropped without invoking the
resolver.

The requested room name identifies the resolved room and appears in outbound
envelopes. It does not need to match `extension.id`.

### Eviction

A resolved room remains available for a grace period after its last member
leaves. A join during that period cancels eviction.

When the grace period expires, the server awaits `onEvict` and then calls the
extension's optional `dispose()` method. A join for the same name waits for an
in-progress eviction to finish.

- `roomGraceMs` (`ServerOptions`) sets the default, `30_000` ms. A
  resolution may override it per room.
- `close()` evicts every resolved room, running each `onEvict`, then
  disposes every room including statically registered ones.
- `settled(roomName?)` resolves once an in-flight eviction has finished, for
  one room or all of them. Eviction starts on a timer and tears down
  asynchronously, so a caller that needs an evicted room's flushed state
  awaits this rather than racing the teardown.
- `timers` (`ServerOptions`) replaces the clock behind the grace period.
  `systemTimers` is the default; a test supplies one it advances by hand, so
  eviction is deterministic instead of wall-clock bound.
