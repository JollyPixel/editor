# bindPresenceStack

Keeps a `jolly-presence-stack` element in step with a room's presence.

```ts
const unbind = bindPresenceStack(
  presenceStack,
  editing.state.presence,
  (clientId) => editing.teleportToPeer(clientId)
);
```

```ts
function bindPresenceStack(
  element: PresenceStack,
  presence: PresenceSource,
  onSelect: (clientId: string) => void
): () => void;

interface PresenceSource {
  readonly peers: readonly PresencePeer[];
  subscribe(
    event: "peersChange",
    listener: (peers: readonly PresencePeer[]) => void
  ): () => void;
}
```

- The element shows `presence.peers`, and is hidden while the local peer is
  alone.
- `onSelect` receives the client id of the peer clicked in the stack.
- The returned function stops both.
