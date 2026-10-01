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
[ui ADR-0020](../../ui/docs/adr/0020-input-scope-follows-focus.md).

While open, the console pushes its own input layer, so an `EditorRuntime` keyboard ignores the
keys typed into it. On close, focus returns to the element that held it before, found through
shadow roots.

## Keys

| Key | Effect |
|---|---|
| Enter | runs the line, or acts on the highlighted suggestion |
| Tab | accepts the highlighted suggestion, or the first one, without running it |
| Right | accepts the gray suffix when the caret is at the end of the line, otherwise moves the caret |
| Up, Down | move the highlight when a suggestion is highlighted, otherwise walk the history |
| Escape | closes the console |

## Inline completion

While the caret is at the end of the line, the prompt shows in gray the rest of the line that Tab
would produce: `brush.si` shows `ze`, `/brush.gr` shows `ow`. It follows the highlighted suggestion,
or the first one. A typo correction does not extend the typed text, so it shows no gray suffix;
Tab still applies it. The suffix hides when the typed text overflows the prompt.

## Empty prompt

An empty prompt, or a bare `?`, lists the registry in sections with nothing highlighted. A section
with no entries is left out.

| Section | Lists | Enter or click |
|---|---|---|
| Recent | the last three distinct submitted lines, newest first | runs the line again |
| Toggles | every `boolean` variable, checked when true | writes the opposite value |
| Namespaces | every namespace | inserts `brush.`, which lists its members |
| Commands | root commands | runs it, or inserts it when an argument is required |
| Variables | root variables other than `boolean` ones | inserts the address |

Down enters the list; Up with nothing highlighted still walks the history. The list shows no gray
suffix. `/help` keeps printing to the scrollback.

## Usage line and key hints

When the highlighted suggestion names a command, a variable or a namespace, a line under the list
shows its usage: a command signature (`/brush.grow <delta:number>`), a variable type and current
value (`brush.size <number> = 4`), or the member counts of a namespace. The prompt references it
with `aria-describedby`.

The footer lists the keys that act in the current state: `↑↓ navigate` (or `history`), `↵ run` or
`↵ insert`, `Tab complete` and `Esc close`.

## Scrollback

An entry longer than seven lines shows its first six and a `Show N more lines` button, which
expands it in place and does not take focus from the prompt. The scrollback scrolls to a new entry
and on opening; typing leaves its position alone.

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
  pointing into the suggestion `listbox`, and `aria-autocomplete="both"`. The gray suffix is
  `aria-hidden`; the highlighted option carries the same text.
- Sections of the empty-prompt list are `group`s labelled by their title. A toggle option carries
  `aria-checked`, and a fold button `aria-expanded`.
- The scrollback is a `log` with `aria-relevant="additions"`, labelled "Console output".
- The dialog is labelled "Console", which announces it when it opens.
