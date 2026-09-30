# Input grammar

The prompt accepts three kinds of input. The first character and the registry decide which one a
line is, on every keystroke.

```
command     := "/" (namespace ".")? identifier (" " literal)*
var-access  := (namespace ".")? identifier (" " literal)?
forced      := "?" text
literal     := bare-token | quoted
quoted      := '"' (any character, with \" and \\ as escapes) '"'
```

A literal containing a space needs quotes, as in `keybind.redo "mod+y, mod+shift+z"`, unless it
fills a `rest` argument. v1 has no `--flag` and no `key=value` syntax.

## Coercion

| Declared type | Accepts |
|---|---|
| `string` | any literal |
| `number` | a literal that parses to a finite number |
| `boolean` | `true`, `false`, `yes`, `no`, `y`, `n`, `on`, `off`, `1`, `0`, case-insensitive |
| `enum` | one of `enumValues`, matched case-insensitively and passed in its declared case |

A literal the type refuses prints an error and the handler or setter is not called.

## Modes

| Mode | Input | Suggestions | Enter |
|---|---|---|---|
| command | starts with `/` | completions for the token under the caret, none highlighted | runs the line |
| variable | the first token resolves exactly to a variable | `enum` and `boolean` values, otherwise the current value as a hint | reads or writes the variable |
| search | anything else, or a leading `?` | fuzzy results, the first one highlighted | acts on the highlighted result |

An exact variable match beats search. `brush.si` is a search; Enter on the top hit inserts
`brush.size`, which puts the prompt in variable mode, and a second Enter reads the value. The cost
is that a root variable named `fps` makes the word `fps` unsearchable. A leading `?` forces search
(`?fps`), and registrants should keep root variables few and namespace the rest.

An unknown command prints `Unknown command "/name"` and never falls back to search. Submitting
search text with nothing highlighted prints that it is not a variable.

## Search

The corpus is every namespace, command and variable, by name and by description. The scorer ranks
by tier, then by score inside a tier:

1. exact match
2. prefix
3. word boundaries and camelCase humps, so `bs` finds `brush.size`
4. contiguous substring
5. scattered subsequence

A name match ranks above any description match, whatever the tier, and descriptions never match
by scattered subsequence. The matched ranges are returned so the element can mark them. An empty
query returns nothing, which leaves Up free to recall history.

Picking a result:

| Result | Effect |
|---|---|
| command with no required argument | runs it |
| command with a required argument | inserts `/namespace.command ` to complete |
| variable | inserts its address, which switches to variable mode |
| namespace | inserts `namespace.` |

## Completion

- After `/`, command names in root and `namespace.` forms.
- After `namespace.`, that namespace's commands and variables only.
- After `/command `, the values of `autocomplete` or `enumValues` for the argument under the caret.

Tab completes the current token and never runs anything. When `autocomplete` returns a promise, the
latest request wins: an older result is discarded, and the previous list stays on screen while the
new one loads.
