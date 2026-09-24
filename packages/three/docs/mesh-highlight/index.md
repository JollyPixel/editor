# Mesh Highlight

`MeshHighlight` is the main API for drawing local and remote selection. It
owns the state store, peer registries, visibility culling, optional peer
chips, and the active renderer. Picking stays in the application.

```ts
import { MeshHighlight } from "@jolly-pixel/three";

const highlight = new MeshHighlight({
  renderer,
  scene,
  camera,
  mode: "outline",
  appearance: {
    selected: { color: "#ffffff" },
    hovered: { color: "#8ab4f8", opacity: 0.35 },
    xray: true
  },
  chips: true
});

highlight.register("crate", crateMesh);
highlight.register("building", buildingGroup);

highlight.hover("crate");
highlight.select("crate");

renderer.setAnimationLoop(() => {
  highlight.update();
  highlight.render();
});
```

Pass `null` to `select()` or `hover()` to clear that state. Passing an unknown
id throws without changing the current state.

## Connect picking and UI

Use the same ids in the scene, outliner, and network layer. A raycast handler
only translates the hit object to an id:

```ts
const hit = raycaster.intersectObjects(selectableMeshes)[0];
highlight.hover(hit ? meshToId.get(hit.object) ?? null : null);
```

State and configuration events are forwarded:

```ts
highlight.addEventListener("selectionChange", () => {
  console.log("selected", highlight.selected);
});

highlight.addEventListener("change", ({ detail }) => {
  console.log(detail.kind, detail.objectIds);
});
```

`selectionChange` and `hoverChange` are plain events. The unified `change`
event and the `targetsChange`, `appearanceChange`, `techniqueChange`,
`peerChange`, and `visibilityChange` events include `{ kind, objectIds }` in
`detail`.

## Change rendering and appearance

Switching `mode` replaces the renderer while preserving local state, remote
state, registrations, and per-object technique overrides:

```ts
highlight.mode = "highlightJfa";

highlight.configure({
  selected: { color: "#ffcc00" },
  outline: { linewidth: 2 },
  highlightJfa: { ringThickness: 4 },
  xray: false
});
```

The current configuration is an immutable `MeshHighlightAppearance`. Its
`with()` method creates a derived value without mutating the original:

```ts
const compact = highlight.appearance.with({
  hovered: { opacity: 0.2 }
});

highlight.appearance = compact;
```

Use `highlight.configure()` for a partial update or assign a complete
`MeshHighlightAppearance`. Both rebuild the active renderer with the new value.

| Appearance field | Default | Purpose |
|---|---:|---|
| `selected.color` | `"#ffffff"` | Local selection color |
| `selected.opacity` | `1` | Local object-overlay opacity |
| `hovered.color` | `"#8ab4f8"` | Local hover color |
| `hovered.opacity` | `0.35` | Local and remote object-overlay hover opacity |
| `outline.linewidth` | `1` | Object outline width |
| `bounds.fillOpacity` | `0` | Group bounding-box fill |
| `highlight.edgeThickness` | `1` | Blur-pass edge width |
| `highlight.edgeGlow` | `0` | Blur-pass glow |
| `highlight.downSampleRatio` | `2` | Blur-pass resolution divisor |
| `highlightJfa.ringThickness` | `2` | JFA ring width |
| `highlightJfa.borderThickness` | `1` | JFA border width |
| `highlightJfa.isolatedFillOpacity` | `0.15` | JFA hover fill |
| `xray` | `false` | Draw object overlays through geometry |
| `renderOrder` | technique default | Object-overlay render order; peer indicators draw one below (box silhouette) |
| `xrayDepthWrite` | `false` | Keep the visible portion writing depth under xray (box silhouette) |

Opacity values are clamped to `0..1`. Thickness and resolution values are
validated when the appearance is created.

## Rendering modes

| Mode | Use it for |
|---|---|
| `"outline"` | Per-object child overlays with optional X-ray rendering |
| `"highlight"` | Many colored outlines in a blur-based scene pass |
| `"highlightJfa"` | Stable screen-pixel rings from a Jump Flood pass |

All modes use the same resolver and priority policy: local selection, peer
selection, local hover, then peer hover. A non-mesh target uses a bounding box
in every mode.

Override the object technique for one registration:

```ts
highlight.register("hero", heroMesh, { technique: "outline" });
```

That override survives later `mode` changes.

## Peer state

Both peer registries are created for you. Feed them from any transport:

```ts
highlight.peerSelections.select("peer-a", "crate");
highlight.peerHovers.hover("peer-a", "building");
highlight.chips.enabled = true;
highlight.visibility!.maxDistance = 40;
```

Pass custom registries in the constructor when local and remote colors must
share an application allocator. `MeshHighlight` takes ownership and disposes
them. Pass `visibility: false` to disable remote frustum and distance culling.

## Low-level building blocks

`MeshHighlightState` is the state and registration component. It can still own
local object overlays when constructed directly. Pass `renderOverlays: false`
when another renderer presents its state.

```ts
import {
  MeshHighlightAppearance,
  MeshHighlightState
} from "@jolly-pixel/three";

const state = new MeshHighlightState({
  appearance: new MeshHighlightAppearance({ xray: true })
});
state.register("crate", crateMesh);
state.select("crate");
state.configure({ outline: { linewidth: 2 } });
state.technique = "highlight";
```

`HighlightResolver`, `ObjectOverlayRenderer`, and `HighlightPassRenderer` are
exported for applications that need a custom composition. Supply
`rendererFactory` to `MeshHighlight` to replace the built-in strategy creation
without reimplementing state ownership.

Call `highlight.dispose()` to release renderers, overlays, visibility, chips,
registries, and state. A disposed `MeshHighlight` cannot be reused.

## More

- [Rendering techniques](./rendering.md) covers standalone overlays,
  postprocess passes, bulk selection, and custom factories.
- [Peer selection and hover](./peers.md) covers transport-independent remote
  state and lower-level adapters.
- [Network selection sync](../network/selection.md) connects the state store
  and registries to `@jolly-pixel/network`.
