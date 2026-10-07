---
status: accepted
---

# List items are space-separated tokens

A list variable is typed `string[]`, `number[]` or `boolean[]`. At the prompt and in a script, its
value is the items separated by spaces, each quoted like a command argument:
`tags "two words" b`. A lone `""` is the empty list, and an empty item next to others is an error.
The console prints a list the same way, so a printed value reads back as the same items. Revert,
script saves and mirrored writes all go through that text.

## Considered Options

- **A comma separator.** `redo "Mod+y, Mod+Shift+z"` needs quotes around the whole list, and an
  item holding a comma needs an escape the prompt does not have.
- **A JSON array.** `["Mod+y","Mod+Shift+z"]` is unambiguous but quotes every string, which the
  prompt never asks for elsewhere.
- **A `list` flag on each scalar type.** Every `switch` over `type` would need a second check, and
  `set` could not be typed from one discriminant.
- **`type: "list"` with an `items` field.** It types `set`, but every dispatch over `type` still
  needs a nested one over `items`.

## Consequences

- A list cannot hold an empty string. A getter that returns one makes the variable unreadable, so
  `[""]` never prints as the empty list.
- Command arguments stay scalar; a `rest` string argument already takes the rest of the line.
- A separator option on the variable is possible later without changing the default.
