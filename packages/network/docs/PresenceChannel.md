# PresenceChannel

Reads and publishes one presence field of a `Room` as a typed per-peer value.

```ts
interface PresenceChannelOptions<T> {
  key: string;
  decode: (value: unknown) => T | undefined;
  equals?: (left: T, right: T) => boolean;
}

interface PresenceChange<T> {
  clientId: string;
  value: T | undefined;
}

class PresenceChannel<T> extends Emitter<{
  change: (event: PresenceChange<T>) => void;
}> {
  constructor(room: Room, options: PresenceChannelOptions<T>);

  readonly key: string;
  readonly values: ReadonlyMap<string, T>;

  publish(value: T): boolean;
  destroy(): void;
}
```

## Usage

```ts
const cursors = new PresenceChannel(room, {
  key: "cursor",
  decode: (value) => isVec2(value) ? value : undefined,
  equals: vec2Equal
});

cursors.on("change", ({ clientId, value }) => {
  if (value === undefined) {
    overlay.remove(clientId);
  }
  else {
    overlay.set(clientId, value);
  }
});

canvas.onCursorMove = (position) => cursors.publish(position);
```

## Behavior

- `values` holds remote peers only. A peer is present once `decode` returns something other than `undefined`.
- The constructor replays `room.peers`. `sync` replays them again and removes peers that are gone. `peer-joined` reads the join presence, and `peer-presence` applies only patches that carry `key`.
- `decode` returning `undefined` removes the peer value, so a malformed value and a cleared one (`null`) behave the same unless `decode` keeps `null`.
- `change` fires with `value: undefined` when a value is removed: undecodable, `peer-left`, or `destroy()`.
- `publish(value)` calls `room.updatePresence({ [key]: value })`, skipping a value `equals` to the last published one, and returns whether it sent. `equals` defaults to `Object.is`. Publishing before `join()` is safe: the room sends it with the join.
- Rate limiting is left to the caller.
- `destroy()` removes the room listeners and every value. It never calls `room.leave()`.
