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
}
```

- `register(extension)` — activates a room, keyed by `extension.id`. Accepts either an `Extension` instance (runs in-process) or a `WorkerExtensionDescriptor` (runs in a dedicated worker thread — see [Worker Extensions](./Extension.md#worker-extensions)).
- `close()` — terminates every worker spawned by a worker-mode registration. A `Worker` keeps the process alive on its own, so any process (or test) that registers a worker-mode extension must call this before it can exit cleanly. A no-op if nothing worker-mode was registered. Also available as `[Symbol.asyncDispose]` for `await using`.
- `logger` — a `loglayer` `ILogLayer`, defaulting to a pino-backed instance, passed down to every room.
- `rights` — see [Rights](./Rights.md). One table for the whole server; there is no per-room override.

`handleConnect` / `handleDisconnect` / `handleMessage` are called by transport code, not by application code. `handleMessage` and `handleDisconnect` return `Promise<void>`: dispatch to the extension is asynchronous — a worker-mode extension's dispatch genuinely round-trips to its thread, while an in-process one resolves on the same tick — and per-client ordering is preserved regardless: a given client's envelopes are always dispatched in the order they arrived, even though each one is now awaited.
