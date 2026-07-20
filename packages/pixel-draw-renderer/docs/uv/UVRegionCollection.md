# UVRegionCollection

`UVRegionCollection` is a value object wrapping an id-keyed map of `UVRegion`s, used internally by [`PixelBuffer.uvRegions`](../buffer/PixelBuffer.md#uvregions). It exists to enforce that entries are always keyed by `region.id` (never a mismatched key) and that stored regions are copies, immune to later mutation of the object a caller passed in.

## Methods

```ts
get(id: string): UVRegion | undefined
set(region: UVRegion): void
remove(id: string): void
```

`get`/`remove` look up or delete by id. `set` stores a copy of `region`, upserting by `region.id`.

It also implements `Symbol.iterator`, yielding every stored region — use `[...collection]` (as `PixelSyncServer.snapshot()` does) rather than a dedicated "get all" method.
