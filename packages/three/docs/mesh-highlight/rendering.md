# Highlight rendering

Start with `MeshHighlight`'s default `"outline"` mode. Switch to a
postprocess mode when the scene needs many simultaneous colors. Use the
low-level passes directly for individual `InstancedMesh` instances.

## Object overlays

`MeshHighlight` creates these automatically in `"outline"` mode. They are
also exported for standalone use.

### HighlightOutline

Draws the edges of one mesh without changing its material. The outline is
attached to `target`.

```ts
const outline = new HighlightOutline({
  target: mesh,
  color: "#ffffff",
  xray: true
});

outline.color = "#ffcc00";
outline.dispose();
```

Options are `target`, `color` (`"#ffffff"`), `opacity` (`1`), `linewidth`
(`1` CSS pixel), `xray` (`false`), and `dashed` (`false`). `color`, `opacity`,
`linewidth`, and `xray` are writable properties. Call `dispose()` to detach
the outline and release its resources.

The geometry is built once. Recreate the outline after replacing or editing
the target geometry.

### HighlightBoundingBox

Draws the local bounds of a target's mesh descendants. It works with groups
and meshes.

```ts
const box = new HighlightBoundingBox({
  target: group,
  color: "#ffffff",
  fillOpacity: 0.08
});

box.update();
box.dispose();
```

Options are `target`, `color` (`"#ffffff"`), `opacity` (`1`), `xray`
(`false`), and `fillOpacity` (`0`). Call `update()` after descendant transforms
or geometry changes. `color`, `opacity`, `fillOpacity`, and `xray` are writable
properties. Call `dispose()` when finished.

### MergedHighlightOverlay

Use `MergedHighlightOverlay` for a bulk selection that is outside
`MeshHighlightState`'s single-selection model. It bakes several mesh outlines
into one world-space `THREE.LineSegments` draw call.

```ts
const overlay = new MergedHighlightOverlay({
  parent: scene,
  targets: selectedMeshes,
  color: "#ffffff"
});
```

`targets` must contain at least one mesh. Optional fields are `opacity`,
`linewidth`, and `xray`. The read-only `object` property contains the created
line object. Call `dispose()` and construct a new overlay when the target list
or any target transform changes.

## Postprocess highlights

`HighlightPass` and `HighlightPassJfa` accept the same `HighlightEntry[]` and
render through `THREE.WebGPURenderer`. Each owns a whole-frame
`THREE.RenderPipeline`, so call its `render()` method instead of
`renderer.render(scene, camera)`.

```ts
import * as THREE from "three/webgpu";
import { HighlightPass } from "@jolly-pixel/three";

const renderer = new THREE.WebGPURenderer({ canvas });
await renderer.init();

const highlight = new HighlightPass(renderer, scene, camera);
highlight.entries = [
  { target: mesh, color: "#ff6644", priority: true },
  { target: group, color: "#44aaff" },
  { target: instances, instanceId: 12, color: "#ffcc00" }
];

renderer.setAnimationLoop(() => highlight.render());
```

Assigning `entries` replaces the complete list. A group entry includes all mesh
descendants. Set `instanceId` to target one `InstancedMesh` instance.

| Entry field | Purpose |
|---|---|
| `target` | Mesh, group, or `InstancedMesh` |
| `color` | Outline color |
| `priority` | Draw this entry over overlapping shared entries |
| `isolated` | Give a whole-object entry an independent ring, useful for hover |
| `instanceId` | Select one instance; unavailable with `isolated` |

Avoid pure black entry colors. The mask uses RGB intensity to distinguish an
entry from the background.

### Choose a pass

| | `HighlightPass` | `HighlightPassJfa` |
|---|---|---|
| Ring | Downsampled edge detection and blur | Jump Flood distance field |
| Best for | Lower fixed pass count and optional glow | Stable screen-pixel width |
| Options | `edgeThickness: 1`, `edgeGlow: 0`, `downSampleRatio: 2` | `ringThickness: 2`, `borderThickness: 1`, `isolatedFillOpacity: 0.15` |

Both expose `pipeline`, writable `entries`, `render()`, and `dispose()`.

`HighlightPass` exposes writable `edgeThickness` and `edgeGlow` properties.
`HighlightPassJfa` exposes writable `ringThickness`, `borderThickness`, and
`isolatedFillOpacity` properties.

Both passes draw rings without scene occlusion. `MeshHighlightAppearance.xray`
only affects object overlays.

## Use postprocess with MeshHighlight

`MeshHighlight` owns the pass and keeps local and peer state synchronized.

```ts
import {
  MeshHighlight
} from "@jolly-pixel/three";

const highlight = new MeshHighlight({
  renderer,
  scene,
  camera,
  mode: "highlight"
});
highlight.register("crate", crateMesh);
highlight.select("crate");
renderer.setAnimationLoop(() => highlight.render());
```

The lower-level `PeerHighlightPass` remains available for custom compositions.
It adapts a `MeshHighlightState` and peer registries to a pass supplied by the
caller. Disposing the adapter clears its entries but does not dispose the pass.
See [peer selection and hover](./peers.md).

## Custom object techniques

An overlay factory implements `HighlightOverlayFactory`. Register it on the
state's `overlayRegistry`, then use its id as a technique.

```ts
import * as THREE from "three";
import {
  HighlightOutline,
  type HighlightOverlayFactory
} from "@jolly-pixel/three";

const factory: HighlightOverlayFactory = {
  id: "dashed-outline",
  supports: (target) => target instanceof THREE.Mesh,
  create: (target, options) => new HighlightOutline({
    target: target as THREE.Mesh,
    ...options,
    dashed: true
  })
};

state.overlayRegistry.register(factory);
state.register("crate", crateMesh, { technique: "dashed-outline" });
```

A custom overlay must implement:

```ts
interface HighlightOverlay {
  color: THREE.ColorRepresentation;
  opacity: number;
  xray: boolean;
  fillOpacity?: number;
  linewidth?: number;
  update?(): void;
  dispose(): void;
}
```

For full control, construct `HighlightOverlayRegistry` with `defaultId` and
`fallbackId`, register the required factories, and pass it to
`MeshHighlightState`. `resolve(id, target)` tries the requested factory, the
default, then the fallback. `create(target, options)` resolves and constructs
the overlay.

## Exported types

| Area | Types |
|---|---|
| Facade | `MeshHighlightOptions`, `MeshHighlightMode`, `MeshHighlightEventMap` |
| Appearance | `MeshHighlightAppearanceOptions` and the renderer-specific appearance option types |
| Resolution | `ResolvedHighlightIndicator`, `HighlightResolverOptions` |
| Renderer strategies | `MeshHighlightRenderer`, `MeshHighlightRendererFactory`, `MeshHighlightRendererContext` |
| Overlay contract | `HighlightOverlay`, `HighlightOverlayFactory`, `HighlightOverlayCreateOptions` |
| Overlay registry | `HighlightOverlayRegistryOptions`, `CreateHighlightOverlayOptions` |
| Built-in overlays | `HighlightOutlineOptions`, `HighlightBoundingBoxOptions`, `MergedHighlightOverlayOptions` |
| Postprocess | `HighlightEntry`, `HighlightPassOptions`, `HighlightPassJfaOptions` |
| Peer adapter | `HighlightTarget`, `PeerHighlightPassOptions` |

`HighlightTarget` is the writable `entries` part of `HighlightPass`, which lets
the adapter work with either built-in pass or a compatible wrapper.
