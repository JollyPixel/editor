# PeerSelectionOverlays

Renders exactly one overlay per object that a remote peer has selected,
colored by [PeerSelectionRegistry](./PeerSelectionRegistry.md)'s
`primarySelectorOf` (the peer that selected it first) - never one overlay per
peer, regardless of how many peers are selecting the same object at once.

This is the render-side half of a deliberate split: the 3D viewport stays
cheap (one overlay per selected object, full stop), while the full list of
selectors per object still lives in `registry.selectorsOf` for a caller to
render elsewhere (e.g. as avatar chips in an outliner - see
`examples/scripts/selection.ts`'s `refreshChips`).

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
  /**
   * Suppresses a peer overlay (same as no selector at all) for any object
   * `visibility.isVisible` reports `false` for - e.g. outside the camera
   * frustum or beyond a configured max distance. Never consulted for the
   * local user's own selection. Omitting this preserves today's
   * always-visible behavior.
   */
  visibility?: PeerSelectionVisibility;
}
```

## Methods

- `dispose(): void` - Detaches its listeners and disposes every active peer overlay. Does not touch `registry`/`selection`/`visibility` state - only this class's own render output.

## Notes

- Reuses the same `createSelectionOverlay` function `SelectionManager` uses internally, via `selection.techniqueFor(id)`/`selection.targetFor(id)`/`selection.outlineOptions`/`selection.boundingBoxOptions`/`selection.xray`, so a peer-selected mesh (or group) gets the same `SelectionOutline`/`SelectionBoundingBox` choice and tuning (linewidth, fill opacity, xray) as a locally-selected one would, just in the peer's color. A peer overlay already on screen is not retroactively retuned by a later `setOutlineOptions`/`setBoundingBoxOptions`/`setXray` call on `selection` - only recoloring (a primary-selector change) is cheap enough to apply in place (see the note below); the new tuning applies the next time that overlay is disposed and rebuilt (e.g. every peer deselects the object, then one selects it again).
- When `selection.techniqueFor(id)` resolves to `"highlight"` or `"highlightJfa"` (see [SelectionManager](./SelectionManager.md)'s `isScenePipelineTechnique`), a peer overlay falls back to `"outline"` instead - each is one shared pipeline ([HighlightPass](./HighlightPass.md)/[HighlightPassJfa](./HighlightPassJfa.md)), not a per-id instance, so neither can represent more than one simultaneously colored peer selection the way this class needs.
- When the primary peer for an object changes (e.g. the oldest selector deselects and a newer one is promoted), the existing overlay instance is recolored via `setColor` rather than disposed and rebuilt - cheaper, and avoids visible geometry churn.
- Listens to `registry`'s `peerSelectionChange`, `selection`'s `selectionChange`, and (if `visibility` was given) `visibility`'s `visibilityChange` to know when to suppress/restore a peer overlay against the local selection or camera visibility. See [PeerSelectionVisibility](./PeerSelectionVisibility.md) for what determines visibility.
