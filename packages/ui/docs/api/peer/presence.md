# `jolly-presence`

`jolly-presence` renders a read-only list of the peers in a session.

```ts
const presence = document.querySelector("jolly-presence");
presence.peers = [
  { clientId: "local", displayName: "Ada", color: "#f94144", self: true },
  { clientId: "remote", displayName: "Lin", color: "#43aa8b" }
];
presence.max = 5;
```

## Properties

```ts
interface PresenceElement {
  peers: Iterable<PresencePeer>; // copied on assignment
  max: number; // default Infinity, floored and clamped to zero
  selectable: boolean;
}

interface PresencePeer extends CollaboratorPresence {
  self?: boolean;
  peerId?: string; // picks the default avatar, default clientId
  avatar?: string; // image URL
  badge?: string; // short label after the name, such as "via link"
}
```

- Each row starts with a [`jolly-avatar`](./avatar.md).
- `editing` is ignored: this is a session list, not a field.
- Build the list with [`toPresencePeers`](./presence-source.md#mapping).
- When `max` hides the local peer, it replaces the last visible remote peer.
- Parts: `summary`, `list`, `peer`, `peer-button`, `avatar`, `badge`,
  `overflow`.

## Selection

With `selectable`, each remote row is a button. The local peer stays plain
text.

```ts
interface PresenceEvents {
  // Bubbles, composed, not cancelable.
  "jolly-peer-select": { clientId: string; };
}

presence.selectable = true;
presence.addEventListener("jolly-peer-select", (event) => {
  focusOn(event.detail.clientId);
});
```

The element keeps no selected row: the host decides what selecting a peer
does.
