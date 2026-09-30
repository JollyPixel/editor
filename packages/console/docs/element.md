# jolly-console

The Lit element that renders a [`CommandConsole`](./CommandConsole.md). It lives in its own entry
so a package that only registers commands never loads Lit.

```ts
import { CommandConsole } from "@jolly-pixel/console";
import "@jolly-pixel/console/element";

const commands = new CommandConsole();
const element = document.createElement("jolly-console");
element.console = commands;
document.body.append(element);
```

The entry needs the `lit` and `@jolly-pixel/ui` peers. `editor.host` mounts one per editor page,
so an editor built on `mountStandalone` does not mount its own.

The element is controlled: the scrollback, history and registry stay on the `CommandConsole`, and
the element keeps only the prompt text and the highlighted suggestion. Replacing `console` rebinds
it to another instance.

## Opening and closing

| Trigger | Effect |
|---|---|
| Ctrl+K, Cmd+K on macOS | toggles the console, including while a text field has focus |
| `commands.open()`, `element.show()` | opens it |
| Escape, a click on the backdrop | closes it |
| `commands.close()`, `element.hide()` | closes it |
| a `closeOnExecute` command resolving | closes it |

The element listens for the shortcut on `window` in the capture phase while it is connected, and
calls `preventDefault()` because Firefox binds Ctrl+K to its search bar. `element.open` reports
whether the dialog is showing.

The console is a native `<dialog>` opened with `showModal()`. Opening first calls
`inputLayers.dismissAll()` from `ui`, which closes every open `jolly-dialog` and popover. When a
layer refuses, such as a dialog with `dismissible` set to `false`, the console does not open. See
[ui ADR-0042](../../ui/docs/adr/0042-open-layers-can-be-dismissed.md).

While open, the console pushes its own input layer, so an `EditorRuntime` keyboard ignores the
keys typed into it. On close, focus returns to the element that held it before, found through
shadow roots.

## Keys

| Key | Effect |
|---|---|
| Enter | runs the line, or acts on the highlighted suggestion |
| Tab | completes the current token |
| Up, Down | move the highlight when a suggestion is highlighted, otherwise walk the history |
| Escape | closes the console |

## Layout and theme

One card, at most 640px wide (`--jolly-console-width`), anchored 30vh from the top of the viewport
(`--jolly-console-top`). The prompt keeps its position:
scrollback grows upward from it and suggestions grow downward. The backdrop dims without blurring,
so the effect of `brush.size 5` on the page behind stays visible.

The element adopts the page theme through `adoptAmbientTheme` from `ui` when it opens, and again
after each submitted line, so `theme light` restyles the open console too. A `theme` attribute set
on the element by hand wins over both.

## Accessibility

- The prompt is a `combobox` with `aria-expanded`, `aria-controls` and `aria-activedescendant`
  pointing into the suggestion `listbox`.
- The scrollback is a `log` with `aria-relevant="additions"`, labelled "Console output".
- The dialog is labelled "Console", which announces it when it opens.
