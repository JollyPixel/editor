# bindPresenceStack

Keeps a [`jolly-presence-stack`](./presence-stack.md) element in step with a
list of peers.

```ts
import { bindPresenceStack } from "@jolly-pixel/ui";

const unbind = bindPresenceStack(
  presenceStack,
  editing.state.presence,
  (clientId) => editing.teleportToPeer(clientId)
);
```

```ts
function bindPresenceStack(
  element: PresenceStack,
  source: PeerListSource,
  onSelect: (clientId: string) => void
): () => void;

interface PeerListSource {
  readonly peers: readonly PresencePeer[];
  subscribe(
    event: "peersChange",
    listener: (peers: readonly PresencePeer[]) => void
  ): () => void;
}
```

- `PeerListSource` is a ready list of `PresencePeer`. It is not the
  [`PresenceSource`](./presence-source.md) port, whose peers become a list
  with `toPresencePeers(presence.peers.values(), presence.clientId)`.
- The element shows `source.peers`, and is hidden while the local peer is
  alone.
- `onSelect` receives the client id of the peer clicked in the stack.
- The returned function stops both.
