# Peer selection and hover

The peer layer keeps remote state separate from the local
[`SelectionManager`](./index.md). It does not require a network library. Feed
the registries from a test, another transport, or the optional
`@jolly-pixel/three/network` entry point.

Every client must register the same object ids before remote state can render.

## Registries

```ts
import {
  PeerHoverRegistry,
  PeerSelectionRegistry
} from "@jolly-pixel/three";

const selections = new PeerSelectionRegistry();
const hovers = new PeerHoverRegistry();

selections.select("peer-a", "crate");
hovers.hover("peer-b", "crate");

selections.selectorsOf("crate");       // ["peer-a"]
selections.primarySelectorOf("crate"); // "peer-a"
selections.colorOf("peer-a");          // stable color for this peer id
```

Each peer has at most one selected id and one hovered id. Pass `null` to clear
it, or call `removePeer(peerId)` when the peer disconnects. If several peers
point at one object, the oldest active peer is primary.

| Selection registry | Hover registry | Result |
|---|---|---|
| `select(peerId, id)` | `hover(peerId, id)` | Set or clear remote state |
| `selectionOf(peerId)` | `hoverOf(peerId)` | Current id for one peer |
| `selectorsOf(id)` | `hoverersOf(id)` | Peers for one object, oldest first |
| `selectedObjectIds()` | `hoveredObjectIds()` | Objects with remote state |
| `primarySelectorOf(id)` | `primaryHovererOf(id)` | Oldest active peer |
| `colorOf(peerId)` | `colorOf(peerId)` | Assigned peer color |
| `dispose()` | `dispose()` | Clear registry state |

Changes dispatch `peerSelectionChange` or `peerHoverChange`. Both events are
`CustomEvent` objects with this detail:

```ts
{
  peerId: string;
  objectId: string | null;
  previousObjectId: string | null;
}
```

The default allocator hashes peer ids across eight colors. Supply the same
custom `PeerColorAllocator` to both registries when selection and hover must
share a stateful palette:

```ts
interface PeerColorAllocator {
  colorOf(peerId: string): string;
  release(peerId: string): void;
}
```

`removePeer()` calls `release()`. `dispose()` only clears the registry.

## Draw peer indicators

`SelectionSystem` creates the registries and renders their state with the same
priority rules as local selection:

```ts
import {
  SelectionSystem
} from "@jolly-pixel/three";

const selection = new SelectionSystem({
  renderer,
  scene,
  camera,
  chips: true
});
selection.register("crate", crateMesh);

selection.peerSelections.select("peer-a", "crate");
selection.peerHovers.hover("peer-b", "crate");

renderer.setAnimationLoop(() => {
  selection.update();
  selection.render();
});
```

The resolver emits one indicator per object. Local selection has priority,
followed by peer selection, local hover, and peer hover. The oldest peer wins
when several peers have the same state on one object.

### Low-level adapters

For a custom composition, create `PeerSelectionOverlays` and
`PeerHoverOverlays` around a `SelectionManager` and the registries. Both
adapters react to selection, registration, technique, and appearance changes.

`PeerSelectionOverlays` draws one full-strength overlay per selected object.
`PeerHoverOverlays` draws one faded overlay per hovered object at opacity
`0.35` by default; mesh outlines are dashed. Local state has priority, and any
selection suppresses a hover on the same object. With a postprocess technique,
these classes fall back to object outlines.

Both classes expose `refreshAll()` for an explicit resynchronization and
`dispose()` for cleanup.

For colored postprocess rings, use `PeerHighlightPass` instead of the two
object-overlay renderers. Set the matching manager technique first:

```ts
selection.technique = "highlight";

const highlight = new HighlightPass(renderer, scene, camera);
const peerHighlight = new PeerHighlightPass({
  registry,
  hoverRegistry,
  selection,
  highlight
});
```

It includes local selection and hover even when no remote peers exist. Local
selection wins overlaps. The class exposes `refresh()` and `dispose()`; it
does not dispose `highlight`. See [selection rendering](./rendering.md) for
`HighlightPass` and `HighlightPassJfa`.

## Cull remote indicators

`PeerSelectionVisibility` culls remote indicators outside the camera frustum
or beyond `maxDistance`. Local selection and hover are never culled.

```ts
const visibility = new PeerSelectionVisibility({
  registry,
  hoverRegistry,
  selection,
  camera,
  maxDistance: 40
});

const peerHighlight = new PeerHighlightPass({
  registry,
  hoverRegistry,
  selection,
  highlight,
  visibility
});

renderer.setAnimationLoop(() => {
  visibility.update();
  highlight.render();
});
```

`maxDistance` defaults to `Infinity`, leaving frustum culling enabled. `camera`
and `maxDistance` are writable properties. The API also provides
`isVisible(id)`, `update()`, and `dispose()`. `update()` dispatches
`visibilityChange` when a result changes.

Pass the same visibility instance to `PeerSelectionOverlays`,
`PeerHoverOverlays`, or `PeerSelectionChips` as needed.

## Show multiple selectors

The primary ring shows one peer color. `PeerSelectionChips` can add billboard
chips above objects selected by several peers:

```ts
const chips = new PeerSelectionChips({
  registry,
  selection,
  visibility,
  enabled: true
});
```

Chips are disabled by default. The component shows up to three peer colors,
then adds a `+N` badge. `enabled` is writable; call `dispose()` for cleanup.

## Network transport

The registries accept any transport. For the optional
`@jolly-pixel/network` adapters, see [network selection sync](../network/selection.md).

## Exported types

| Area | Types |
|---|---|
| Selection registry | `PeerSelectionRegistryOptions`, `PeerSelectionChangeEventDetail`, `PeerSelectionRegistryEventMap` |
| Hover registry | `PeerHoverRegistryOptions`, `PeerHoverChangeEventDetail`, `PeerHoverRegistryEventMap` |
| Object renderers | `PeerSelectionOverlaysOptions`, `PeerHoverOverlaysOptions` |
| Postprocess adapter | `PeerHighlightPassOptions`, `HighlightTarget` |
| Visibility and chips | `PeerSelectionVisibilityOptions`, `PeerSelectionChipsOptions` |
