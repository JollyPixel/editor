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

class ConflictTracker<Header extends NetworkCommandHeader> {
  constructor(resolver: ConflictResolver<Header>);
  resolve(key: string | null, incoming: Header): "accept" | "reject";
  record(key: string | null, incoming: Header): void;
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

- `resolve(key, incoming)` — resolves against the last recorded command at `key` without mutating tracker state.
- `record(key, incoming)` — stores `incoming` as the last accepted command. Call it only once the command has actually been applied.

`key: null` skips history entirely: `resolve` treats `existing` as `undefined`, `record` is a no-op.
