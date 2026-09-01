# AreaBox

`AreaBox` is a translucent, axis-aligned grid volume for spawn zones, triggers or patrol regions. It extends `THREE.Object3D` and renders a fill, twelve-edge outline and optional nameplate.

```ts
import { AreaBox } from "@jolly-pixel/three";

const area = new AreaBox({
  position: { x: 4, y: 0, z: -2 },
  size: { x: 6, y: 1, z: 3 },
  color: "#4da3ff",
  displayName: "Spawn"
});

scene.add(area);
```

`position` is the **min corner**. Integer `position` and `size` values stay grid-aligned without half-cell offsets. Use [`AreaBoxControls`](./AreaBoxControls.md) for pointer movement and resizing.

`size` lays out the unrotated box without changing its `scale`. Rendering requires `THREE.WebGPURenderer`.

## Constructor

```ts
new AreaBox(options?: AreaBoxOptions)
```

```ts
interface AreaBoxEdgesDefaults {
  show: boolean;
  width: number;
  opacity: number;
}

interface AreaBoxOptions {
  size?: Vector3Like;
  position?: Vector3Like;
  color?: THREE.ColorRepresentation;
  opacity?: number;
  edges?: Partial<AreaBoxEdgesDefaults>;
  shadeFaces?: boolean;
  displayName?: string;
}
```

`AreaBox.Defaults` stores the shared appearance defaults. Mutations affect new instances process-wide. `size` and `position` still default to a unit cube at the origin. `displayName` remains unset.

| Option | Default | Description |
|---|---:|---|
| `size` | `{ x: 1, y: 1, z: 1 }` | Extent in world units. Each axis is clamped to a strictly positive value. |
| `position` | `{ x: 0, y: 0, z: 0 }` | Min corner, in parent space. |
| `color` | `"#4da3ff"` | Area color. The edges use it as-is; the fill uses a smoked version of it. The label stays white for legibility. |
| `opacity` | `0.75` | Fill opacity in the `"idle"` state. |
| `edges.show` | `true` | Draws the twelve box edges on top of the fill. |
| `edges.width` | `2` | Outline width in CSS pixels, constant at any camera distance. |
| `edges.opacity` | `1` | Edge opacity in the `"idle"` state. |
| `shadeFaces` | `true` | Bakes a per-face brightness into the fill so its faces stay distinguishable. |
| `displayName` | none | Creates a nameplate above the top face when provided. |

The appearance options are constructor-only. Use `fill.material`, `edges.material` or `label` for later visual changes.

## Properties

### `size`

```ts
get size(): THREE.Vector3
set size(size: Vector3Like)
```

World-unit extent. The getter returns a **copy**. Assign to `size` to resize and lay out all rendered children.

### `min`

```ts
get min(): THREE.Vector3
```

Alias of `position`. Mutate it directly to move the area.

### `fill`

```ts
readonly fill: AreaBoxFill
```

Raycast the translucent volume to hit-test the area:

```ts
const hits = raycaster.intersectObjects(areas.map((area) => area.fill), false);
```

See [`AreaBoxFill`](#areaboxfill) for its material and shading.

The fill and edges use `renderOrder` values 1 and 2 so a camera-following transparent grid draws first. Give other transparent backdrops a render order below 1.

### `edges`

```ts
readonly edges: AreaBoxEdges | null
```

The outline is `null` when `edges.show` is `false`. At shallow angles it separates overlapping faces from the grid. See [`AreaBoxEdges`](#areaboxedges).

### `label`

```ts
label: AreaBoxLabel | null
```

Nameplate created from `displayName`, centered above the top face. `null` until a name is provided.

### `color`

```ts
get color(): THREE.Color
set color(color: THREE.ColorRepresentation)
```

Area color. The getter returns a **copy** of the fill color. Assigning repaints the fill and the edges in place, keeping the emphasis of the current `state`. No geometry or material is reallocated and nothing is disposed, so an attached area can be recolored while it is on screen. The label is left white for legibility.

### `state`

```ts
get state(): AreaBoxState
set state(state: AreaBoxState)
```

Current emphasis level, one of `"idle" | "hovered" | "active"`. Assigning raises opacity, clears smoke toward the area color and tints edges toward white. `AreaBoxControls` assigns `"active"` on attach and `"idle"` on detach. Applications may assign `"hovered"` from their own picking.

## Methods

### `copySizeTo()`

```ts
copySizeTo(target?: THREE.Vector3): THREE.Vector3
```

Writes the extent into `target` without allocating the `size` copy.

### `toBox3()` / `fromBox3()`

```ts
toBox3(target?: THREE.Box3): THREE.Box3
fromBox3(box: THREE.Box3): void
```

`toBox3()` writes parent-space bounds. `fromBox3()` copies `box.min` and derives a positively clamped extent from `box.max`.

### `dispose()`

```ts
dispose(): void
```

Delegates to `fill.dispose()`, `edges?.dispose()` and `label?.dispose()`. It leaves the scene graph and foreign children, including controls-owned resize arrows, untouched.

Idempotent: later calls are ignored, on `AreaBox` and on each of its parts. Freeing an already freed GPU resource faults the renderer backend, and a subtree walker such as `disposeObject3D` may reach a part after its owner disposed it.

## AreaBoxFill

```ts
class AreaBoxFill extends THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>
new AreaBoxFill(options: AreaBoxFillOptions)

interface AreaBoxFillOptions {
  color: THREE.ColorRepresentation;
  opacity: number;
  shadeFaces: boolean;
}
```

The translucent volume, and the object to raycast. Every option is required: `AreaBox` resolves its own defaults before constructing it.

The material mixes `color` 45% toward `#080b11`, so blending it over the scene darkens what shows through instead of washing it out. `shadeFaces` bakes a per-face brightness into a `color` vertex attribute, in the `+X, -X, +Y, -Y, +Z, -Z` group order of `THREE.BoxGeometry`; the attribute is absent when disabled.

The transparent `FrontSide` material **writes depth**, so its near face hides the far face. Existing framebuffer content remains visible at `1 - opacity`. A camera inside the area sees through it: set `material.side` to `THREE.DoubleSide` when an interior view is needed.

| Method | Description |
|---|---|
| `resize(size: Vector3Like)` | Scales the unit box and re-centers it on the min-corner anchor. |
| `emphasize(opacity: number, tint: number)` | Scales the constructor `opacity` by `opacity`, clamped to `1`, and clears the smoke toward the area color by `tint` (0 to 1). |
| `get/set color` | Reads a copy of the area color, or repaints the material in place and re-applies the last `emphasize()` arguments. |
| `dispose()` | Releases the geometry and the material, once. |

## AreaBoxEdges

```ts
class AreaBoxEdges extends LineSegments2
new AreaBoxEdges(options: AreaBoxEdgesOptions)

interface AreaBoxEdgesOptions {
  color: THREE.ColorRepresentation;
  width: number;
  opacity: number;
}
```

The twelve-segment outline, drawn with `Line2NodeMaterial` fat lines: line width is capped at one pixel on both renderers, so a plain `THREE.LineSegments` cannot draw a thicker rim. `width` is in CSS pixels and stays constant at any camera distance.

It keeps the area color as-is, and opts out of frustum culling because fat lines expand beyond the source segments the frustum test reads.

`material.transparent` follows the effective opacity rather than staying on: `Line2NodeMaterial` sets `NoBlending` and, while transparent, composites in the shader against a full-screen copy of the opaque pass. Three resizes that copy from inside the render pass, so a canvas resize faults the WebGPU queue with a texture the pass being encoded still references. At an effective opacity of `1` the copy buys nothing, so the material stays opaque and the pass never runs.

| Method | Description |
|---|---|
| `resize(size: Vector3Like)` | Rebuilds the segments so they trace the box instead of stretching with it, then recomputes the geometry bounds. A resize to the size already traced is dropped: a rebuild swaps in fresh instanced buffers, and destroying the previous ones mid-frame faults the WebGPU queue with a buffer the pass being encoded still references. |
| `emphasize(opacity: number, tint: number)` | Scales the constructor `opacity` by `opacity`, clamped to `1`, and tints the color toward white by `tint * 0.4`. Toggles `material.transparent` when the result crosses full opacity. |
| `get/set color` | Reads a copy of the edge color, or repaints the material in place and re-applies the last `emphasize()` arguments. |
| `dispose()` | Releases the geometry and the material, once. |

## AreaBoxLabel

```ts
class AreaBoxLabel extends THREE.Sprite
new AreaBoxLabel(options: AreaBoxLabelOptions)

interface AreaBoxLabelOptions {
  displayName: string;
  color?: THREE.ColorRepresentation;
}
```

`AreaBoxLabel` is a canvas-textured `THREE.Sprite` requiring `displayName`. `color` defaults to `"#ffffff"` independently of the area color. Changing either property redraws the texture. `AreaBox` positions labels it creates, and `dispose()` releases the texture and material.
