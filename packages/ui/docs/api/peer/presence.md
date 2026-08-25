# `jolly-presence`

`jolly-presence` renders a read-only collaboration snapshot.

```ts
const presence = document.querySelector("jolly-presence");
presence.peers = [
  { clientId: "local", displayName: "Ada", color: "#f94144", self: true },
  { clientId: "remote", displayName: "Lin", color: "#43aa8b" }
];
presence.max = 5;
```

| Property | Type | Default |
|---|---|---|
| `peers` | `Iterable<PresencePeer>` | `[]` |
| `max` | `number` | `Infinity` |

`PresencePeer` extends [`CollaboratorPresence`](./presence-source.md), adding
`self`. The element ignores `editing`: it renders a session snapshot, not a
field. Build the list with [`toPresencePeers`](./presence-source.md#mapping), which
flags the local peer and orders it first.

Assigning `peers` copies the iterable. Finite `max` values are floored and
clamped to zero. When a capped list hides the local peer, the local peer
replaces the final visible remote peer. The component exposes `summary`,
`list`, `peer`, `swatch`, and `overflow` CSS parts.
