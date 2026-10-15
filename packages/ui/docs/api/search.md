# Search queries

`SearchQuery` is the matcher behind [`jolly-search`](./controls/search.md)
consumers, [`jolly-tree`](./data/tree.md#filtering-rows) filtering and
[`jolly-pane`](./containers/pane.md#searching-content) searches. `Searchable`
is the method a pane calls on its content to hand a query over.

```ts
import { SearchQuery } from "@jolly-pixel/ui";

const query = new SearchQuery("noel");
query.matches("Noël lights");
// true
query.rangeIn("Noël lights");
// { start: 0, end: 4 }
```

## `SearchQuery`

An immutable query. Matching is a substring test that ignores case and
diacritics on both sides, so `ecole` finds `École` and `école` finds `Ecole`.

### `new SearchQuery(text)`

Trims `text`. A blank `text` makes an empty query.

### `SearchQuery.EMPTY`

The empty query.

### `text`

`string`. The trimmed text the query was built from.

### `isEmpty`

`boolean`. `true` when the trimmed text is empty.

### `matches(text)`

Returns whether `text` contains the query. An empty query matches every text.

### `rangeIn(text)`

Returns the first match as a `SearchMatch` with `start` and `end` offsets into
`text` itself, even when folding diacritics changed its length, so
`text.slice(start, end)` is the matched part. Returns `null` when nothing
matches and for an empty query.

### `equals(other)`

Returns whether both queries match the same texts: `new SearchQuery("Noël")`
equals `new SearchQuery(" noel ")`.

## `Searchable`

```ts
interface Searchable {
  applySearch(query: SearchQuery): number;
}
```

- `applySearch` filters what the element shows and returns its match count.
- It receives `SearchQuery.EMPTY` when the search clears, and must then show
  everything again.
- `jolly-tree`, `jolly-folder`, `jolly-property-row` and every field
  implement it.

An element wrapping a tree in its own shadow root forwards the call:

```ts
class HierarchyPanel extends LitElement implements Searchable {
  applySearch(query: SearchQuery): number {
    return this.renderRoot.querySelector("jolly-tree")?.applySearch(query) ?? 0;
  }
}
```
