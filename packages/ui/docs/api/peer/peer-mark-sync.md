# `PeerMarkSync`

Draws successive [`PeerMarks`](./peer-marks.md) on a view that shows one mark
per peer, such as a peer highlight or an outlined UV region. It remembers the
marks it drew last, so each `apply` only touches peers that changed.

```ts
import { PeerMarkSync } from "@jolly-pixel/ui";

const highlights = new PeerMarkSync<string>({
  hold: (peer, key) => highlight.peers.select(peer.clientId, key),
  release: (clientId) => highlight.peers.select(clientId, null)
});
presence.subscribe("selectionsChange", (marks) => highlights.apply(marks));
```

```ts
interface PeerMarkHandlers<TKey> {
  hold(peer: PresencePeer, key: TKey): void;
  release(clientId: string): void;
}
```

### `apply(marks): void`

- Releases the peers that left first, then holds the peers whose key changed.
- A peer that moved gets one `hold`, without a `release` before it.
- Unchanged peers get no call, even when their name or colour changed.
- `apply(new PeerMarks())` releases every peer.
