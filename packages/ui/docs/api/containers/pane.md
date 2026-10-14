# `jolly-pane`

`jolly-pane` provides a header, actions slot, and content surface.

```html
<jolly-pane key="inspector" heading="Inspector" collapsible>
  <jolly-button slot="actions">Reset</jolly-button>
  <jolly-folder label="Transform"></jolly-folder>
</jolly-pane>
```

| Property | Attribute | Type | Default |
|---|---|---|---|
| `heading` | `heading` | `string` | `""` |
| `icon` | `icon` | `IconName` | `""` |
| `tone` | `tone` | `IconTone | ""` | `""` |
| `key` | `key` | `string` | `""` |
| `reorderable` | `reorderable` | `boolean` | `false` |
| `collapsible` | `collapsible` | `boolean` | `false` |
| `collapsed` | `collapsed` | `boolean` | `false` |
| `grow` | `grow` | `boolean` | `false` |
| `dragging` | `dragging` | `boolean` | `false` |
| `locked` | `locked` | `boolean` | `false` |
| `disabled` | `disabled` | `boolean` | `false` |
| `grouped` | `grouped` | `boolean` | Derived from its parent |
| `inactive` | `inactive` | `boolean` | Set by its group |
| `searchable` | `searchable` | `boolean` | `false` |
| `floatWidth` | `float-width` | `number \| undefined` | `undefined` |
| `floatHeight` | `float-height` | `number \| undefined` | `undefined` |
| `movable` | `movable` | `boolean` | Derived from its container |
| `storageKey` | `storage-key` | `string` | `""` |
| `storage` | none | `StorageAdapter` | `LocalStorageAdapter` |
| `presence` | none | `PresenceSource \| null` | `null` |

`actions` is the named header slot. The default slot contains pane content.
Collapsing emits `jolly-toggle` with `{ open }`. Committed folder ordering
emits `jolly-reorder` with `{ keys }`. A non-empty `icon` renders a registered
glyph before the title. The component exposes `header`, `icon`, `title`,
`actions`, and `content` CSS parts. Dock layouts and floating windows set
`movable`; a dock layout sets `dragging` during a move preview. A pane inside a
`jolly-pane-group` is `grouped`, and `inactive` while another tab is shown.
`floatWidth` and `floatHeight` size, in pixels, the window a dock layout opens
when the pane is first dragged out of its dock.

A `disabled` pane dims its content and makes it inert. Inside a
`jolly-pane-group` its tab is disabled too: it cannot be selected or dragged,
keyboard navigation skips it, and it is never resolved as the active pane.

A pane whose `icon` has a [registered tone](../icon/registry.md#tones), or that
sets `tone`, is a toned area: its header, the tab bar of its group while it is
active, and the folder headers, separators and accent-filled controls inside it
take that hue instead of the accent. The read-only `ownTone` getter returns the
resolved tone or `null`. `areaTone` returns the tone the pane paints, which is
`ownTone` unless its dock sets [`share-tone`](./dock.md).

While its grip is grabbed, Up and Down move the pane within its dock, Left and
Right send it to the adjacent dock, and Shift with Up or Down joins it to the
group above or below. Space commits and Escape cancels.

## Searching content

A `searchable` pane shows a compact [`jolly-search`](../controls/search.md) at
the end of its header, also in a grouped pane. Opened, the search box takes the
place of the title. Ctrl+F (⌘F on macOS) opens it while focus is anywhere in
the pane, and `openSearch()` opens it from code.

Each query goes to the elements in the default slot:

- An element with an `applySearch` method, the [`Searchable`](../search.md#searchable)
  hook, filters itself. [`jolly-tree`](../data/tree.md#filtering-rows) hides
  rows and [`jolly-folder`](./folder.md#searching) hides fields.
  Every field and `jolly-property-row` match on their `label`.
- Any other element, such as a button or a separator, is left as it is.

An element with no match gets the `data-search-miss` attribute and is hidden
until the query changes. When every element that took part misses, the pane
shows "No matches" in a `no-matches` part. Each query is announced through the
pane's live region as a match count.

The pane emits `jolly-search` with `{ query }`, the trimmed text, whenever the
query changes, including to `""` when it is cleared. Listen for it to filter
content the pane cannot reach. `searchQuery` holds the current trimmed query.
Content slotted in during a search is filtered as it arrives. Turning
`searchable` off clears the search.

The header search is exposed as the `search` CSS part.
