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

## Empty prompt

An empty prompt lists what is available:

| Section | Lists | Enter or click |
|---|---|---|
| Recent | the last three lines run | runs it again |
| Toggles | `boolean` variables | flips the value |
| Namespaces | every namespace | lists its members |
| Commands | root commands | runs it, or inserts it if it needs arguments |
| Variables | other root variables | inserts it |

## Styling

| Custom property | Default |
|---|---|
| `--jolly-console-width` | `min(640px, calc(100vw - 32px))` |
| `--jolly-console-top` | `30vh` |

The console follows the page theme. Set the `theme` attribute to force one.
