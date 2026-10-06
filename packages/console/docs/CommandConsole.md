# CommandConsole

Holds the commands, variables, scrollback and history of one console. It has no DOM and runs under
`node --test`.

```ts
import { CommandConsole } from "@jolly-pixel/console";

const commands = new CommandConsole();
```

Create one per editor page; `editor.host` passes it to editors as `context.commands`. Avoid naming
it `console`, which shadows the global.

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

A command `grow` in namespace `brush` runs as `/brush.grow`; a variable `size` is `brush.size`.
Registering an existing namespace name replaces it and everything in it.

The console object itself is the root namespace. To register from editor features, see
[Registering from features](./features.md).

## Commands

```ts
brush.registerCommand("grow", {
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
  execute(
    args: ArgValues<TArgs>,
    ctx: CommandContext
  ): CommandResult | Promise<CommandResult>;
  closeOnExecute?: boolean;
}

type CommandResult = void | Revert;
type Revert = () => void | Promise<void>;

interface CommandContext {
  print(text: string): void;
  error(text: string): void;
  signal: AbortSignal;
}
```

`execute` receives typed, already-validated arguments. It is not called when an argument is
invalid.

- A throw or rejection is printed as an error.
- `ctx.signal` aborts when the command is unregistered or replaced while it runs.
- `closeOnExecute` closes the console after a successful run.
- Returning a function makes the run revertible with `/revert`; see [Reverting](#reverting).

### Arguments

| `type` | Extra fields | Value |
|---|---|---|
| `"string"` | `rest?: boolean` | `string` |
| `"number"` | | finite `number` |
| `"boolean"` | | `boolean` |
| `"enum"` | `enumValues: readonly string[]` | one of `enumValues` |

Every argument has `name`, `required?` and `autocomplete?: () => readonly string[] |
Promise<readonly string[]>`. Arguments are positional. A `rest` argument takes the rest of the
line, so `/say hello world` needs no quotes.

Registration throws:

| Error | When |
|---|---|
| `ArgumentOrderError` | an optional argument comes before a required one |
| `MissingEnumValuesError` | an `enum` argument has no `enumValues` |
| `InvalidRestArgumentError` | `rest` is not on the last argument, or not on a `string` |
| `DuplicateArgumentError` | two arguments share a name |
| `InvalidIdentifierError` | a name does not match `[A-Za-z_][A-Za-z0-9_-]*` |

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

`brush.mode` prints the value, `brush.mode replace` sets it. Types are the same four as arguments.

After `set`, the console prints what `get` returns, so a store that clamps `brush.size 999` to 16
prints `16`.

- `set` rejects a value by returning `false` or throwing. It may return a promise.
- `get` is synchronous. If it throws, reading the variable prints the error.
- The console stores nothing; persist the value in `set` if it must survive a reload.

## Names

- Names are case-insensitive: `git.autofetch true` sets `git.autoFetch`.
- A root variable `git`, a root command `/git` and a namespace `git` can coexist.
- Registering a name already in use replaces the previous entry silently.

Every registration returns a handle:

```ts
interface RegistrationHandle {
  unregister(): void;
}
```

A handle does nothing once its entry has been replaced, so hot-reloaded code can register again
safely. `commands.unregister()` removes everything, built-ins included.

## Built-in commands

| Command | Effect |
|---|---|
| `/clear` | empties the scrollback |
| `/help [name]` | lists everything, or describes one namespace, command or variable |
| `/revert [count]` | undoes the last `count` changes, 1 by default; see [Reverting](#reverting) |
| `/script [namespace]` | edits every variable, or one namespace's, as a script; see [Scripts](#scripts) |

All four can be overwritten.

## Reverting

`/revert` undoes changes made from the console, newest first. Two kinds of lines count as a change:

- a variable write that changed the value: reverting sets the previous value back;
- a command whose `execute` returned a function: reverting calls it.
- a saved [script](#scripts): reverting sets back every variable it wrote, in one step.

```ts
keybind.registerCommand("reset", {
  description: "Restore the default shortcuts",
  args: [],
  execute: () => {
    const before = settings.snapshot();
    settings.reset();

    return () => settings.restore(before);
  }
});
```

Variable reads, writes that leave the value unchanged or are rejected, failed commands and
commands that return nothing are not recorded, so `/revert` steps over them. `/revert` itself is
not recorded and there is no redo.

| Situation | Result |
|---|---|
| fewer changes than `count` | reverts what there is and prints `Reverted 2 of 3` |
| nothing recorded | prints `Nothing to revert` |
| `count` is not a positive whole number | error, nothing reverted |
| the command or variable is no longer registered | the change is skipped with an error and dropped |
| some variables of a script are no longer registered | the others are set back; skipped only when none is left |
| a revert throws or rejects | its error is printed, it is dropped, and the remaining count is not reverted |

Reverts run one at a time; an async revert is awaited before the next. The console keeps the last
100 changes, lost on reload. A command replaced under the same address still reverts through the
function its earlier run returned.

## Scripts

A script is every variable, or one namespace's, written as INI text to edit and save together.
The format is described in [Input grammar](./grammar.md#scripts).

```ts
editScript(namespace?: string): VariableScript;
applyScript(draft: ScriptDraft): Promise<ScriptResult>;

class VariableScript {
  readonly scope: string | null;
  readonly text: string;
  readonly empty: boolean;
  parse(text: string): ScriptDraft;
}

class ScriptDraft {
  readonly lines: readonly ScriptLine[];
  readonly changes: readonly ScriptChange[];
  readonly diagnostics: readonly ScriptDiagnostic[];
  readonly ok: boolean;
  valueType(line: number): ConsoleValueType | undefined;
}

interface ScriptChange {
  readonly line: number;
  readonly address: string;
  readonly value: ConsoleValue;
}

interface ScriptDiagnostic {
  readonly line: number;
  readonly start: number;
  readonly end: number;
  readonly message: string;
}

type ScriptResult =
  | { ok: true; applied: number; }
  | { ok: false; error: string; };
```

`editScript()` reads every variable once, writes the text and emits `script-requested`; the
mounted [`jolly-console`](./element.md#scripts) opens its editor on it. It throws on an unknown
namespace or when there is no variable to edit. `/script [namespace]` calls it.

`parse()` never throws. `changes` holds only the keys whose value differs from the one read when
the script was written, so a value changed elsewhere meanwhile is not overwritten unless its line
was edited. A removed line leaves its variable as it is. Line numbers start at 1; `start` and
`end` are column offsets from 0.

`applyScript()` writes the changes in document order and awaits each `set`:

- a draft with diagnostics is refused before any write;
- a rejected or throwing `set` sets back the values already written, prints the error and
  resolves `{ ok: false }`, naming any variable it could not set back;
- on success each change is echoed as the equivalent prompt line (`brush.size 4`), and the whole
  save is one `/revert` step.

## Running a line

```ts
submit(line: string): Promise<void>;
```

Runs a line as if typed in the prompt. Never rejects; failures are printed as errors. See
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

The scrollback keeps the last 500 entries and the history the last 100 lines. Both are lost on
reload. `scrollback` returns the same frozen array until an entry is added, updated or cleared, so
a renderer can compare it by identity. `history.previous(current)` and `history.next()` walk the history and return `null` at
either end.

## Opening and events

```ts
open(): void;
close(): void;
readonly registry: ConsoleRegistry;
```

`open()` and `close()` drive the mounted [`jolly-console`](./element.md).

`registry` lists what is registered. It iterates the root namespace first, then every namespace;
each namespace iterates its commands, then its variables:

```ts
for (const scope of commands.registry) {
  for (const entry of scope) {
    console.log(entry.kind, entry.address, entry.description);
  }
}
```

It also has `namespace(name)`, `namespaces()`, `resolveCommand(address)`,
`resolveVariable(address)` and `root`.

`CommandConsole` is an `Emitter` from `@openally/emitt`:

| Event | When |
|---|---|
| `registry-changed` | a registration is added, replaced or removed |
| `scrollback-changed` | the scrollback changes |
| `open-requested` | `open()` was called |
| `close-requested` | `close()` was called, or a `closeOnExecute` command finished |
| `opened` | the element showed its dialog |
| `script-requested` | `editScript()` built a script, handed to the element as the argument |

```ts
const stop = commands.subscribe("scrollback-changed", render);
```
