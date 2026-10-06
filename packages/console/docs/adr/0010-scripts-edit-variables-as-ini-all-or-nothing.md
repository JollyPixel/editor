---
status: accepted
---

# Scripts edit variables as INI text, all or nothing

`/script [namespace]` writes the variables as INI text: root variables, then one `[namespace]`
section each, with the description and type as comments. Namespaces are one level deep, so a
section maps onto exactly one namespace. Saving parses the whole text first and writes nothing
while a line has an error. It then writes only the keys whose value differs from the one read
when the script was written, in document order, and sets back the values already written when a
`set` rejects. A successful save is one `/revert` step.

Highlighting is written for this grammar instead of using a library: a `textarea` with
transparent text sits over a `pre` holding colored spans, both sized by the same grid cell inside
one scroller. The line scanner is shared by the parser and the highlighter, and the parser knows
each key's variable, so values are colored by their type and errors are underlined.

## Considered Options

- **JSON or TOML.** JSON needs quotes on every key and string; TOML adds types the console does
  not have. INI is as short as the prompt syntax.
- **Shiki.** It colors by a TextMate grammar and cannot know a key's variable type or a value's
  validity. It adds a regex engine, a grammar and a theme to the bundle, starts asynchronously,
  and would still need the same overlay to be editable.
- **`contenteditable` with the CSS Custom Highlight API.** No overlay to keep aligned, but
  `::highlight()` inside shadow roots is uneven across browsers, and `contenteditable` brings its
  own caret and undo behavior.
- **Writing every key on save.** Simpler, but a value moved elsewhere while the script was open,
  such as a brush slider, would be overwritten by the stale text.
- **Keeping the writes that succeeded before a rejection.** The script would be half applied with
  no single step to undo it.

## Consequences

- A comment added by hand is lost, since the console persists nothing
  ([ADR-0005](./0005-output-is-plain-text.md)) and comments are written again on every open.
- A value cannot carry a trailing comment, so `;` and `#` inside a value need no escaping.
- Rolling back calls `set` again; a setter with side effects runs them twice.
- A mirrored variable is written through its usual asynchronous `set`, one message per change,
  with no protocol change ([ADR-0008](./0008-mirrored-variables-read-a-cached-value.md)).
