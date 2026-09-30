# Conflicts

Server-side resolution of concurrent edits to the same key. `ConflictTracker` keeps the per-key history; `ConflictResolver` decides.

```ts
type ConflictRecord = NetworkCommandHeader & {
  version?: number;
};

interface ConflictContext<Header extends NetworkCommandHeader> {
  incoming: Header;
  existing: ConflictRecord | undefined;
}

interface ConflictResolver<Header extends NetworkCommandHeader> {
  resolve(ctx: ConflictContext<Header>): "accept" | "reject";
}

class LastWriteWinsResolver<Header extends NetworkCommandHeader>
  implements ConflictResolver<Header> {}

interface Admission<TCommand> {
  readonly command: TCommand;
  commit(version?: number): void;
}

interface PartialAdmission {
  readonly indices: number[];
  commit(version?: number): void;
}

class ConflictTracker<THeader extends NetworkCommandHeader> {
  constructor(resolver: ConflictResolver<THeader>);
  admit<TCommand extends THeader>(command: TCommand, keys: readonly string[]): Admission<TCommand> | null;
  admitEach(command: THeader, keys: readonly string[]): PartialAdmission;
  record(command: NetworkCommandHeader, keys: readonly string[], version?: number): void;
  reset(command: NetworkCommandHeader, version?: number): void;
}
```

Both are generic over `Header` for stronger typing of `incoming` (`LastWriteWinsResolver<PixelNetworkCommand>`). The tracker records only `clientId`, `seq` and `timestamp` of a committed command, plus the `version` it was committed at, so `existing` never carries a payload.

`NetworkCommandHeader` has an optional `basis`: a command that replays an earlier one, such as an undo or a redo, sets it to the room version of the command it replays.

## LastWriteWinsResolver

The last write the server processes wins, unless it replays a write older than the one it would overwrite.

| Condition | Result |
|---|---|
| No `existing` at key | `"accept"` |
| Same `clientId` | `"accept"`: own commands always win, so an undo of the client's latest write lands |
| `existing.version` set, no `incoming.basis` | `"accept"`: the incoming write is newer in server order |
| `existing.version` set, `incoming.basis` set | `"accept"` when `basis >= existing.version`, so an undo loses to a peer's later edit |
| No `existing.version` | newer `timestamp` wins; tie broken by the lexicographically greater `clientId` |

`timestamp` only decides for records committed without a version. The asset rooms commit with the event version, so a client with a slow clock does not lose the writes it sends last.

## ConflictTracker

Neither `admit` nor `admitEach` mutates the tracker. `commit(version)` records the command at the admitted keys with the version it landed at; call it only once the command has actually been applied or persisted.

- `admit(command, keys)` admits the whole command, or returns `null` when any key rejects it. A command with no keys is always admitted.
- `admitEach(command, keys)` resolves every key on its own and returns the `indices` that accept, for commands that can be narrowed to their winning entries (a stroke, a bulk voxel edit). `commit()` records only those keys.
- `record(command, keys, version)` records keys without arbitration, to rebuild the tracker from past events when a room starts.
- `reset(command, version)` forgets every key and resolves any key against `command` until it is recorded again, for a command that replaces the whole state (a resize, a world replacement).

```ts
const { indices, commit } = tracker.admitEach(stroke, stroke.positions.map(pixelKey));
if (indices.length === 0) {
  return null;
}

return {
  command: { ...stroke, positions: indices.map((index) => stroke.positions[index]) },
  commit
};
```
