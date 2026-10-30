# jolly-console

The Lit element that displays a [`CommandConsole`](./CommandConsole.md). It needs the `lit` and
`@jolly-pixel/ui` peers.

```ts
import { CommandConsole } from "@jolly-pixel/console";
import "@jolly-pixel/console/element";

const commands = new CommandConsole();
const element = document.createElement("jolly-console");
element.console = commands;
document.body.append(element);
```

`editor.host` already mounts one per editor page; editors built on `mountStandalone` do not need
their own.

## Opening and closing

| Trigger | Effect |
|---|---|
| Ctrl+K (Cmd+K on macOS) | toggles the console, even from a text field |
| `commands.open()`, `element.show()` | opens it |
| Escape, click on the backdrop | closes it |
| `commands.close()`, `element.hide()` | closes it |
| `element.toggle()` | toggles it |

`element.open` tells whether it is open. Opening closes other open dialogs and popovers; a dialog
that cannot be dismissed keeps the console closed.

`isToggleShortcut(event)` from the main entry tells whether a key event is Ctrl+K / Cmd+K.

## Keys

| Key | Effect |
|---|---|
| Enter | runs the line, or acts on the highlighted suggestion |
| Tab | completes with the highlighted (or first) suggestion |
| Right | at the end of the line, accepts the gray completion |
| Up, Down | move through suggestions, or through history |
| Escape | closes the console |

## Search and completion

Search matches the names and descriptions of every namespace, command and variable. Exact and
prefix matches rank first, initials match (`bs` finds `brush.size`), and words of 4 to 7
characters tolerate one typo, longer ones two (`brush.sise` finds `brush.size`).

Enter on a command that needs no argument runs it. Any other result is inserted: a command so you
can type its arguments, a variable by name, a namespace as `namespace.`.

Tab completes the word under the caret and never runs anything: command names after `/`, a
namespace's members after `namespace.`, the commands of a namespace and of its nested ones after
`/namespace.`, and an argument's `autocomplete` or `enumValues`. In a scope, relative names come
first. Every item of a `boolean[]` is offered `true` and `false`.

An unknown command or variable prints an error with the closest name when one is within typo
range: `Did you mean /brush.grow?`. The suggestion never runs.

## Scripts

`/script [namespace]`, or `commands.editScript()`, replaces the prompt with a text editor over
the variables ([format](./grammar.md#scripts)). Values are colored by their variable's type and
errors are underlined as you type; the status line shows the first error or the number of
changes. `element.editScript(script)` opens the console on a
[`VariableScript`](./CommandConsole.md) the caller already holds.

| Key | Effect |
|---|---|
| Ctrl+S, Ctrl+Enter (Cmd on macOS) | saves; on an error, selects it instead |
| Escape | discards the text and returns to the prompt |

A failed save keeps the text and shows the error. A click on the backdrop does not close the
console while a script is open; Ctrl+K does, and discards the text.

## Empty prompt

An empty prompt lists what is available in the [scope](./grammar.md#scope), named relative to it:

| Section | Lists | Enter or click |
|---|---|---|
| Recent | the last three lines run | runs it again |
| Toggles | `boolean` variables in the scope and below | flips the value |
| Namespaces | the namespaces one level below the scope | lists its members |
| Commands | the scope's commands | runs it, or inserts it if it needs arguments |
| Variables | the scope's other variables | inserts it |

After `/cd`, the prompt shows the scope before the text, and the combobox is named
`Command in <scope>`.

## Styling

| Custom property | Default |
|---|---|
| `--jolly-console-width` | `min(640px, calc(100vw - 32px))` |
| `--jolly-console-top` | `30vh` |

The console follows the page theme. Set the `theme` attribute to force one.
