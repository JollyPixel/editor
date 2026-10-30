# Input grammar

The prompt reads one line. `[ ]` is optional, `{ }` repeats zero or more times, `|` separates
alternatives.

```text
line     = "?" text | command | variable | text
command  = "/" address { token }
variable = address { token }
address  = name { "." name }
name     = ( letter | "_" ) { letter | digit | "_" | "-" }
token    = word | quoted
word     = any run of characters without whitespace
quoted   = '"' { character | '\"' | '\\' } '"'
```

## Tokens

Spaces, tabs and line breaks separate tokens. A quoted token keeps its spaces; `\"` and `\\` are
its only escapes. An unclosed quote is an error and nothing runs. There are no `--flag` or
`key=value` forms.

## Modes

The first rule that matches decides:

1. a line starting with `?` searches for the rest;
2. a first token starting with `/` runs a command;
3. a first token naming a variable reads or sets it;
4. anything else is a search.

A quoted first token never matches 2 or 3. Because 3 comes before 4, a root variable named `fps`
hides the word `fps` from search; `?fps` searches for it.

## Commands

`/brush.grow 2` binds tokens to the command's arguments in order and coerces each one to its
type. A missing required argument or an extra token is an error. When the last argument is
declared `rest`, it receives the remaining text as typed, spaces and quotes included.

## Variables

`brush.size` prints the value and `brush.size 3` sets it. A scalar takes exactly one token, so
quote a value with spaces: `brush.label "main brush"`. A list takes every token after the name:
`pixelart.keybinds.redo Mod+y Mod+Shift+z`, `tags "two words" b`. A lone `""` is the empty list;
an empty item among others is an error.

## Values

- `string`: the token as written.
- `number`: anything `Number()` reads as finite, such as `3`, `-0.5` or `1e3`.
- `boolean`: `true`, `yes`, `y`, `on`, `1` or `false`, `no`, `n`, `off`, `0`, in any case.
- `enum`: one of `enumValues`, in any case.
- `string[]`, `number[]`, `boolean[]`: tokens, each coerced as its item type.

A value its type rejects is an error and nothing runs.

## Scope

An address splits at its last dot: `pixelart.keybinds.undo` is the variable `undo` of the
namespace `pixelart.keybinds`.

`/cd pixelart.keybinds` enters a scope. An address is then tried as `<scope>.<address>` first,
then as written, so in `pixelart.keybinds`:

- `undo mod+u` sets `pixelart.keybinds.undo`;
- `/reset` runs `/pixelart.keybinds.reset`;
- `/help` and `brush.size 3` are unchanged.

`/cd keybinds` from `pixelart` enters `pixelart.keybinds`, `/cd ..` goes up one level and `/cd`
returns to the root.

## Scripts

`/script [namespace]` opens the variables as INI text:

```text
script  = line { newline line }
line    = blank | comment | section | entry
comment = ( ";" | "#" ) text
section = "[" address "]"
entry   = key "=" value
```

```ini
; Page theme <light|dark|auto>
theme = dark

; Voxel brush
[brush]
; Brush size in voxels, from 1 to 16 <number>
size = 3
```

- Entries before the first section belong to the root, where a key may be a full address
  (`brush.size = 3`). A nested namespace has its own section named by its full address
  (`[pixelart.keybinds]`). Section and key names are case-insensitive.
- A key ends at the first `=`; key and value are trimmed. Comments take a whole line, so
  `undo = mod+;` keeps its `;`.
- A scalar value may be quoted to keep leading or trailing spaces or to write an empty string:
  `label = "  padded"`. Nothing may follow the closing quote.
- A list value is written as at the prompt: `redo = Mod+y Mod+Shift+z`. An empty value is the
  empty list.
- Comments are written again each time the script opens; added ones are not kept.

These lines are errors and block the save: an unknown namespace or variable, a key set twice, a
value its type rejects, an unterminated quote, a section without `]`, a line without `=`.
