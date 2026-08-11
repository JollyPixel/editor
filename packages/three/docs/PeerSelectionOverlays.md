# PeerSelectionOverlays

Renders exactly one overlay per object that a remote peer has selected,
colored by [PeerSelectionRegistry](./PeerSelectionRegistry.md)'s
`primarySelectorOf` (the peer that selected it first) - never one overlay per
peer, regardless of how many peers are selecting the same object at once.

This is the render-side half of a deliberate split: the 3D viewport stays
cheap (one overlay per selected object, full stop), while the full list of
selectors per object still lives in `registry.selectorsOf` for a caller to
render elsewhere (e.g. as avatar chips in an outliner - see
`examples/scripts/demo-selection.ts`'s `refreshChips`).

Whenever the local [SelectionManager](./SelectionManager.md) also has an
object selected, its own overlay wins visually - the peer overlay for that
object is suppressed (not removed from the registry, just hidden) and
reappears the instant the local selection moves away.

```ts
import { SelectionManager, PeerSelectionRegistry, PeerSelectionOverlays } from "@jolly-pixel/three";

const selection = new SelectionManager();
const registry = new PeerSelectionRegistry();
const overlays = new PeerSelectionOverlays({ registry, selection });

selection.register("box-1", mesh);
registry.select("peer-a", "box-1"); // draws one overlay in peer-a's color

// ... later
overlays.dispose();
```

## PeerSelectionOverlaysOptions

```ts
export interface PeerSelectionOverlaysOptions {
  registry: PeerSelectionRegistry;
  selection: SelectionManager;
  /**
   * @default 1
   */
  opacity?: number;
}
```

## Methods

- `dispose(): void` - Detaches its listeners and disposes every active peer overlay. Does not touch `registry` or `selection` state - only this class's own render output.

## Notes

- Reuses the same `createSelectionOverlay` function `SelectionManager` uses internally, via `selection.styleFor(id)`/`selection.targetFor(id)`/`selection.outlineOptions`/`selection.highlightOptions`/`selection.xray`, so a peer-selected mesh gets the same `SelectionOutline`/`SelectionHighlight`/`SelectionBoundingBox` choice and tuning (linewidth, thickness, xray) as a locally-selected one would, just in the peer's color. A peer overlay already on screen is not retroactively retuned by a later `setOutlineOptions`/`setHighlightOptions`/`setXray` call on `selection` - only recoloring (a primary-selector change) is cheap enough to apply in place (see the note below); the new tuning applies the next time that overlay is disposed and rebuilt (e.g. every peer deselects the object, then one selects it again).
- When `selection.styleFor(id)` resolves to `"toonOutline"` (see [ToonOutlinePass](./ToonOutlinePass.md)), a peer overlay falls back to `"outline"` instead - `ToonOutlinePass` is one shared pipeline, not a per-id instance, so it can't represent more than one simultaneously colored peer selection the way this class needs.
- When the primary peer for an object changes (e.g. the oldest selector deselects and a newer one is promoted), the existing overlay instance is recolored via `setColor` rather than disposed and rebuilt - cheaper, and avoids visible geometry churn.
- Listens to both `registry`'s `peerSelectionChange` and `selection`'s `selectionChange` to know when to suppress/restore a peer overlay against the local selection.
