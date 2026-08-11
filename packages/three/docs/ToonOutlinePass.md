# ToonOutlinePass

Scene-level selection outline built on [InstancedOutlineNode](./InstancedOutlineNode.md) -
this package's own fork of three's node-based, `THREE.WebGPURenderer`-only
`OutlineNode`, the successor to the classic `EffectComposer` `OutlinePass`
(that one is `WebGLRenderer`-only, so it's not an option here). Renders a
mask pass plus edge detection over the whole frame, rather than a mesh
decorated with its own overlay geometry like
[SelectionOutline](./SelectionOutline.md)/[SelectionHighlight](./SelectionHighlight.md).
That gives a flat "toon" outline look independent of the target's own
material/shading, and outlines a `THREE.Group` fully for free (every mesh
inside it, not a box approximation like
[SelectionBoundingBox](./SelectionBoundingBox.md)). A target can also be a
single instance of a `THREE.InstancedMesh` - see `ToonOutlineTarget` below
and [InstancedOutlineNode](./InstancedOutlineNode.md)'s own doc for why that
needs a fork rather than the vendored addon directly.

> [!NOTE]
> Uses TSL and requires `THREE.WebGPURenderer`. Also requires switching the render loop to this class's own `render()` in place of `renderer.render(scene, camera)` - see Usage below.

Deliberately outside [SelectionManager](./SelectionManager.md)'s own
per-object overlay model: that model disposes/rebuilds a small child per id,
which has no equivalent here since a postprocess outline is one pipeline
shared by the whole scene, driven by a selected/hovered object list rather
than owning per-id instances. Pass a `ToonOutlinePass` to `SelectionManager`'s
own `toonOutline` constructor option to wire it up as a real
`"toonOutline"` `MeshSelectionStyle` - the manager pushes into it directly
(`setSelected`/`setHovered`/shared tuning), no manual event wiring needed.

```ts
import * as THREE from "three/webgpu";
import { ToonOutlinePass, SelectionManager } from "@jolly-pixel/three";

const renderer = new THREE.WebGPURenderer({ canvas });
await renderer.init();

const toonOutline = new ToonOutlinePass(renderer, scene, camera, { color: "#ffffff" });

const selectionManager = new SelectionManager({ toonOutline, meshStyle: "toonOutline" });
selectionManager.register("mesh-1", mesh);
selectionManager.select("mesh-1"); // pushes `mesh` into toonOutline.setSelected

renderer.setAnimationLoop(() => {
  toonOutline.render(); // replaces renderer.render(scene, camera)
});

// ... later
toonOutline.dispose();
```

`setSelected`/`setHovered` are also usable directly, without a
`SelectionManager` at all:

```ts
const toonOutline = new ToonOutlinePass(renderer, scene, camera);
toonOutline.setSelected(mesh);
toonOutline.setHovered(otherMesh);
```

A target can also be a single instance of a `THREE.InstancedMesh`, mixed
freely with whole-object targets:

```ts
toonOutline.setSelected({ mesh: instancedMesh, instanceId: 42 });
toonOutline.setSelectedMany([
  wholeMesh,
  { mesh: instancedMesh, instanceId: 7 },
  { mesh: instancedMesh, instanceId: 9 }
]);
```

## ToonOutlinePassOptions

```ts
export interface ToonOutlinePassOptions {
  /**
   * @default "#ffffff"
   */
  color?: THREE.ColorRepresentation;
  /**
   * @default "#8ab4f8"
   */
  hoverColor?: THREE.ColorRepresentation;
  /**
   * Multiplies the hover outline's strength, the same role `opacity` plays
   * for `SelectionOutline`/`SelectionHighlight`'s own hover overlay.
   * @default 0.35
   */
  hoverOpacity?: number;
  /**
   * Color used for the portion of the outline occluded by other geometry -
   * shared by both the selected and hover outline (unlike `color`/
   * `hoverColor`, which stay distinct per role). Always computed and
   * composited; `xray` below only gates whether it contributes anything, not
   * which color it uses. Matches `OutlineNode`'s own visible/hidden edge
   * color split.
   * @default "#404040"
   */
  hiddenColor?: THREE.ColorRepresentation;
  /**
   * Detected-edge thickness, in downsampled pixels - forwarded straight to
   * `OutlineNode`'s own `edgeThickness` parameter. Adjustable at runtime via
   * `setEdgeThickness`.
   * @default 1
   */
  edgeThickness?: number;
  /**
   * Animated glow/pulse multiplier on the blurred outer ring - forwarded
   * straight to `OutlineNode`'s own `edgeGlow` parameter.
   * @default 0
   */
  edgeGlow?: number;
  /**
   * Resolution divisor the edge-detection/blur passes run at - forwarded
   * straight to `OutlineNode`'s own `downSampleRatio` parameter. Higher is
   * cheaper but blurs the outline more.
   * @default 2
   */
  downSampleRatio?: number;
  /**
   * Keeps the outline visible through occluding geometry (an X-ray look,
   * colored `hiddenColor`) instead of only along the target's actual
   * silhouette - the postprocess equivalent of
   * `SelectionOutline`/`SelectionHighlight`'s own `xray` option. Adjustable
   * at runtime via `setXray`.
   * @default false
   */
  xray?: boolean;
}
```

## ToonOutlineTarget

```ts
export type ToonOutlineTarget = SelectableObject | InstancedOutlineSelection;

export interface InstancedOutlineSelection {
  mesh: THREE.InstancedMesh;
  instanceId: number;
}
```

`setSelected`/`setSelectedMany`/`setHovered` accept either kind, and route
each to the right internal list automatically (`InstancedOutlineNode`'s own
`selectedObjects`/`selectedInstances` - see that class's own doc comment).

## Methods

- `render(): void` - Renders the scene through the outline pipeline. Call this instead of `renderer.render(scene, camera)` in the render loop.
- `get color(): THREE.Color` / `setColor(color: THREE.ColorRepresentation): void` - Reads/updates the "selected" outline color.
- `get hoverColor(): THREE.Color` / `setHoverColor(color: THREE.ColorRepresentation): void` - Reads/updates the "hover" outline color.
- `get hiddenColor(): THREE.Color` / `setHiddenColor(color: THREE.ColorRepresentation): void` - Reads/updates the occluded-portion color, shared by both the selected and hover outline.
- `get hoverOpacity(): number` / `setHoverOpacity(opacity: number): void` - Reads/updates the hover outline's strength multiplier.
- `get edgeThickness(): number` / `setEdgeThickness(edgeThickness: number): void` - Reads/updates the detected-edge thickness.
- `get xray(): boolean` / `setXray(xray: boolean): void` - Reads/toggles the X-ray look described on `xray` above. Cheap - only flips a uniform, no pipeline/material rebuild.
- `get selected(): ToonOutlineTarget | null` / `setSelected(target: ToonOutlineTarget | null): void` - Reads/sets the target outlined with the "selected" color. A group outlines every mesh inside it.
- `setSelectedMany(targets: ToonOutlineTarget[]): void` - Same as `setSelected`, for many simultaneous targets at once (all in the "selected" color) - `SelectionManager` never calls this itself (it only ever tracks one selected id), but it's usable directly for a caller managing its own multi-target selection. `selected` only ever reads back the first whole-object target, or the first instanced one if there was no whole-object target.
- `get hovered(): ToonOutlineTarget | null` / `setHovered(target: ToonOutlineTarget | null): void` - Same as `selected`, for the dimmer "hover" outline.
- `sync(manager: SelectionManager): void` - Mirrors `manager`'s selected/hovered ids onto `setSelected`/`setHovered` live, suppressing the hover outline while it matches the current selection. Only useful when *not* wiring this pass through `SelectionManager`'s own `toonOutline` option (see this class's own doc comment) - mixing both would double-apply the same target. Replaces any previous `sync` target.
- `unsync(): void` - Stops mirroring the manager passed to `sync`, if any. Leaves the pass's current selected/hovered objects in place.
- `dispose(): void` - Unsyncs (if synced) and frees the GPU resources owned by the outline pipeline (render targets, materials).

## Notes

- `pipeline: THREE.RenderPipeline` is exposed read-only - reach into it directly (e.g. to compose it with further postprocess effects) if `render()`'s default behavior isn't enough.
- Two independent `InstancedOutlineNode` passes back this class, one per outline color (selected/hover) - each is a full mask + edge-detection pass, so this costs roughly twice a single `OutlinePass`-style effect. `SelectionManager` only ever tracks one selected and one hovered id at a time, so this stays bounded regardless of scene size; calling `setSelectedMany` directly with many targets shifts that bound onto the caller (the mask pass re-renders every given target every frame).
- `xray` gates the *hidden*-edge contribution of both passes uniformly (`InstancedOutlineNode` computes visible-edge and hidden-edge masks separately), colored `hiddenColor` - `false` shows only the true silhouette-adjacent edge (`color`/`hoverColor`), `true` also shows the edge where the outlined object is occluded, in `hiddenColor`.
- Not usable for peer-presence overlays as-is: it's one shared pipeline, not a per-id instance, so it can't represent more than one simultaneously colored selection the way [PeerSelectionOverlays](./PeerSelectionOverlays.md) needs. When wired as `SelectionManager`'s `"toonOutline"` style, a peer selection falls back to `"outline"` automatically - see that class's own Notes.
- `setSelected`/`setHovered` outline whatever `Object3D` they're given directly, group included - used raw (not through `SelectionManager`), that's a real way to outline every mesh inside a group at once. Wired as `SelectionManager`'s `"toonOutline"` style, that's deliberately not used for a non-mesh id: `SelectionManager` always keeps a group's indicator as `SelectionBoundingBox` regardless of style, so switching styles never changes how a group itself reads - only meshes are affected.
- **Instanced targets** (`{ mesh, instanceId }`): `SelectionManager` has no notion of these - `sync()` only ever mirrors whole-object selections, so an instanced target only ever reaches this class via a direct `setSelected`/`setSelectedMany`/`setHovered` call, the same bypass shape a caller already uses for a multi-target selection outside `SelectionManager`. Cost-wise, an `InstancedMesh` with any of its instances selected/hovered still only costs the same two passes described above - `InstancedOutlineNode` masks the specific instances via a per-instance GPU attribute rather than adding a pass per instance.
- See `examples/scripts/demo-selection.ts` (run `npm run dev`, open `/selection.html`) - "toon outline (postprocess)" in the "mesh style" dropdown switches to this technique live, alongside "outline"/"highlight". See `examples/scripts/demo-stress.ts` (open `/stress.html`) for the instanced-target case - the entire stress grid is one `THREE.InstancedMesh`.
