`script` (`.ts`), `shader` (`.tsl.ts`) and `text` (`.md`) assets are plain text that people edit together, each with a caret.

- Read with the `read` intent; pass `from` and `to` (lines from 1) for a long file.
- Change a part with `replace`. `search` is matched exactly, whitespace and line breaks included, and must appear once: when it is not unique, add the lines around it rather than setting `all`, unless you mean every occurrence.
- Use `write` to write a new file or rewrite most of one. It sends only what changed.
- A person may be typing in the same file. When a replace fails to find its text, read the file again before retrying.
- In a script, `golem.open(assetId, "script")` returns a `TextAsset` with `text`, `lines(range)`, `replace(search, replacement, { all })` and `write(text)`.
