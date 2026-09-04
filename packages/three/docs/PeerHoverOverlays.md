# PeerHoverOverlays

Renders exactly one dashed, faded overlay per object that a remote peer is
hovering - the hover counterpart to
[PeerSelectionOverlays](./PeerSelectionOverlays.md), for the `"outline"`
technique. Reuses that class's same per-object overlay structure and the same
oldest-wins tie-break (`hoverRegistry.primaryHovererOf`, mirroring
`registry.primarySelectorOf`), colored by
[PeerHoverRegistry](./PeerHoverRegistry.md)'s `colorOf`.

Three priority rules, resolved fresh on every internal refresh:

1. Any current selector on the object - local (`selection.selected`) or any
   peer (`selectionRegistry.selectorsOf`) - suppresses every hover indicator
   for it entirely. A selection already reads at full strength; a fainter
   hover ring underneath it would be redundant at best, confusing at worst.
2. Failing that, the local user's own hover (`selection.hovered === objectId`)
   always wins over any peer hover on the same object - the local hover
   already renders through `SelectionManager` itself, so this class simply
   renders nothing more for that id.
3. Failing both, the oldest peer currently hovering the object
   (`hoverRegistry.primaryHovererOf`) wins.

```ts
import {
  SelectionManager,
  PeerSelectionRegistry,
  PeerHoverRegistry,
  PeerHoverOverlays
} from "@jolly-pixel/three";

const selection = new SelectionManager();
const selectionRegistry = new PeerSelectionRegistry();
const hoverRegistry = new PeerHoverRegistry();
const hoverOverlays = new PeerHoverOverlays({ selectionRegistry, hoverRegistry, selection });

selection.register("box-1", mesh);
hoverRegistry.hover("peer-a", "box-1"); // draws a dashed, faded overlay in peer-a's color

// ... later
hoverOverlays.dispose();
```

## PeerHoverOverlaysOptions

```ts
export interface PeerHoverOverlaysOptions {
  /**
   * Consulted only to check whether an object currently has any selector at
   * all (local or peer) - a selection always wins over a hover indicator.
   */
  selectionRegistry: PeerSelectionRegistry;
  hoverRegistry: PeerHoverRegistry;
  selection: SelectionManager;
  /**
   * @default 0.35
   */
  opacity?: number;
  /**
   * Suppresses a peer hover overlay (same as no hoverer at all) for any
   * object `visibility.isVisible` reports `false` for - e.g. outside the
   * camera frustum or beyond a configured max distance. Never consulted for
   * the local user's own selection/hover. Omitting this preserves
   * always-visible behavior.
   */
  visibility?: PeerSelectionVisibility;
}
```

`opacity` defaults to `0.35` - the same "faded" visual language
`SelectionManager`'s own local hover already uses via `hoverOpacity`, rather
than a full-strength `1` like `PeerSelectionOverlays`'s own default.

## Methods

- `refreshAll(): void` - Re-applies color and x-ray to every currently active peer hover overlay against `selection`'s current state. Same rationale as `PeerSelectionOverlays.refreshAll`'s own doc comment - `SelectionManager.setXray` dispatches no event of its own.
- `dispose(): void` - Detaches its listeners and disposes every active peer hover overlay. Does not touch `selectionRegistry`/`hoverRegistry`/`selection`/`visibility` state - only this class's own render output.

## Notes

- Reuses the same `createSelectionOverlay` function `PeerSelectionOverlays` uses internally, with `dashed: true` - a peer-hovered mesh (or group) gets the same `SelectionOutline`/`SelectionBoundingBox` choice `PeerSelectionOverlays` would build, just dashed and at `opacity` instead of full strength.
- When `selection.techniqueFor(id)` resolves to `"highlight"` or `"highlightJfa"`, this class falls back to `"outline"` instead, same reasoning and same fallback `PeerSelectionOverlays` already applies - [PeerHighlightPass](./PeerHighlightPass.md)'s own `hoverRegistry` option is the equivalent driver for those techniques (a shared pipeline instance, not a per-id overlay, so it can't represent more than one simultaneously colored peer hover the way this class needs).
- `visibility` (frustum/distance culling) only ever gates the peer-hover branch - never the local selection/hover checks above, same convention `PeerSelectionOverlays`'s own `visibility` option already uses. Pass the same `PeerSelectionVisibility` instance to both, constructed with its own `hoverRegistry` option, so a peer-hovered-only object gets the same culling a peer selection already does.
- Listens to `selectionRegistry`'s `peerSelectionChange`, `hoverRegistry`'s `peerHoverChange`, `selection`'s `selectionChange`/`hoverChange`, and (if `visibility` was given) `visibility`'s `visibilityChange` to know when to rebuild - covers every input any of the three priority rules above depends on.
- See `examples/scripts/demo-peer-selection-sync.ts` (run `npm run dev`, open `/peer-selection-sync.html` in two tabs) for a real end-to-end demo - hovering an unselected mesh in one tab shows a faded, dashed ring in the other.
