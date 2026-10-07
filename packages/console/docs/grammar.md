# Input grammar

The prompt accepts three kinds of input:

| Input | Mode | Enter |
|---|---|---|
| `/brush.grow 2` | command | runs the command |
| `brush.size` | variable | prints the value |
| `brush.size 3` | variable | sets the value |
| anything else, or `?text` | search | acts on the highlighted result |

Arguments are separated by spaces. Quote a value that contains spaces:
`brush.label "main brush"`. Inside quotes, `\"` and `\\` are escapes. There are no `--flag` or
`key=value` forms.

An address splits at its last dot: `pixelart.keybinds.undo` is the variable `undo` of the nested
namespace `pixelart.keybinds`.

## Scope

`/cd pixelart.keybinds` enters a namespace, and the prompt shows it before the text. Names are
then looked up in the scope first, then as full addresses:

| In scope `pixelart.keybinds` | Reads as |
|---|---|
| `undo mod+u` | `pixelart.keybinds.undo mod+u` |
| `/reset` | `/pixelart.keybinds.reset` |
| `/help`, `brush.size 3` | unchanged, nothing in the scope matches |

`/cd keybinds` from `pixelart` enters `pixelart.keybinds`; `/cd ..` goes up one level and `/cd`
alone returns to the root. With an empty prompt, browsing lists the scope's namespaces, commands,
variables and toggles; search still covers everything.

## Values

| Type | Accepts |
|---|---|
| `string` | anything |
| `number` | a finite number |
| `boolean` | `true`/`false`, `yes`/`no`, `y`/`n`, `on`/`off`, `1`/`0` (any case) |
| `enum` | one of `enumValues` (any case) |
| `string[]`, `number[]`, `boolean[]` | items of that type, separated by spaces |

A list item follows the quoting rules of an argument:
`pixelart.keybinds.redo Mod+y Mod+Shift+z` sets two items and `tags "two words" b` sets two
items. A lone `""` sets the empty list; an empty item next to others is an error. Tab offers
`true` and `false` at every item of a `boolean[]`.

An invalid value prints an error and nothing runs.

## Variables before search

When the input is exactly a variable name, it is treated as that variable, not as a search. A root
variable named `fps` therefore hides the word `fps` from search; type `?fps` to search instead.
Prefer namespaced variables over root ones.

## Search

Search looks at the names and descriptions of every namespace, command and variable. Exact and
prefix matches rank first. Initials work (`bs` finds `brush.size`) and small typos are tolerated
(`brush.sise` finds `brush.size`).

Picking a result:

| Result | Effect |
|---|---|
| command without required arguments | runs it |
| command with required arguments | inserts it so you can type them |
| variable | inserts its name |
| namespace | inserts `namespace.` |

## Completion

Tab completes the word under the caret and never runs anything:

- after `/`, command names;
- after `namespace.`, that namespace's commands, variables and nested namespaces; after
  `/namespace.`, the commands of that namespace and of every namespace nested in it;
- in a scope, names relative to it come before full addresses;
- in a command's arguments, the `autocomplete` or `enumValues` of that argument.

## Scripts

`/script` opens every variable as INI text; `/script brush` opens the `brush` namespace only, and
`/script pixelart` opens `pixelart` and every namespace nested in it. In a scope, `/script` opens
the scope. A nested namespace is a section of its own, named by its full address
(`[pixelart.keybinds]`).

```ini
; Page theme <light|dark|auto>
theme = dark

; Voxel brush
[brush]
; Brush size in voxels, from 1 to 16 <number>
size = 3
```

- Root variables come first, then one `[namespace]` section each. Section and key names are
  case-insensitive, and a root key may also be a full address (`brush.size = 3`).
- A line starting with `;` or `#` is a comment. There are no comments after a value, so
  `undo = mod+;` keeps its `;`.
- A value is everything after the first `=`, trimmed, and is coerced as in the prompt. Quote it
  to keep leading or trailing spaces or to write an empty string: `label = "  padded"`, with `\"`
  and `\\` escapes.
- A list value is written as at the prompt, one quoted item at a time:
  `redo = Mod+y Mod+Shift+z`, `tags = "two words" b`. An empty value is the empty list.
- The comments are written again each time the script opens; comments you add are not kept.

Ctrl+S saves only the lines whose value changed, all or nothing; Escape discards the text.
Saving is refused while a line has an error: an unknown namespace or variable, a key set twice,
a value its type rejects, an unterminated quote or a line without `=`.

## Typos

| Word length | Typos tolerated |
|---|---|
| 1 to 3 | none |
| 4 to 7 | 1 |
| 8 and more | 2 |

An unknown command or variable prints an error, followed by a suggestion when one is close
enough: `Did you mean /brush.grow?`. The suggestion is never run.
