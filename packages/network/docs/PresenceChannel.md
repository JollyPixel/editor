# PresenceChannel

Reads and publishes one presence field of a `Room` as a typed per-peer value.

```ts
type PresenceDecoder<T> =
  | ((value: unknown) => T | undefined)
  | z.core.$ZodType<T>;

interface PresenceChannelOptions<T> {
  key: string;
  decode: PresenceDecoder<T>;
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

`decode` also takes a zod schema, classic or `zod/mini`. `T` is inferred from it:

```ts
import * as z from "zod/mini";

const tools = new PresenceChannel(room, {
  key: "tool",
  decode: z.enum(["brush", "fill"])
});
```

## Behavior

- `values` holds remote peers only. A peer is present once `decode` returns something other than `undefined`.
- The constructor, `sync` and the room's `left` reconcile every peer against `room.peers` and remove the ones that are gone. `peer-joined` reads the join presence from `room.peers`, `peer-left` removes the value, and `peer-presence` applies only patches that carry `key`.
- `change` fires only when a decoded value differs from the stored one by `equals`, so a `sync` repeating a value stays quiet.
- `decode` returning `undefined` removes the peer value, so a malformed value and a cleared one (`null`) behave the same unless `decode` keeps `null`. A schema whose parse fails counts as `undefined`, and a passing parse yields the schema output, so an object schema drops unknown keys.
- `change` fires with `value: undefined` when a value is removed: undecodable, `peer-left`, the room left, or `destroy()`.
- `publish(value)` calls `room.updatePresence({ [key]: value })`, skipping a value `equals` to the last published one, and returns whether it sent. `equals` defaults to `Object.is`. Publishing before `join()` is safe: the room sends it with the join.
- Rate limiting is left to the caller.
- `destroy()` removes the room listeners and every value. It never calls `room.leave()`.
