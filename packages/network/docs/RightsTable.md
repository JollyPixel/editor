# RightsTable

Per-role access lookup, matched by glob pattern against a namespaced key (`${authority.name}.${event}`). Built once from [`ServerOptions.rights`](./Server.md#serveroptions), shared by every room that [`Server`](./Server.md) registers, and read by [`ServerRoom`](./ServerRoom.md) to gate joins, presence, message writes, and broadcast fan-out. `RoomAuthority` never holds a `RightsTable` itself.

```ts
type Right = "read" | "write" | "void";
type RightsMap = Record<string, Record<string, Right>>;

class RightsTable {
  constructor(table?: RightsMap);
  readonly configured: boolean;
  check(role: string, key: string): Right;
  scope(namespace: string): RightsGate;
}

class RightsGate {
  readonly configured: boolean;
  check(role: string, event: string): Right;
  canWrite(role: string, event: string): boolean;
}

const JOIN_EVENT = "$join";      // reserved: gates room admission
const PRESENCE_EVENT = "$presence"; // reserved: gates presence updates
```

`RightsMap`'s inner keys are glob patterns, not plain event names — only `*` is special (matches anything, including across `.` separators); every other character, including `.`, is literal. A key with no `*` is just an exact match. There's no glob dependency involved; this is a small hand-rolled matcher scoped to this one need.

## Properties

### `configured`

```ts
readonly configured: boolean
```

`false` when constructed without a table (or an empty one) — every `check()` call returns `"write"` unconditionally, matching this package's default of unrestricted access.

## Methods

### `check`

```ts
check(role: string, key: string): Right
```

Looks up `role`'s patterns and returns the right of the first one that matches `key`, in declaration order — write more specific patterns before broader ones if you need to carve out an exception (e.g. list `"voxel.renderer.$join": "write"` before a catch-all `"voxel.renderer.*"` that would otherwise also swallow `$join`).

Fails open to `"write"` when:

- no table was configured,
- `role` isn't a key in the table,
- no pattern under that role matches `key`.

This means a typo'd role or pattern silently grants full access rather than denying it — intentional, so introducing a `rights` table can never accidentally lock out a role nobody configured yet.

### `scope`

```ts
scope(namespace: string): RightsGate
```

Binds a namespace (`ServerRoom` passes `authority.name`) so callers pass bare event names instead of building `${namespace}.${event}` themselves. The underlying table is still shared — every room scopes the *same* `RightsTable` instance to its own authority name, so a single table can back every room a `Server` registers.

`RightsGate` mirrors `configured` and `check(role, event)` (namespaced automatically), and adds `canWrite(role, event): boolean` — a shorthand for the common `check(...) === "write"` comparison.

## Key format

Internally, `${namespace}.${event}` is the lookup key — for both domain events (from `authority.getEventName(payload)`) and the two reserved events, `"$join"`/`"$presence"`. The namespace is the authority's *type* (e.g. `"voxel.renderer"`), not its `id`, so:

```ts
{
  viewer: {
    "voxel.renderer.$join": "write",       // can join any voxel.renderer room
    "voxel.renderer.$presence": "write",   // can share cursor/presence
    "voxel.renderer.voxel-set": "read",    // can see edits, not make them
    "voxel.renderer.*": "void"             // catch-all: anything else is hidden entirely
  }
}
```

...covers every `VoxelSyncServer` instance registered on the server, whatever `id` (world) each one uses — one rule for the whole authority type, not one per room.

## Right semantics

| Right | Can write (send)? | Can read (receive broadcasts)? |
|---|---|---|
| `"write"` | yes | yes |
| `"read"` | no | yes |
| `"void"` | no | no — filtered out of that event's broadcast entirely |

For the reserved `"$join"` event specifically, `"read"` collapses to the same behavior as `"void"` (denied) — joining a room is binary, there's no partial-admission state.

## See Also

- [`RoomAuthority`](./RoomAuthority.md#rbac-minimal) — declares `name`/`events`, the vocabulary this table's keys are built from
- [`Server`](./Server.md#serveroptions) — where the table is actually configured
- [`ServerRoom`](./ServerRoom.md)
