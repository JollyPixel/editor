# Peer selection and hover

`PeerHighlights` holds what remote peers select and hover, separate from the
local state of [`MeshHighlight`](./index.md). It does not require a network
library. Feed it from a test, another transport, or the optional
`@jolly-pixel/three/network` entry point.

Every client must register the same object ids before remote state can render.

## PeerHighlights

```ts
import { PeerHighlights } from "@jolly-pixel/three";

const peers = new PeerHighlights();

peers.select("peer-a", "crate");
peers.hover("peer-b", "crate");

peers.selectors("crate");    // ["peer-a"]
peers.peerColor("peer-a");   // stable color for this peer id
```

Each peer has at most one selected id and one hovered id. Pass `null` to clear
one of them. When several peers mark one object, the earliest one comes first.

```ts
class PeerHighlights extends EventTarget {
  constructor(options?: { colorAllocator?: PeerColorAllocator });

  select(peerId: string, objectId: string | null): void;
  hover(peerId: string, objectId: string | null): void;
  mark(
    role: HighlightIndicatorRole,
    peerId: string,
    objectId: string | null
  ): void;
  removePeer(peerId: string): void;

  selectedObject(peerId: string): string | null;
  hoveredObject(peerId: string): string | null;
  selectors(objectId: string): readonly string[];
  hoverers(objectId: string): readonly string[];
  selectedObjectIds(): readonly string[];
  hoveredObjectIds(): readonly string[];
  peerColor(peerId: string): string;

  dispose(): void;
}
```

### mark(role, peerId, objectId): void

Sets the peer's `"selection"` or `"hover"` mark. `select()` and `hover()` call
it with their role.

### removePeer(peerId): void

Clears the peer's selection and hover, then releases its color once.

### dispose(): void

Clears every mark without releasing colors.

### Events

Every change dispatches a `change` `CustomEvent`. A repeated value dispatches
nothing.

```ts
interface PeerHighlightChangeEventDetail {
  peerId: string;
  role: "selection" | "hover";
  objectId: string | null;
  previousObjectId: string | null;
}
```

### Color allocator

The default allocator, exported as `createDefaultColorAllocator()`, hashes peer
ids across eight colors and never releases. Supply your own to share a palette
with the rest of the application:

```ts
interface PeerColorAllocator {
  peerColor(peerId: string): string;
  release(peerId: string): void;
}
```

## Draw peer indicators

`MeshHighlight` creates a `PeerHighlights` as `highlight.peers` and renders it
with the same priority rules as local state:

```ts
import { MeshHighlight } from "@jolly-pixel/three";

const highlight = new MeshHighlight({
  renderer,
  scene,
  camera,
  chips: true
});
highlight.register("crate", crateMesh);

highlight.peers.select("peer-a", "crate");
highlight.peers.hover("peer-b", "crate");

renderer.setAnimationLoop(() => {
  highlight.update();
  highlight.render();
});
```

The resolver emits one indicator per object, in this priority order:

1. Local selection.
2. Peer selection, colored after the earliest selector.
3. Local hover or emphasis.
4. Peer hover, colored after the earliest hoverer.

Every mode applies the same order.

## Cull remote indicators

`highlight.visibility` drops peer indicators outside the camera frustum or
beyond `maxDistance`. Local selection and hover are never culled. `update()`
re-evaluates it; call it once per frame.

```ts
highlight.visibility!.maxDistance = 40;
highlight.visibility!.camera = otherCamera;
```

`maxDistance` defaults to `Infinity`, leaving frustum culling enabled. Pass
`visibility: false` to the constructor to disable culling; the property is then
`null`.

## Show multiple selectors

An indicator shows one peer color. `highlight.chips` adds billboard chips above
an object selected by several peers: up to three peer colors, then a `+N`
badge. Chips are off unless `chips: true` is passed; `enabled` is writable.

```ts
highlight.chips.enabled = true;
```

Culled objects show no chips.

## Network transport

`PeerHighlights` accepts any transport. For the optional `@jolly-pixel/network`
adapter, see [network selection sync](../network/selection.md).
