# Collaboration

Show who is connected, what each peer is working on, and which field a peer is
editing. The package owns no transport: the adapters below read a
`@jolly-pixel/network` room, from the `@jolly-pixel/ui/network` subpath.

## 1. Name the local user

```ts
import { promptPeerIdentity } from "@jolly-pixel/ui";
import { toPeerProfileMetadata } from "@jolly-pixel/ui/network";

const identity = await promptPeerIdentity({
  title: "Join voxel map",
  storageKey: "voxel-map:username"
});

const client = new Client({ profile: toPeerProfileMetadata(identity) });
```

- The username is asked once per tab, then reused. An empty answer gives
  `"Guest"`.
- The colour is derived from `peerId`, so one user keeps one colour on every
  client.
- With accounts, build the identity with `peerIdentity(account.username,
  account.id, account.avatar)` instead of prompting.

## 2. Show who is connected

```ts
import { PeerRoster } from "@jolly-pixel/ui/network";

const stack = document.querySelector("jolly-presence-stack");
const roster = new PeerRoster({
  room,
  publish: (peers) => {
    stack.peers = peers;
  },
  log
});
```

- `jolly-presence-stack` is a row of avatars for a viewport corner.
  `jolly-presence` is the same list with names, for a panel.
- The local peer comes first, then remote peers by `clientId`, so every client
  shows the same order.
- With a `LogQueue` as `log`, the roster writes a "has joined" or "has left"
  line to a `jolly-log`.
- With `selectable`, clicking a remote avatar emits `jolly-peer-select`. What
  it does, such as moving the camera to the peer, is up to the editor.
- `roster.dispose()` unsubscribes and publishes an empty list.

## 3. Mark what each peer selected

```ts
import { PeerMarkTracker, peerBadges } from "@jolly-pixel/ui/network";

const marks = new PeerMarkTracker<string>({
  room,
  presenceKey: "layer",
  localKey: () => selection.layerId,
  readKey: (value) => (typeof value === "string" ? value : null),
  publish: (map) => {
    panel.layerMarks = map;
  }
});

selection.subscribe("change", () => marks.publishLocal());
```

```ts
const node: TreeNode = {
  id: layer.id,
  label: layer.name,
  badges: peerBadges(layer.id, this.layerMarks)
};
```

- The tracker publishes one key per client under `presenceKey`, and folds the
  remote keys into a map from key to peers.
- Call `publishLocal()` when the local selection changes. An unchanged key is
  not sent again.
- `peerBadges` gives at most three coloured dots per row, titled with the peer
  names.
- One tracker per kind of mark: a `layer` tracker and a `block` tracker do not
  mix.
- For a mark drawn in the viewport, such as a peer's brush outline, colour it
  with `peerProfileColor(clientId, profile)`.

## 4. Lock the field a peer is editing

```ts
import { RoomPresenceSource } from "@jolly-pixel/ui/network";

const inspector = document.querySelector("jolly-pane[key=inspector]");
inspector.presence = new RoomPresenceSource(room);
```

```ts
html`
  <jolly-number
    label="Roughness"
    path=${`material:${material.id}:roughness`}
    .value=${this.#roughness.value}
    @jolly-change=${this.#roughness.commit}
  ></jolly-number>
`;
```

- Every field under the pane finds the source. A field with a `path` claims
  it on focus and releases it on blur.
- Other clients show the field locked in the holder's colour: read-only, still
  focusable, with "Held by" on hover.
- Build `path` from model ids, never from a label or the DOM position. Two
  clients must compute the same string.
- Locks are advisory: they only paint. Two clients that focus one field at the
  same moment can both edit it, and the document layer resolves their writes.
- A field without `path` never locks.

## 5. Without `@jolly-pixel/network`

`PresenceSource` is a port. Implement it over another transport, and the
fields lock the same way:

```ts
interface PresenceSource {
  readonly clientId: string;
  readonly peers: ReadonlyMap<string, CollaboratorPresence>;
  claim(path: string): LockState;
  release(path: string): void;
  on(event: "change", listener: () => void): void;
  off(event: "change", listener: () => void): void;
}
```

Feed `jolly-presence` from the same source with
`toPresencePeers(source.peers.values(), source.clientId)`.
