# Conflicts

Server-side resolution of concurrent edits to the same key. `ConflictTracker` keeps the per-key history; `ConflictResolver` decides.

```ts
interface ConflictContext<Header extends NetworkCommandHeader> {
  incoming: Header;
  existing: Header | undefined;
}

interface ConflictResolver<Header extends NetworkCommandHeader> {
  resolve(ctx: ConflictContext<Header>): "accept" | "reject";
}

class LastWriteWinsResolver<Header extends NetworkCommandHeader>
  implements ConflictResolver<Header> {}

interface Admission<TCommand> {
  readonly command: TCommand;
  commit(): void;
}

interface PartialAdmission {
  readonly indices: number[];
  commit(): void;
}

class ConflictTracker<THeader extends NetworkCommandHeader> {
  constructor(resolver: ConflictResolver<THeader>);
  admit<TCommand extends THeader>(command: TCommand, keys: readonly string[]): Admission<TCommand> | null;
  admitEach(command: THeader, keys: readonly string[]): PartialAdmission;
}
```

Both are generic over `Header` for stronger typing (`LastWriteWinsResolver<PixelNetworkCommand>`), but only the three `NetworkCommandHeader` fields are ever read — never the payload.

## LastWriteWinsResolver

| Condition | Result |
|---|---|
| No `existing` at key | `"accept"` |
| Same `clientId` | `"accept"` — own commands always win, which handles undo/redo replay with old timestamps |
| Different `clientId` | newer `timestamp` wins; tie broken by the lexicographically greater `clientId` |

## ConflictTracker

Neither method mutates the tracker. `commit()` records the command at the admitted keys; call it only once the command has actually been applied or persisted.

- `admit(command, keys)` admits the whole command, or returns `null` when any key rejects it. A command with no keys is always admitted.
- `admitEach(command, keys)` resolves every key on its own and returns the `indices` that accept, for commands that can be narrowed to their winning entries (a stroke, a bulk voxel edit). `commit()` records only those keys.

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
