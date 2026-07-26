# ConflictTracker

Per-key bookkeeping around a [`ConflictResolver`](./ConflictResolver.md). It remembers the last accepted command for each key so callers can keep conflict resolution and state mutation separate.

```ts
class ConflictTracker<
  Header extends NetworkCommandHeader = NetworkCommandHeader
> {
  constructor(
    resolver: ConflictResolver<Header>
  );
  resolve(
    key: string | null,
    incoming: Header
  ): "accept" | "reject";
  record(
    key: string | null,
    incoming: Header
  ): void;
}
```

## Methods

### `resolve`

```ts
resolve(key: string | null, incoming: Header): "accept" | "reject"
```

Resolves `incoming` against the last recorded command at `key`.

- Does not mutate tracker state.
- `key: null` skips history and resolves against `undefined`.

### `record`

```ts
record(key: string | null, incoming: Header): void
```

Stores `incoming` as the last accepted command for `key`.

- No-op for `key: null`.
- Call this only after the command has actually been applied.
