# `jolly-pane`

`jolly-pane` provides a header, an actions slot and a content surface.

```html
<jolly-pane key="inspector" heading="Inspector" collapsible>
  <jolly-button slot="actions">Reset</jolly-button>
  <jolly-folder label="Transform"></jolly-folder>
</jolly-pane>
```

## Properties

```ts
interface PaneElement {
  heading: string;
  icon: IconName; // registered glyph before the title
  tone: IconTone | "";
  key: string;
  reorderable: boolean; // folders can be reordered
  collapsible: boolean;
  collapsed: boolean;
  grow: boolean;
  locked: boolean; // keeps its authored place in a dock layout
  disabled: boolean;
  searchable: boolean;
  // Window size, in pixels, when first dragged out of a dock.
  floatWidth: number | undefined; // attribute float-width
  floatHeight: number | undefined; // attribute float-height
  storageKey: string; // attribute storage-key
  storage: StorageAdapter; // property only, default LocalStorageAdapter
  presence: PresenceSource | null; // property only

  // Set by its container.
  movable: boolean; // inside a dock layout or floating window
  dragging: boolean; // during a move preview
  grouped: boolean; // inside a jolly-pane-group
  inactive: boolean; // another tab of its group is shown

  readonly ownTone: IconTone | null;
  readonly areaTone: IconTone | null;
  readonly chromeElement: HTMLElement;
  readonly searchQuery: string;
}
```

- `ownTone` is the resolved `tone`, or the tone of `icon`.
- `areaTone` is the tone the pane paints: `ownTone`, unless its dock sets
  [`share-tone`](./dock.md#shared-tone).
- `chromeElement` is the element that draws the pane with its heading: the
  parent `jolly-pane-group` when grouped, otherwise the pane. Measure it to
  outline the whole pane.
- `presence` feeds every field below the pane, see
  [Presence and locking](../peer/presence-source.md).

## Events

```ts
interface PaneEvents {
  "jolly-toggle": { open: boolean; }; // collapsed or expanded
  "jolly-reorder": { keys: string[]; }; // folder order committed
  "jolly-search": { query: string; }; // trimmed, "" when cleared
}
```

## Methods

### `openSearch(): Promise<void>`

Opens the header search of a `searchable` pane.

## Slots and parts

- Slots: `actions` (header), default (content).
- Parts: `header`, `icon`, `title`, `actions`, `content`, `search`,
  `no-matches`.

## Tone

A pane with a tone is a [toned area](../theme/tokens.md#toned-areas): its
header, its group tab while active, and the folder headers, separators and
accent-filled controls inside take the hue.

## Disabled

- Content is dimmed and inert.
- In a `jolly-pane-group`, the tab cannot be selected or dragged, and keyboard
  navigation skips it.

## Moving

Grab the pane by its grip, then follow the
[keyboard moves](./dock-layout.md#keyboard-moves) of the dock layout.

## Searching content

A `searchable` pane shows a compact [`jolly-search`](../controls/search.md) at
the end of its header.

- Ctrl+F (⌘F on macOS) opens it while focus is in the pane. The box replaces
  the title while open.
- Each query goes to the elements of the default slot. An element with an
  `applySearch` method ([`Searchable`](../search.md#searchable)) filters
  itself: fields and `jolly-property-row` by `label`,
  [`jolly-tree`](../data/tree.md#filtering-rows) by row,
  [`jolly-folder`](./folder.md#searching) by field.
- Other elements, such as buttons and separators, stay as they are.
- An element with no match gets `data-search-miss` and is hidden.
- When every element misses, the pane shows "No matches" in the `no-matches`
  part.
- Each query is announced as a match count.
- Content slotted in during a search is filtered as it arrives.
- Turning `searchable` off clears the search.
- Listen to `jolly-search` to filter content the pane cannot reach.
