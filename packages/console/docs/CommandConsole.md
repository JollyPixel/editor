# CommandConsole

The registry, the line runner and the output of one console. The root entry exports it with no DOM
and no Lit, so everything on this page runs under `node --test`.

```ts
import { CommandConsole } from "@jolly-pixel/console";

const commands = new CommandConsole();
```

The package exports no instance. Construct one per editor page and pass it down; `editor.host`
does this and hands it to editors as `context.commands`. Name the binding `commands`: a binding
named `console` shadows the global and takes `console.log` away from the file.

The console object is the root namespace. Features add their own namespaces, see
[Registering from features](./features.md).

## Namespaces

```ts
registerNamespace(
  name: string,
  meta?: { description?: string; }
): ConsoleNamespace;

interface ConsoleNamespace {
  registerCommand(name, def): RegistrationHandle;
  registerVariable(name, def): RegistrationHandle;
  unregister(): void;
}
```

Namespaces are flat. A command `grow` in the `brush` namespace is invoked as `/brush.grow`, and a
variable `size` is addressed as `brush.size`. Registrants never write the dot; the namespace adds
it.

Registering a namespace name already in use replaces it whole, and every command and variable
under the old one is dropped. `unregister()` removes the namespace and everything in it.

## Commands

```ts
const grow = brush.registerCommand("grow", {
  description: "Grow or shrink the brush",
  args: [{ name: "delta", type: "number", required: true }],
  execute: ({ delta }, ctx) => {
    brushStore.resize(delta);
    ctx.print(`brush size ${brushStore.size}`);
  }
});
```

```ts
interface CommandDef<TArgs extends readonly ArgDef[]> {
  description: string;
  args: TArgs;
  execute(args: ArgValues<TArgs>, ctx: CommandContext): void | Promise<void>;
  closeOnExecute?: boolean;
}

interface CommandContext {
  print(text: string): void;
  error(text: string): void;
  signal: AbortSignal;
}
```

`ArgValues<TArgs>` maps the argument list to the object `execute` receives. A required `string`
argument named `branch` becomes `{ branch: string }`, an optional one `{ branch?: string }`, and an
`enum` argument with `enumValues: ["a", "b"]` becomes `"a" | "b"`. The console coerces and
validates before calling `execute`, so a handler gets exactly what its type says or is not called.

### Arguments

`ArgDef` is a union discriminated on `type`:

| `type` | Extra fields | Value |
|---|---|---|
| `"string"` | `rest?: boolean` | `string` |
| `"number"` | | a finite `number` |
| `"boolean"` | | `boolean` |
| `"enum"` | `enumValues: readonly string[]` (required) | one of `enumValues` |

Every argument takes `name`, `required?` and `autocomplete?: () => readonly string[] |
Promise<readonly string[]>`. Arguments are positional, in declaration order. A `rest` argument
takes the remainder of the line unquoted, so `/say hello world` needs no quotes.

Registration throws when the argument list is ambiguous or malformed:

| Error | When |
|---|---|
| `ArgumentOrderError` | an optional argument comes before a required one |
| `MissingEnumValuesError` | an `enum` argument has no `enumValues` |
| `InvalidRestArgumentError` | `rest` is set on an argument that is not last or not a `string` |
| `DuplicateArgumentError` | two arguments share a name |
| `InvalidIdentifierError` | a namespace, command, variable or argument name does not match `[A-Za-z_][A-Za-z0-9_-]*` |

The union already makes the second and third cases type errors; the runtime checks cover callers
that bypass the types.

### Running

- A throw or a rejection becomes an `error` entry carrying `error.message`. Nothing escapes as an
  unhandled rejection.
- While the promise is pending, the command's echo entry has `pending: true`. There is no queue and
  no lock: a second command can run meanwhile, and a command that must not overlap guards itself.
- `ctx.signal` aborts when the command, or its namespace, is unregistered or replaced while the run
  is pending.
- With `closeOnExecute`, the console closes once `execute` resolves. After a failure it stays open
  so the error can be read.

## Variables

```ts
brush.registerVariable("mode", {
  type: "enum",
  description: "Build places blocks, replace repaints occupied cells",
  enumValues: ["build", "replace"],
  get: () => brushStore.mode,
  set: (mode) => {
    brushStore.mode = mode;
  }
});
```

`brush.mode` reads the value, `brush.mode replace` writes it. `VariableDef` is a union on `type`
(`"string"`, `"number"`, `"boolean"`, `"enum"`), and the `get` and `set` types follow from it. For
an `enum`, `registerVariable` infers the value union from `enumValues`, so `set` above receives
`"build" | "replace"`.

The registrant owns the contract. The console parses the literal, coerces it to the declared type,
calls `set`, then prints what `get` returns. Printing the read-back value shows what the setter did
with the input: a store that clamps `brush.size 999` to 16 prints `16`.

`set` rejects a write by returning `false` (printed as `brush.mode rejected "x"`) or by throwing,
in which case the error's `message` is printed. It may also return a promise of either result:
the echo entry stays pending until it settles, then the value is read back as above. `get` is
always synchronous. A variable that should outlive a reload persists
itself in its setter; the console writes nothing to storage.

## Names and overwrites

Resolution is case-insensitive and display keeps the declared case: `git.autofetch true` resolves
`git.autoFetch`, and Tab rewrites the token. Two names that differ only in case collide.

A root variable `git`, a root command `/git` and a namespace `git` can coexist. `git` reads the
variable, `/git` runs the command, and `git.x` addresses the namespace.

Registering a name already in use replaces the earlier registration, with no error and no warning.
Every registration returns a handle:

```ts
interface RegistrationHandle {
  unregister(): void;
}
```

`unregister()` removes the entry only if it is still the one that handle created. After an
overwrite the old handle does nothing, so a hot-reloaded feature that registers `/brush.grow` again
survives the old copy's teardown.

`commands.unregister()` on the console itself removes every registration, the built-ins included.

## Built-in commands

The constructor registers two root commands through the public API. A host can overwrite either.

| Command | Effect |
|---|---|
| `/clear` | empties the scrollback |
| `/help [name]` | lists the namespaces and root entries, or describes one namespace, command or variable; signatures are generated from `ArgDef[]` |

## Submitting a line

```ts
submit(line: string): Promise<void>;
```

Runs one line as the prompt would on Enter. A blank line does nothing. The line is pushed to the
history and appended as an `echo` entry first. The promise resolves once the line has run and
never rejects; failures are `error` entries. The input grammar is described in
[Input grammar](./grammar.md).

## Output and history

```ts
readonly scrollback: readonly ScrollbackEntry[];
readonly history: InputHistory;
clearScrollback(): void;

interface ScrollbackEntry {
  readonly id: number;
  readonly kind: "echo" | "info" | "error";
  readonly text: string;
  readonly pending: boolean;
}
```

`text` is a plain string. The element renders it as a text node, so a peer's username in an entry
is inert. The scrollback keeps the last 500 entries and the history the last 100 inputs, failed
ones included. Both live on the instance: they survive closing and reopening the console and are
gone after a reload.

`history.previous(current)` and `history.next()` walk the inputs and return `null` at either end.
`previous` remembers `current` as the draft that `next` returns after the newest entry.

## Opening and events

```ts
open(): void;
close(): void;
readonly registry: ConsoleRegistry;
```

`open()` and `close()` ask a mounted [`jolly-console`](./element.md) to open or close, the same as
Ctrl+K and Escape. `registry` is the read side of the registry: `namespace(name)`,
`namespaces()`, `resolveCommand(address)` and `resolveVariable(address)`, and the root namespace
as `registry.root`.

`CommandConsole` is an `Emitter` from `@openally/emitt`:

| Event | When |
|---|---|
| `registry-changed` | a registration is added, replaced or removed |
| `scrollback-changed` | an entry is appended or settles, or the scrollback is cleared |
| `open-requested` | `open()` was called |
| `close-requested` | `close()` was called, or a `closeOnExecute` command resolved |
| `opened` | a mounted `jolly-console` showed its dialog |

```ts
const stop = commands.subscribe("scrollback-changed", render);
```
