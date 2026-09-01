# PeerSelectionVisibility

Tracks, per currently peer-selected object, whether it's actually worth rendering a peer indicator for -
inside the camera frustum and within an optional max distance. [PeerSelectionOverlays](./PeerSelectionOverlays.md)
and [PeerHighlightPass](./PeerHighlightPass.md) each accept this as an optional `visibility` option
and treat a "not visible" id the same as "not selected" - so a collaborative scene with many simultaneous
peer selections only pays overlay-construction/entries-rebuild cost for the ones actually worth showing, not
every peer selection that exists anywhere in the scene. Omitting `visibility` entirely on either class
preserves today's always-visible behavior - fully opt-in.

Deliberately never consulted for the *local* user's own selection/hover - only [PeerSelectionRegistry](./PeerSelectionRegistry.md)'s
peer selections. Camera-relative culling only makes sense for someone else's selection; hiding what the local
user just clicked because they panned the camera away from it would read as a bug, not an optimization.

```ts
import { SelectionManager, PeerSelectionRegistry, PeerSelectionVisibility, PeerHighlightPass, HighlightPass } from "@jolly-pixel/three";

const selection = new SelectionManager();
const registry = new PeerSelectionRegistry();
const highlight = new HighlightPass(renderer, scene, camera);

const visibility = new PeerSelectionVisibility({ registry, selection, camera, maxDistance: 40 });
const peerHighlight = new PeerHighlightPass({ registry, selection, highlight, visibility });

renderer.setAnimationLoop(() => {
  controls.update();
  visibility.update(); // once per render tick - camera motion isn't event-driven
  highlight.render();
});
```

## PeerSelectionVisibilityOptions

```ts
export interface PeerSelectionVisibilityOptions {
  registry: PeerSelectionRegistry;
  selection: SelectionManager;
  camera: THREE.Camera;
  /**
   * World-space distance (from the camera, minus the target's own bounding
   * radius) beyond which a peer-selected object is treated as not visible,
   * regardless of whether it's actually inside the frustum.
   * @default Infinity - no distance cutoff, frustum test only
   */
  maxDistance?: number;
}
```

## Methods

- `update(): void` - Recomputes visibility for every currently peer-selected object (`registry.selectedObjectIds()`) - cheap, O(peer-selected object count), not scene size. Must be called once per render tick (e.g. from the same callback that already drives `OrbitControls.update()`) - camera motion is independent of any selection-change event, so this can't be event-driven the way the rest of the peer layer is. Dispatches `visibilityChange` only when at least one id's visibility actually changed since the previous call.
- `isVisible(objectId: string): boolean` - Whether `objectId` was found visible on the last `update()` call. Defaults `true` for an id `update()` hasn't evaluated yet (fail open) - in particular, an object that was *just* peer-selected reads as visible until the next `update()` tick actually evaluates it, a one-frame transient rather than a bug.
- `setCamera(camera: THREE.Camera): void` - Swaps which camera subsequent `update()` calls test against.
- `setMaxDistance(maxDistance: number): void` - Updates the distance cutoff applied on the next `update()` call.
- `dispose(): void` - Clears tracked visibility state.

## Events

- `visibilityChange` - Dispatched (as a plain `Event`, no `detail`) from `update()` when at least one tracked id's visibility actually flipped. `PeerSelectionOverlays`/`PeerHighlightPass` each subscribe to this once, in their own constructor, the same way they already subscribe to `registry`'s `peerSelectionChange` and `selection`'s `selectionChange` - a caller just needs to call `update()` every frame; everything downstream re-syncs itself via this event.

## Notes

- World bounds per object come from `new THREE.Box3().setFromObject(target)` (three's own built-in world-AABB traversal), then `.getBoundingSphere()` - recomputed fresh on every `update()` call for every currently peer-selected id, deliberately not cached across ticks, since a selected object (an orbiting peer selection, say) can move. Only scratch `Box3`/`Sphere`/`Frustum`/`Matrix4` instances are cached, to avoid per-tick GC churn.
- An id no longer peer-selected is silently dropped from the tracked set on the next `update()` - this does not count as a "flip" for `visibilityChange` purposes, since nothing was rendering it anyway.
- See `examples/scripts/selection-peer.ts` (run `npm run dev`, open `/selection-peer.html`) - the "Peer rendering" pane folder's "max distance" field drives this directly; orbiting the camera away from a peer selection demonstrates the (always-on, no control needed) frustum half on its own.
