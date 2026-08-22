# Presence facade

`pane.addPresence(options?)` and `folder.addPresence(options?)` create a
`jolly-presence` snapshot view. `Presence` is also exported for direct
construction.

```ts
interface PresenceOptions {
  max?: number;
}

const presence = pane.addPresence({ max: 5 });
presence.update(peers);
```

`max` defaults to `Infinity`. Finite values are floored and clamped to zero.
The property remains mutable through `presence.max`.

```ts
update(peers: Iterable<PresencePeer>): void
```

`update()` replaces the rendered snapshot. The element copies the iterable,
so later mutations to the source collection do not change the view. Peer
shape, overflow behavior, and accessibility are documented under
[`jolly-presence`](../peer/presence.md).

The builder exposes `element`, `max`, `hidden`, `disabled`, and
`dispose()`.

