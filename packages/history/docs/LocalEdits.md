# LocalEdits

A document seen from a client that applies commands without an editor, such as
an agent. `CommandDocument` and `ChangeSourceAdapter` satisfy it.

```ts
interface LocalEdits<TCommand> {
  readonly receipts: Pick<ChangeReceipts<object>, "subscribe">;
  applyStep(command: TCommand): object | null;
}
```

`applyStep` applies the command as a local change and returns it, or `null`
when the command does not apply. [`receipts`](./ChangeReceipts.md) later
answers that same change object as `confirmed` or `refused`.
