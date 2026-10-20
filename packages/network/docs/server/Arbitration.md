# Arbitration

`KeyedCommandArbiter` is the server arbiter for documents whose commands write
conflict keys. It applies the same last-write-wins rule as the client; see
[Conflict resolution](../client/CommandSync.md#conflict-resolution).

```ts
type ConflictWrites =
  | { readonly scope?: string; readonly keys: readonly string[]; }
  | { readonly scope?: string; readonly reset: true; };

interface KeyedCommandArbiterOptions<TCommand, TState> {
  accepts(state: TState, command: TCommand): boolean;
  writes(command: TCommand, state?: TState): ConflictWrites;
  narrow?(command: TCommand, keep: readonly number[]): TCommand | null;
}

interface Admission<TCommand> {
  readonly command: TCommand;
  commit(version?: number): void;
}
```

## `admit(state, command): Admission<TCommand> | null`

Returns `null` when `accepts` is false. A command that wins every key of
`writes` is admitted whole. When it wins only some, `narrow(command, keep)`
receives the winning indices and the narrowed command is admitted; without
`narrow`, or when it returns `null` or no key wins, the command is refused.

A `reset` write is always admitted. Its commit forgets the keys of its `scope`
and becomes the record every later key of that scope is compared to. Scopes
never see each other's keys; the default scope is `""`.

Call `commit(version)` once the command is stored. Nothing is recorded before.

## `restore(command, version): void`

Records a past command when a room starts. It calls `writes(command)` without a
state, so keys that depend on the state at the time the command landed cannot be
restored.
