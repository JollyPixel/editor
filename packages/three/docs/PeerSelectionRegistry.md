# PeerSelectionRegistry

Tracks which remote peers currently have which object selected, extending
`EventTarget`. Purely bookkeeping - no `THREE` objects, no network types - so
it can be driven directly by fake peers in a demo today and by real
`@jolly-pixel/network` presence events later without changing this class.

Deliberately separate from [SelectionManager](./SelectionManager.md), which is
single-local-user state (one `selected`, one `hovered`): this registry only
ever holds *remote* peers. The local user's own selection is not represented
here - it stays in `SelectionManager`, and the two are only reconciled at
render time by [PeerSelectionOverlays](./PeerSelectionOverlays.md).

```ts
import { PeerSelectionRegistry } from "@jolly-pixel/three";

const registry = new PeerSelectionRegistry();

registry.select("peer-a", "box-1");
registry.select("peer-b", "box-1");

registry.selectorsOf("box-1");       // ["peer-a", "peer-b"], oldest first
registry.primarySelectorOf("box-1"); // "peer-a"
registry.colorOf("peer-a");          // deterministic, stable across calls

registry.select("peer-a", null);     // peer-a deselects
registry.primarySelectorOf("box-1"); // "peer-b" - promoted automatically
```

## PeerSelectionRegistryOptions

```ts
export interface PeerSelectionRegistryOptions {
  /**
   * @default a stateless hash-based allocator over a built-in 8-color palette
   */
  colorAllocator?: PeerColorAllocator;
}
```

## PeerColorAllocator

```ts
export interface PeerColorAllocator {
  /**
   * Deterministic-enough color for `peerId`, stable until `release()`.
   */
  colorOf(peerId: string): string;

  /**
   * Called when a peer disconnects (from `PeerSelectionRegistry.removePeer`).
   */
  release(peerId: string): void;
}
```

The registry's own color logic is just this interface - it ships no concrete
palette class. By default it uses a stateless hash of `peerId` over a
built-in 8-color list, so any two independently-created registries (e.g. one
per editor) resolve the same peer to the same color without coordinating with
each other, and zero configuration is required to get a working color per
peer.

A caller that wants collision-free colors (round-robin allocation, reclaimed
on `release`) instead of a hash - for example to keep a peer's color stable
and unique across every editor open in the same collaborative session -
injects its own `colorAllocator`. See
`examples/scripts/network/PeerColorPaletteAllocator.ts` for a round-robin
implementation built on the example's own `ColorPalette`.

## PeerSelectionChangeEventDetail

```ts
export interface PeerSelectionChangeEventDetail {
  peerId: string;
  objectId: string | null;
  previousObjectId: string | null;
}
```

## Methods

- `select(peerId: string, objectId: string | null): void` - Moves `peerId`'s selection to `objectId` (or clears it, for `null`), removing it from whatever object it previously selected. No-ops (and does not dispatch) if `objectId` already is `peerId`'s selection.
- `removePeer(peerId: string): void` - Clears `peerId`'s selection entirely, as if it selected `null`. Use this when a peer disconnects - also the single point where `colorAllocator.release(peerId)` is called.
- `selectionOf(peerId: string): string | null` - The object `peerId` currently has selected, or `null`.
- `selectorsOf(objectId: string): readonly string[]` - Every peer currently selecting `objectId`, oldest-first.
- `selectedObjectIds(): readonly string[]` - Every object id with at least one current selector, in no particular order. Lets a caller (e.g. `PeerColoredOutline`) enumerate every currently-selected object without tracking that set itself.
- `primarySelectorOf(objectId: string): string | null` - The peer that has selected `objectId` the longest, or `null` if none has. This is the peer whose color a single 3D overlay should use.
- `colorOf(peerId: string): string` - Deterministic color for `peerId`, stable across calls.
- `dispose(): void` - Forgets every peer and object. Does not dispatch `peerSelectionChange` for the state it clears, and does not call `colorAllocator.release` - disposing this registry is not the same as every peer disconnecting, especially when `colorAllocator` is shared across several editors' registries in the same session.

## Events

- `peerSelectionChange` - Dispatched as a `CustomEvent<PeerSelectionChangeEventDetail>` whenever `select()` actually changes a peer's selection. Carries `objectId`/`previousObjectId` directly in `detail` rather than following `SelectionManager`'s plain-`Event`-plus-getter convention: this registry holds state for every object, not just one, so a blind "something changed, re-read everything" event would force every consumer to re-render all registered objects on every peer move.

## Notes

- Tie-break rule for "primary" selector: insertion-order, oldest-selector-wins. If the primary peer deselects or moves to another object, the next-oldest remaining peer is promoted automatically - no extra bookkeeping needed on the caller's side.
- Colors come from the injected (or default) `PeerColorAllocator`, keyed by `peerId` - see above.
- See `examples/scripts/demo-selection.ts` (run `npm run dev`, open `/selection.html`) for a demo built on this class - the "Presence" pane folder drives 2-3 fake peers, and `refreshChips` renders `selectorsOf` as small colored chips in the outliner.
