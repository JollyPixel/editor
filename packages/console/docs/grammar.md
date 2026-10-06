# Input grammar

The prompt accepts three kinds of input:

| Input | Mode | Enter |
|---|---|---|
| `/brush.grow 2` | command | runs the command |
| `brush.size` | variable | prints the value |
| `brush.size 3` | variable | sets the value |
| anything else, or `?text` | search | acts on the highlighted result |

Arguments are separated by spaces. Quote a value that contains spaces:
`keybind.redo "mod+y, mod+shift+z"`. Inside quotes, `\"` and `\\` are escapes. There are no
`--flag` or `key=value` forms.

## Values

| Type | Accepts |
|---|---|
| `string` | anything |
| `number` | a finite number |
| `boolean` | `true`/`false`, `yes`/`no`, `y`/`n`, `on`/`off`, `1`/`0` (any case) |
| `enum` | one of `enumValues` (any case) |

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
- after `namespace.`, that namespace's commands and variables;
- in a command's arguments, the `autocomplete` or `enumValues` of that argument.

## Scripts

`/script` opens every variable as INI text; `/script brush` opens the `brush` namespace only.

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
  `keybind.undo = mod+;` keeps its `;`.
- A value is everything after the first `=`, trimmed, and is coerced as in the prompt. Quote it
  to keep leading or trailing spaces or to write an empty string: `label = "  padded"`, with `\"`
  and `\\` escapes.
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
