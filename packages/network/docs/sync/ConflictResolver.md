# ConflictResolver

Server-side helper types for resolving concurrent edits to the same key.

```ts
interface NetworkCommandHeader {
  clientId: string;
  seq: number;
  timestamp: number;
}

export interface ConflictContext<
  Header extends NetworkCommandHeader = NetworkCommandHeader
> {
  incoming: Header;
  existing: Header | undefined;
}

export interface ConflictResolver<
  Header extends NetworkCommandHeader = NetworkCommandHeader
> {
  resolve(
    ctx: ConflictContext<Header>
  ): "accept" | "reject";
}

class LastWriteWinsResolver<
  Header extends NetworkCommandHeader = NetworkCommandHeader
>
  implements ConflictResolver<Header> {
  resolve(ctx: ConflictContext<Header>): "accept" | "reject";
}
```

## `LastWriteWinsResolver`

Resolves conflicts using only the header (`clientId` / `timestamp`), never the payload.

| Condition | Result |
|---|---|
| No `existing` at key | `"accept"` |
| Same `clientId` | `"accept"` (own commands always win; handles undo/redo replay with old timestamps) |
| Different `clientId` | newer `timestamp` wins; tie → lexicographically greater `clientId` |

Generic over `Header` for stronger typing (e.g. `LastWriteWinsResolver<PixelNetworkCommand>`); only the three header fields are ever read.
