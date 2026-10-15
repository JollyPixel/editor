# Presence facade

`addPresence(options?)` creates a [`jolly-presence`](../peer/presence.md)
snapshot view. `Presence` is also exported for direct construction.

```ts
interface PresenceOptions {
  max?: number; // named peers shown, default Infinity
  selectable?: boolean; // remote rows become buttons
}

const presence = pane.addPresence({ max: 5 });
presence.update(peers);
```

## Members

```ts
interface Presence extends FacadeItem {
  max: number; // floored, clamped to zero
  selectable: boolean;
  update(peers: Iterable<PresencePeer>): void;
  onSelect(handler: (clientId: string) => void): () => void;
}
```

- `update()` replaces the snapshot. The iterable is copied.
- `onSelect()` subscribes to `jolly-peer-select` from remote rows and returns
  the unsubscribe. See [selection](../peer/presence.md#selection).
