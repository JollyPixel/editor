# `jolly-presence`

`jolly-presence` renders a read-only collaboration snapshot.

```ts
const presence = document.querySelector("jolly-presence");
presence.peers = [
  { id: "local", username: "Ada", color: "#f94144", self: true },
  { id: "remote", username: "Lin", color: "#43aa8b" }
];
presence.max = 5;
```

| Property | Type | Default |
|---|---|---|
| `peers` | `Iterable<PresencePeer>` | `[]` |
| `max` | `number` | `Infinity` |

Assigning `peers` copies the iterable. Finite `max` values are floored and
clamped to zero. When a capped list hides the local peer, the local peer
replaces the final visible remote peer. The component exposes `summary`,
`list`, `peer`, `swatch`, and `overflow` CSS parts.
