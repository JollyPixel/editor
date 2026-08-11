# ColorPalette

Assigns colors from a small fixed palette, either round-robin or
deterministically per key (e.g. a network client id). Used by
[PeerSelectionRegistry](./PeerSelectionRegistry.md) to give each remote peer a
stable color without any coordination between clients.

```ts
import { ColorPalette } from "@jolly-pixel/three";

const palette = new ColorPalette();
palette.next();               // "#f94144", round-robin
palette.forKey("peer-abc123"); // always the same color for this key
```

## ColorPaletteOptions

```ts
export interface ColorPaletteOptions {
  /**
   * @default a built-in 8-color palette
   */
  colors?: string[];
}
```

## Methods

- `next(): string` - Returns the next color in the palette, wrapping back to the start once exhausted. Does not affect `forKey`.
- `forKey(key: string): string` - Deterministic color for an arbitrary key, stable across calls and independent of `next()`'s own cursor.
- `reset(): void` - Restarts `next()` from the beginning of the palette.

## Notes

- Deliberately duplicated from `@jolly-pixel/pixel-draw-renderer`'s own `ColorPalette` (same hashing scheme) rather than pulled in as a cross-package dependency - `@jolly-pixel/three` should not depend on `@jolly-pixel/pixel-draw-renderer`. Only worth extracting to a shared package if a third consumer appears.
