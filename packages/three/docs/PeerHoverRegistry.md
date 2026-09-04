# PeerHoverRegistry

Tracks which remote peers currently hover which object, extending
`EventTarget` - the hover counterpart to
[PeerSelectionRegistry](./PeerSelectionRegistry.md), same shape and same
rationale for existing as its own class rather than folded into it (see that
class's own doc comment on why it's deliberately separate from
`SelectionManager`'s single-local-user state; this registry is deliberately
separate from `PeerSelectionRegistry` for the same reason, just for peers).
Purely bookkeeping - no `THREE` objects, no network types.

The local user's own hover is not represented here - it stays in
`SelectionManager`, and the two are only reconciled at render time by
[PeerHoverOverlays](./PeerHoverOverlays.md)/[PeerHighlightPass](./PeerHighlightPass.md).

```ts
import { PeerHoverRegistry } from "@jolly-pixel/three";

const registry = new PeerHoverRegistry();

registry.hover("peer-a", "box-1");
registry.hover("peer-b", "box-1");

registry.hoverersOf("box-1");       // ["peer-a", "peer-b"], oldest first
registry.primaryHovererOf("box-1"); // "peer-a"
registry.colorOf("peer-a");         // deterministic, stable across calls

registry.hover("peer-a", null);     // peer-a stops hovering
registry.primaryHovererOf("box-1"); // "peer-b" - promoted automatically
```

## PeerHoverRegistryOptions

```ts
export interface PeerHoverRegistryOptions {
  /**
   * @default a stateless hash-based allocator over a built-in 8-color palette
   */
  colorAllocator?: PeerColorAllocator;
}
```

Same [PeerColorAllocator](./PeerSelectionRegistry.md#peercolorallocator)
interface `PeerSelectionRegistry` uses. The default stateless hash-based
allocator resolves a given `peerId` to the same color regardless of which
registry asks, so a peer's hover ring reads in the same color as their
selection ring without either registry knowing about the other - as long as
neither is given a custom `colorAllocator`. A caller that injects its own
stateful allocator (e.g. a shared `ColorPalette`) into `PeerSelectionRegistry`
should pass that same instance here too, to keep a peer's selection and hover
in the same color (see `examples/scripts/demo-peer-selection-sync.ts`).

## PeerHoverChangeEventDetail

```ts
export interface PeerHoverChangeEventDetail {
  peerId: string;
  objectId: string | null;
  previousObjectId: string | null;
}
```

## Methods

- `hover(peerId: string, objectId: string | null): void` - Moves `peerId`'s hover to `objectId` (or clears it, for `null`), removing it from whatever object it previously hovered. No-ops (and does not dispatch) if `objectId` already is `peerId`'s hover.
- `removePeer(peerId: string): void` - Clears `peerId`'s hover entirely, as if it hovered `null`. Use this when a peer disconnects - also the single point where `colorAllocator.release(peerId)` is called.
- `hoverOf(peerId: string): string | null` - The object `peerId` currently hovers, or `null`.
- `hoverersOf(objectId: string): readonly string[]` - Every peer currently hovering `objectId`, oldest-first.
- `hoveredObjectIds(): readonly string[]` - Every object id with at least one current hoverer, in no particular order. Lets a caller (e.g. `PeerHighlightPass`, `PeerSelectionVisibility`) enumerate every currently-hovered object without tracking that set itself.
- `primaryHovererOf(objectId: string): string | null` - The peer that has hovered `objectId` the longest, or `null` if none has. This is the peer whose color a single 3D indicator should use.
- `colorOf(peerId: string): string` - Deterministic color for `peerId`, stable across calls.
- `dispose(): void` - Forgets every peer and object. Does not dispatch `peerHoverChange` for the state it clears, and does not call `colorAllocator.release`, same reasoning as `PeerSelectionRegistry.dispose`.

## Events

- `peerHoverChange` - Dispatched as a `CustomEvent<PeerHoverChangeEventDetail>` whenever `hover()` actually changes a peer's hover. Same carries-the-diff-in-`detail` convention as `PeerSelectionRegistry`'s own `peerSelectionChange`.

## Notes

- Tie-break rule for "primary" hoverer: insertion-order, oldest-hoverer-wins - same rule `PeerSelectionRegistry.primarySelectorOf` uses. If the primary peer stops hovering or moves to another object, the next-oldest remaining hoverer is promoted automatically.
- Colors come from the injected (or default) `PeerColorAllocator`, keyed by `peerId` - see above.
- See [PeerHoverOverlays](./PeerHoverOverlays.md) for the `"outline"`-technique renderer built on this registry, and [PeerHighlightPass](./PeerHighlightPass.md)'s own `hoverRegistry` option for the `"highlight"`/`"highlightJfa"` equivalent. See [PeerHoverSync](./network/PeerHoverSync.md) for the network glue that feeds a real registry from remote peers.
