# Field locks

A field locks while a remote peer edits it. The core package depends on
nothing network related: it declares the `FieldLockSource` port, and
[`RoomFieldLocks`](../network.md#roomfieldlocks) implements it over a
`@jolly-pixel/network` room.

## Wiring a pane

```ts
import { RoomFieldLocks } from "@jolly-pixel/ui/network";

pane.fieldLocks = new RoomFieldLocks(room);
```

```ts
html`<jolly-number path="map.width" .value=${width}></jolly-number>`;
```

- Fields find the nearest ancestor's source when they connect, so one property
  turns on locking for the whole subtree. Without a source, fields never lock.
- `path` is supplied by the consumer. Do not derive it from a label or DOM
  position: two clients would only agree while their trees are identical.
- A field with `path === null`, the default, never claims.
- A focused field publishes its path. Other clients show it locked in the
  holder's colour.
- The local peer never locks its own field. Local focus beats a remote claim:
  contention shows as a peer chip, not a lock bar.
- A claim releases on blur, on disconnection, and when `path` changes. A peer's
  claims disappear when it leaves.

## `FieldLockSource`

```ts
interface FieldLockSource {
  editors(path: string): readonly PresencePeer[];
  claim(path: string): void;
  release(path: string): void;
  subscribe(listener: () => void): () => void;
}
```

- `editors(path)` lists the peers editing `path`: the local peer first
  (`self: true`), then remote peers by `clientId`, so every client names the
  same holder. Fields copy it into their
  [`editors`](../field/shared-field-api.md#collaboration).
- A client holds one path at a time: `claim` replaces the previous one.
- Claims are advisory. A claim on a path a remote peer holds goes through, and
  the data layer resolves concurrent writes.
- `release(path)` does nothing unless `path` is the one held.
- `subscribe` calls the listener whenever `editors` may have changed, and
  returns the unsubscribe function.
