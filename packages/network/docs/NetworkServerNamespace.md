# NetworkServerNamespace

Internal collaborator of [`NetworkServer`](./NetworkServer.md). Not exported from `@jolly-pixel/network`.

```ts
new NetworkServerNamespace(
  plugin: NetworkPlugin,
  resolveClient: (clientId: string) => ClientHandle | undefined
)
```

- `plugin`: namespace behavior implementation.
- `resolveClient`: lookup function into server-owned client registry.

## Methods

### `join`

```ts
join(clientId: string, client: ClientHandle, identity: PeerMetadata): void
```

- Broadcasts `"peer-joined"` to existing members (excluding joiner).
- Sends `"sync"` with pre-existing members to joiner when namespace is non-empty.
- Stores member identity and initializes presence `{}`.
- Calls plugin `onClientConnect` with namespace-scoped `client.send()`.

### `leave`

```ts
leave(clientId: string): void
```

- Removes member.
- Broadcasts `"peer-left"` to remaining members.
- Calls plugin `onClientDisconnect`.

### `updatePresence`

```ts
updatePresence(clientId: string, patch: PeerMetadata): void
```

- No-op when client is not a member.
- Shallow-merges patch into stored presence.
- Broadcasts `"peer-presence"` to other members.

### `message`

```ts
message(clientId: string, payload: unknown): void
```

Forwards payload to plugin `onMessage`.

### `broadcast`

```ts
broadcast(payload: unknown): void
```

Broadcasts namespace-scoped `"message"` to all members.

## Responsibility Split

- `NetworkServer` validates envelopes and join authorization.
- `NetworkServerNamespace` owns member state and namespace-level fanout.
