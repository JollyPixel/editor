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
| `selectable` | `boolean` | `false` |

`PresencePeer` extends [`CollaboratorPresence`](./presence-source.md), adding
`self`. The element ignores `editing`: it renders a session snapshot, not a
field. Build the list with [`toPresencePeers`](./presence-source.md#mapping), which
flags the local peer and orders it first.

Assigning `peers` copies the iterable. Finite `max` values are floored and
clamped to zero. When a capped list hides the local peer, the local peer
replaces the final visible remote peer. The component exposes `summary`,
`list`, `peer`, `peer-button`, `swatch`, and `overflow` CSS parts.

## Selection

With `selectable`, every remote row renders a button inside its `peer` row and
a click raises `jolly-peer-select`. The local peer stays plain text.

```ts
presence.selectable = true;
presence.addEventListener("jolly-peer-select", (event) => {
  focusOn(event.detail.clientId);
});
```

| Event | Detail | Bubbles | Composed | Cancelable |
|---|---|---|---|---|
| `jolly-peer-select` | `{ clientId }` | yes | yes | no |

The element holds no selected row and changes nothing on a click: it states an
intent and the host decides what a peer means, per
[ADR-0029](../../adr/0029-presence-selection-is-an-intent.md). A click on a peer
the host cannot act on is a silent no-op.
