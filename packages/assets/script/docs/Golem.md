# Golem

`@jolly-pixel/asset.script/golem` lets a golem open `script`, `shader` and `text` assets. Its `GOLEM_KINDS` export is what `@jolly-pixel/golem` imports for these kinds when the studio lists this package; `golem.open(assetId, "script")` then returns the class below. Importing the entry adds the kinds to the `GolemAssets` interface of `@jolly-pixel/golem.kit`, which types that call.

An agent reaches the same edits through the MCP server: `asset_open` answers the guide in `src/golem/guide.md` and the intents below with their input schema, and `asset_intent` runs one.

## Intents

The three kinds share them:

- `read({ from?, to? })`: `lines`, answering `{ from, to, lineCount, text }`.
- `replace({ search, replace, all? })`: answers `{ replaced }`.
- `write({ text })`: answers `{ lineCount }`.

## `TextAsset`

The asset for `script`, `shader` and `text`. Its one command is `{ action: "edited", changes }`, where each change is `{ at, insert }` or `{ at, delete }` with `at` an offset in UTF-16 code units, applied in order. `replace` and `write` build it for you.

```ts
const notes = await golem.open(assetId, "text");
await notes.replace("- bread", "- milk");
await notes.settled();
```

### `text: string` and `lineCount: number`

The current text and its number of lines. A text ending with a line break counts the empty line after it.

### `read(): string`

The whole text, as `text`.

### `lines(range): TextLines`

The lines `range.from` to `range.to` (default: the last line), counted from 1, as `{ from, to, lineCount, text }`. `text` joins them with `\n` and `to` is capped at `lineCount`. Throws `RangeError` when `from` is below 1 or `to` is below `from`. A range past the end reads `""`.

### `replace(search, replacement, options?): Promise<number>`

Replaces `search`, matched exactly, and returns how many occurrences it replaced.

- Throws `TextMatchError` when `search` is missing, or appears more than once and `options.all` is not `true`. `error.matches` holds the count.
- Throws `TypeError` for an empty `search`.

### `write(text): Promise<void>`

Replaces the whole text. Only the part that differs is sent, so people's carets outside it stay put. Sends nothing when the text is unchanged.

### Focus

After each batch, the golem's caret presence (`caret`) moves to the end of the batch's last change, so the script editor shows it like a person's caret.

## How it works

- `SyncedScript`'s sync client merges pending edits into one network command and answers each merged step from that command's receipt.
- One `TextAsset` class serves `script`, `shader` and `text`; `textGolemKind(kind)` passes the kind.
