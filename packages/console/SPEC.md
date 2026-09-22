# `@jolly-pixel/console` specification

A command palette and developer console for JollyPixel's editors. It borrows three things: GitHub's
fuzzy palette, Discord's slash commands (`/command arg1 arg2`), and the Half-Life console's
variables (`sv_cheats 1`).

The console starts empty. Features register **namespaces**, and a namespace holds **commands** and
**variables**. The console object is itself the root namespace.

Status: design agreed on 2026-09-22, nothing built. The build order is in [PLAN.md](./PLAN.md).

## 1. Package shape

One workspace, `packages/console`, with two entries.

| Entry | Contents | Dependencies |
|---|---|---|
| `@jolly-pixel/console` | `CommandConsole`, the registry, the line parser, the input classifier, the search scorer, input history, scrollback | none |
| `@jolly-pixel/console/element` | `jolly-console`, a Lit element rendering a `CommandConsole` | peers: `lit`, `@jolly-pixel/ui` |

The root entry has no DOM and no Lit, so every rule in sections 3 to 8 is tested under `node --test`
without a browser. `ui` draws the same line for `./stats` (ADR-0015), and ADR-0024 is the reason: no
spec imports a component. A package that only registers commands depends on the root entry alone.

### No singleton

`CommandConsole` is a class and the package exports no instance. `editor.host` constructs exactly
one per editor page and hands it down by injection. That is what "one console per workspace" means
here.

`ui`'s `LogQueue` made the same choice for the same reasons (ADR-0031): two editors on one page, or
four parallel Playwright workers, must never share a registry. A module-level instance would also
leak registrations from one spec into the next, and the overwrite policy of section 3 would hide the
leak.

By convention the instance is named `commands`, never `console`. A binding named `console` shadows
the global and takes `console.log` away from the file that imports it.

## 2. Activation and lifecycle

- **Ctrl+K** (Cmd+K on macOS) toggles the console. `jolly-console` installs one `window` capture
  `keydown` listener while it is connected. It matches `event.key === "k"` with `ctrlKey` or
  `metaKey`, the rule ADR-0026 gives for command bindings, and calls `preventDefault()` because
  Firefox binds Ctrl+K to its search bar. The shortcut works while a text field has focus.
- Opening first dismisses every open dialog and popover, in the same keystroke (section 2.1).
- The console closes on Escape, on a click on the backdrop, and after a command that declares
  `closeOnExecute` resolves.
- While open, focus is trapped. On close, focus returns to the element that held it before. The
  element records it with `deepActiveElement()` from `ui`, which sees through shadow roots.
- `commands.open()` and `commands.close()` do what the shortcut does, so a command can open the
  console and a toolbar button can be added later without a new code path.

### 2.1 Dismissing open layers

The console is a native `<dialog>` opened with `showModal()`. It has to be: a modal `jolly-dialog`
makes the rest of the page inert, so anything outside the top layer could not take focus.

Open dialogs are not discoverable today. Each `jolly-dialog` hides a `<dialog>` in its shadow root,
and `inputLayers` tracks anonymous symbols. The console needs one small addition to `ui`:

```ts
interface InputLayerOptions {
  dismiss?: () => boolean;
}

class InputLayers {
  push(options?: InputLayerOptions): () => void;
  dismissAll(): boolean;
}
```

`jolly-dialog` passes a `dismiss` that takes its existing cancel path. It settles a pending inline
confirmation as `false`, emits `jolly-cancel`, closes, and returns `true`. When `dismissible` is
`false` it does nothing and returns `false`. `PopoverController` passes a `dismiss` that hides the
popover. `dismissAll()` returns `true` only when every layer closed.

**If `dismissAll()` returns `false`, the console does not open.** A non-dismissible dialog, such as
voxel-map's username prompt, wins over Ctrl+K. A dialog's owner sees an ordinary `jolly-cancel`, the
same event Escape produces.

This is a public `ui` API change and needs an ADR amending 0034.

The console pushes its own input layer while open, so the viewport keyboard ignores keys typed into
it through the guard `EditorRuntime` already installs.

## 3. Registry

### Namespace

Flat, with no nesting. A namespace is a scoping key such as `brush` or `keybind`, with an optional
description. The root namespace holds unscoped commands and variables.

### Command

Invoked as `/name arg1 arg2` in the root namespace and `/namespace.name arg1 arg2` in any other.
`registerCommand` on a namespace object adds the prefix. Registrants never write the dot.

### Variable

Read with `name`, written with `name value`, with no `=`. Scoped variables are `namespace.name`. The
registrant owns the contract: the type, the getter, the setter, and any validation or side effect of
a write. The console parses the line, coerces the literal to the declared type, calls `set`, then
prints what `get` returns. Printing the read-back value matters when the setter adjusts its input.
`BrushStore.size` clamps, so `brush.size 999` prints the clamped size.

### Names

An identifier matches `[A-Za-z_][A-Za-z0-9_-]*`. Registering any other name throws. The dot is the
address separator, so "registrants never write the dot" holds only because the registry refuses it.

Resolution is case-insensitive and display keeps the declared case. `git.autofetch true` resolves,
and Tab rewrites the token to `git.autoFetch`. Two names differing only in case collide.

A root variable `git`, a root command `/git` and a namespace `git` can coexist. `git` reads the
variable, `/git` runs the command, and `git.x` addresses the namespace.

### Overwrites and handles

Registering a name already in use replaces the earlier registration with no error and no warning.
Re-registering a namespace replaces it whole. Every command and variable under the old one is
dropped.

Every registration returns a handle, and a handle is checked by identity. `unregister()` removes the
entry only if it is still the one that handle created. After an overwrite the old handle is inert.
Without that check the usual teardown order breaks: a hot-reloaded feature registers
`/brush.grow` again, then the old copy disconnects, calls `unregister()`, and deletes the live
command.

`unregister()` on a namespace removes everything under it. In-flight commands of a removed
registration have their `signal` aborted (section 6).

## 4. Registration API

```ts
type ConsoleValueType = "string" | "number" | "boolean" | "enum";

interface ArgDef {
  name: string;
  type: ConsoleValueType;
  required?: boolean;
  enumValues?: readonly string[];
  rest?: boolean;
  autocomplete?: () => readonly string[] | Promise<readonly string[]>;
}

interface CommandDef<TArgs extends readonly ArgDef[]> {
  description: string;
  args: TArgs;
  execute: (args: ArgValues<TArgs>, ctx: CommandContext) => void | Promise<void>;
  closeOnExecute?: boolean;
}

interface CommandContext {
  print(text: string): void;
  error(text: string): void;
  signal: AbortSignal;
}

interface ConsoleNamespace {
  registerCommand<const TArgs extends readonly ArgDef[]>(
    name: string,
    def: CommandDef<TArgs>
  ): RegistrationHandle;
  registerVariable<const TDef extends VariableDef>(
    name: string,
    def: TDef
  ): RegistrationHandle;
  unregister(): void;
}

interface RegistrationHandle {
  unregister(): void;
}

class CommandConsole implements ConsoleNamespace {
  registerNamespace(
    name: string,
    meta?: { description?: string }
  ): ConsoleNamespace;
  open(): void;
  close(): void;
}
```

`VariableDef` is a union discriminated on `type`, so the value type follows from the declaration and
cannot disagree with it:

```ts
type VariableDef =
  | { type: "string"; description: string; get: () => string; set: (value: string) => void | false }
  | { type: "number"; description: string; get: () => number; set: (value: number) => void | false }
  | { type: "boolean"; description: string; get: () => boolean; set: (value: boolean) => void | false }
  | {
    type: "enum";
    description: string;
    enumValues: readonly string[];
    get: () => string;
    set: (value: string) => void | false;
  };
```

With a `const` type parameter the enum case narrows to the union of its `enumValues`. A setter
rejects a write by returning `false` or by throwing, and a thrown error's `message` becomes the log
entry.

### Typed arguments

`ArgValues<TArgs>` maps the argument tuple to the object `execute` receives. A required `string`
argument named `branch` becomes `{ branch: string }`, an optional one `{ branch?: string }`, and an
`enum` with `enumValues: ["a", "b"]` becomes `"a" | "b"`. Handlers contain no casts. The console
validates and coerces before it calls `execute`, so a handler gets exactly what its type says or is
not called. The mapping is covered by `tstyche` tests.

### Argument rules

Arguments are positional, in declaration order. v1 has no `--flag` and no `key=value` syntax.

Registration throws when:

- an optional argument comes before a required one, because `/cmd a b` would be ambiguous;
- an `enum` argument has no `enumValues`;
- `rest` is set on an argument that is not last or not a `string`;
- two arguments share a name.

A `rest` argument takes the remainder of the line unquoted, so `/say hello world` needs no quotes.

### Example

`/brush.grow` is here to show a command with an argument. The v1 `brush` namespace registers
variables only (section 10).

```ts
const brush = commands.registerNamespace("brush", {
  description: "Voxel brush"
});

brush.registerVariable("size", {
  type: "number",
  description: "Brush size in voxels",
  get: () => brushStore.size,
  set: (value) => {
    brushStore.size = value;
  }
});
// read:  brush.size
// write: brush.size 3

const grow = brush.registerCommand("grow", {
  description: "Grow or shrink the brush",
  args: [{ name: "delta", type: "number", required: true }],
  execute: ({ delta }, ctx) => {
    brushStore.resize(delta);
    ctx.print(`brush size ${brushStore.size}`);
  }
});
// invoked as: /brush.grow 2

grow.unregister();
brush.unregister();
```

## 5. Input grammar

```
command     := "/" (namespace ".")? identifier (" " literal)*
var-access  := (namespace ".")? identifier (" " literal)?
forced      := "?" text
literal     := bare-token | quoted
quoted      := '"' (any character, with \" and \\ as escapes) '"'
```

A literal containing a space needs quotes, as in `keybind.redo "mod+y, mod+shift+z"`, unless it
fills a `rest` argument.

Coercion by declared type:

| Type | Accepts |
|---|---|
| `string` | any literal |
| `number` | a literal that parses to a finite number |
| `boolean` | `true`, `false`, `yes`, `no`, `y`, `n`, `on`, `off`, `1`, `0`, case-insensitive |
| `enum` | one of `enumValues`, matched case-insensitively and passed in its declared case |

### Modes

A pure function `classify(input, registry)` runs on every keystroke and returns one of three modes.
The mode decides what the suggestion list holds and what Enter does.

| Mode | Input | Suggestion list | Enter |
|---|---|---|---|
| command | starts with `/` | completions for the current token, nothing highlighted | runs the raw line |
| variable | the first token resolves exactly to a variable | value completions for `enum` and `boolean`, otherwise the current value as a hint | runs the raw line as a read or a write |
| search | anything else, or a leading `?` | fuzzy results, first one highlighted | acts on the highlighted result |

An exact variable match always beats search. Typing `brush.si` is search mode. Enter on the top hit
inserts `brush.size`, the input becomes variable mode, and a second Enter reads the value.

The cost is that a root variable named `fps` makes the word unsearchable. A leading `?` forces search
(`?fps`), and registrants should keep root variables to a small deliberate set and namespace the
rest.

In command mode an unknown command prints an `unknown command` error and never falls back to search.

## 6. Output and history

The console keeps a scrollback of entries:

```ts
interface ScrollbackEntry {
  id: number;
  kind: "echo" | "info" | "error";
  text: string;
  pending: boolean;
}
```

Each submitted line is appended first as an `echo` entry (`> brush.size 3`). Variable reads and
writes print the value. Commands print through `ctx.print` and `ctx.error`. Parse errors, unknown
commands, failed coercions and rejected writes print `error` entries. Nothing is ever a toast.

`text` is a plain string, a different choice from `jolly-log`, whose entries are Lit templates
(ADR-0031). The core cannot import Lit, and string entries keep the scrollback serialisable. The
element renders `text` as a text node with `white-space: pre-wrap`, so there is no markup sink and a
peer's username in an entry is inert. Links and tables in output are out of v1.

### Async commands

- The input stays usable while a command's promise is pending. The `echo` entry shows a pending
  marker until it settles. There is no queue and no re-entrancy lock, and a command that needs one
  guards itself.
- A throw or a rejection becomes an `error` entry carrying `error.message`. Nothing escapes as an
  unhandled rejection.
- `closeOnExecute` closes the console after the promise resolves. On failure the console stays open
  so the error is read.
- `ctx.signal` aborts when the command or its namespace is unregistered while it runs.

### History

Up and Down recall previous raw inputs, including the ones that failed. When the suggestion list has
focus they move the highlight instead.

Scrollback and input history live on the `CommandConsole` instance, capped at 500 entries and 100
inputs. Because `editor.host` owns the instance, both survive closing and reopening the console and
both are gone after a reload. The console writes nothing to storage, in v1 or later. A variable
that should outlive a reload is persisted by its own setter.

## 7. Search and autocomplete

The search corpus is command names and descriptions, namespace names and descriptions, and variable
names and descriptions. There is no separate documentation entity. `/help` covers that job
(section 8).

The scorer is written in the package and no matcher is added as a dependency. Results are ranked by
tier, then by score inside a tier:

1. exact match
2. prefix
3. word-boundary and camelCase humps, so `bs` finds `brush.size`
4. contiguous substring
5. scattered subsequence

A match in a name ranks above one in a description. The scorer returns the matched ranges so the
element can bold them. Ranking by recency of use is left to v2.

The registry holds tens to low hundreds of entries, so search is a synchronous full scan per
keystroke, with no index, debounce or worker.

Selecting a search result:

| Result | Effect |
|---|---|
| command with no required argument | runs it |
| command with a required argument | inserts `/namespace.command ` for the user to complete |
| variable | inserts its address, which puts the input in variable mode |
| namespace | inserts `namespace.` |

Autocomplete in command and variable modes:

- after `/`, command names in root and `namespace.` forms;
- after `namespace.`, that namespace's commands and variables only;
- after `/command `, values from `ArgDef.autocomplete` or `enumValues` for the argument under the
  cursor.

Tab completes the current token and never executes. An `autocomplete` that returns a promise is
resolved latest-wins: each request takes an incrementing token, a result carrying an older token is
discarded, and the previous list stays on screen while the new one loads.

## 8. Built-in commands

The constructor registers two root commands through the public API. They hold no privilege over
registered ones, the rule ADR-0016 sets for `ui`'s built-in metrics and icons, so a host can
overwrite either.

- `/clear` empties the scrollback.
- `/help [name]` prints the namespaces and root commands, or one namespace's contents, or one
  command's signature and description. The signature is generated from `ArgDef[]`, so it cannot
  drift from the handler.

## 9. Element

`jolly-console` takes the instance as a property, `.console=${commands}`, and keeps no state of its
own beyond the input text and the highlight. It is a controlled element in the sense of ADR-0002.

One centred card, about 640px wide, anchored in the top third of the viewport:

```
┌──────────────────────────────────────┐
│ > keybind.undo "mod+u"               │  scrollback: hidden while empty,
│ > keybind.copy "mod+z"               │  about 8 rows, newest at the bottom
│ ✖ "mod+z" is already bound to undo   │
├──────────────────────────────────────┤
│ ⌕ brush.si▌                          │  input: never moves
├──────────────────────────────────────┤
│ ▸ brush.size        variable  number │  suggestions: hidden while empty
│   /brush.grow       Grow or shrink…  │
└──────────────────────────────────────┘
```

The input keeps its vertical position. Scrollback grows upward from it and suggestions grow
downward, so nothing moves under the caret while typing. The backdrop dims without blurring, so the
effect of `brush.size 5` on the toolbar behind it stays visible. There is one presentation. A
dockable console pane is not part of v1.

It uses `themeStyles` and the public tokens from `ui`, and `jolly-icon` for the glyphs.

### Accessibility

- The input is `role="combobox"` with `aria-expanded`, `aria-controls` and `aria-activedescendant`
  pointing into the suggestion list, which is `role="listbox"` with `role="option"` rows.
- The scrollback is `role="log"` with `aria-relevant="additions"`.
- The native `<dialog>` is labelled, which announces the console when it opens.
- Every action is reachable from the keyboard.

## 10. v1 consumers

### `editor.host`

Constructs the `CommandConsole`, mounts `jolly-console`, exposes the instance to editors through the
runtime, and registers a `theme` variable in the root namespace. Every editor gets the console UI
from the host.

### `editor.voxel-map`: `brush`

Seven variables over `BrushStore`, each reading and writing the store directly:

| Variable | Type |
|---|---|
| `brush.size` | number |
| `brush.mode` | enum |
| `brush.axis` | enum |
| `brush.pattern` | enum |
| `brush.rotationMode` | enum |
| `brush.flipY` | boolean |
| `brush.ghost` | boolean |

The toolbar already renders from the store's events, so a console write updates it with no extra
wiring. None of this touches the document, the network or undo history. Commands that change the
world, such as filling a region or deleting a layer, go through `MapDocument`, RBAC and history, and
are left out of v1.

### `editor.pixel-art`: `keybind`

One `string` variable per `KeybindingAction` of `@jolly-pixel/pixel-draw.renderer` (nine today),
generated by a loop over the actions:

```
keybind.undo                       prints  mod+z
keybind.undo "mod+u"               patch({ undo: "mod+u" })
keybind.redo "mod+y, mod+shift+z"  a comma-separated list maps to Keybinding[]
keybind.copy "mod+z"               error: the KeybindingConflictError message
```

`Keybindings.patch()` already throws `KeybindingConflictError` and `InvalidKeybindingError`, and
those messages become the error entries.

The comma-separated list is a convention of this registrant. The console gets no list type until a
second consumer asks for one.

Persistence belongs to the editor. After a successful `patch()` the setter stores the difference
from `DEFAULT_KEYBINDINGS` in local storage through `ui`'s `NamespacedStore`. At boot the editor
reads it back and passes it as the existing `keybindings` option of `PixelArtCanvas`. A stored
binding that no longer validates is dropped with a warning and the editor still boots.
`/keybind.reset [action]` restores one action, or all of them, and clears the stored entry.
Keybinds are per browser. They are not part of the asset and are not sent to peers.

## 11. Out of v1

- Named arguments and flags.
- A confirmation step for destructive commands. No v1 command needs one. A `confirm` flag on
  `CommandDef` is the likely form.
- Rich output (links, tables, Lit templates).
- Ranking by recency.
- A visible entry point such as a toolbar search icon. `commands.open()` exists so it can be added
  without touching the console.
- A dockable console pane.
- A list value type.
- World-mutating voxel-map commands.
