# CommandChange

What a history source emits for each applied command. See [origins](./guides/collaborative-undo.md#origins).

```ts
type CommandOrigin = "local" | "remote" | "replay";

class CommandChange<TCommand, TImage> {
  static local(command: TCommand, image: TImage, inverse?: readonly TCommand[], basis?: number): CommandChange<TCommand, TImage>;
  static remote(command: TCommand, image: TImage, clientId?: string | null): CommandChange<TCommand, TImage>;
  static replay(command: TCommand, image: TImage): CommandChange<TCommand, TImage>;

  readonly command: TCommand;
  readonly origin: CommandOrigin;
  readonly image: TImage;
  readonly inverse: readonly TCommand[];
  readonly clientId: string | null;
  readonly basis: number | undefined;
}
```

Build a change for a source that is not a [`CommandDocument`](./CommandDocument.md) with the constructor of its origin: each one sets the fields that origin carries and leaves the others empty.

```ts
const change = CommandChange.local(command, null, inverse, basis);
```

## Constructors

### local(command, image, inverse?, basis?)

This person's edit. `inverse` defaults to `[]`; pass `basis` for an undo or redo.

### remote(command, image, clientId?)

A peer's command. `clientId` defaults to `null`.

### replay(command, image)

This client's pending command re-applied after a peer's.

## Properties

### command

The applied command.

### origin

`local` for this person's edit, `remote` for a peer's command, `replay` for this client's pending command re-applied after a peer's.

### image

What the command replaced, read before it applied.

### inverse

The commands undoing it. Empty unless `origin` is `local`.

### clientId

The peer behind a `remote` change; `null` otherwise.

### basis

Set on an undo or redo: the room version of the step it replays. `undefined` otherwise.
