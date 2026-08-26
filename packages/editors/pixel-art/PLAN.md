# Three.js UV bridge — implementation plan

A shared API for putting a live pixel-draw canvas, and the UV regions drawn on it, onto
Three.js geometry. Today that job is done three times over, by three different mechanisms,
none of which stream.

Phases are ordered so that every one after P1 retires code. P0 is the only phase with no
consumer of its own; it exists because every later phase needs a change signal that
`pixel-draw.renderer` does not currently emit.

Conventions follow the repository: tests and `docs/*.md` ship in the same commit as the code
they describe, relative imports carry `.ts`, import order is Node → third-party → internal.

---

## 0. Why this exists

Three implementations, no shared code:

| | texture source | update trigger | UV mapping |
|---|---|---|---|
| `pixel-art/examples/scripts/preview` | `CanvasTexture(canvas.textureCanvas())`, re-pointed by hand on `texture-replaced` | `canvas.onBufferUpdated` → `needsUpdate = true` | full: `applyUvGeometry.ts`, `PreviewShape.ts`, `CubeShape`/`RampShape` face ranges |
| `voxel-map/TextureEditorBridge` | `tilesetManager.updateSourceImage(canvas.textureCanvas())` | `onDrawEnd` only — one repaint per commit | none; `voxel.renderer`'s mesher owns UVs, `BlockUvBridge` maps regions ↔ `BlockDefinition` |
| `voxel-model/ThreeSceneManager` | a **new** `THREE.CanvasTexture` every animation frame (`index.ts:29`) | rAF poll | none yet |

The reusable half — `applyUvGeometry` / `orientUv` / `FaceVertexRange` / the `BoxGeometry`
face-range table — currently lives only under `examples/`, which means no editor can reach it.

### Why nothing streams today

Four independent causes, all of which P0–P3 close:

1. **`onBufferUpdated` is the wrong hook.** It is a single-slot setter, not an emitter, and
   `PixelSyncClient` claims it (`PixelSyncClient.ts:47`). `EditPipeline.emitHook` also returns
   early while applying remote commands (`EditPipeline.ts:258`), so a texture bridge on that
   hook never sees a peer's strokes. voxel-map papers over this by re-syncing on `"snapshot"`.
2. **No public change subscription.** `CanvasBuffer` emits `"changed"` for local *and* remote
   pixel writes — the correct source — and `PixelDocument.onChange` wraps it, but
   `PixelArtCanvas.#doc` is private and exposes only `textureCanvas()`. Hence the fallbacks.
3. **`"changed"` is incomplete and payload-free.** `CanvasBuffer.loadTexture()` and `resize()`
   mutate the working canvas and emit **nothing** (`CanvasBuffer.ts:85-140`), so a texture
   bound to the old element goes stale — exactly what the preview patches by hand. And
   `emit("changed")` discards the `dirtyArea.bounds` it already computed (`CanvasBuffer.ts:181`).
4. **voxel-map's sink cannot take a stream.** `updateSourceImage` re-runs `padAtlas` over the
   whole atlas (`TilesetManager.ts:169`), and `padAtlas` is nine `drawImage` calls per tile
   (`atlasLayout.ts:122`). A 2048px atlas at `tileSize` 16 is 128×128 tiles — roughly 147 000
   `drawImage` calls per update. This is not a "measure it first" question; per-frame is
   impossible and P3 has to add an incremental path.

---

## P0: change signals in `@jolly-pixel/pixel-draw.renderer`

No new feature. Everything after this depends on it.

**`src/buffer/CanvasBuffer.ts`** — widen the event map:

```ts
export type CanvasBufferEvent = {
  changed: (event: { bounds: SelectionRect; }) => void;
  resized: (event: { size: Vec2; }) => void;
  replaced: (event: { size: Vec2; }) => void;
};
```

- `changed` carries the bounds each emit site already has: `dirtyArea.bounds` in `drawPixels`
  and `drawColorGroups`, `rect` in `drawRegion` and `drawMaskedRegion`. Additive for
  TypeScript — a zero-parameter listener stays assignable to a one-parameter signature, so
  `CanvasView` needs no edit for this part.
- `resize()` emits `resized`. It keeps the same canvas *element* and only changes its
  dimensions, so a bound texture needs `needsUpdate`, not a new `image`.
- `loadTexture()` emits `replaced`. It **swaps** `#workingCanvas` for a different element, so a
  bound texture must re-point `image`. Keeping these two as distinct events is the whole point;
  collapsing them into one forces every consumer to re-point defensively on every resize.

**`src/PixelDocument.ts`** — drop the `onChange`/`offChange` pair and make `PixelDocument`
extend `Emitter<PixelDocumentEvent>`, forwarding the three buffer events. `CanvasView.ts:120`
and `:182` are the only callers, both inside the package.

**`src/PixelArtCanvas.ts`** — expose `readonly document: PixelDocument`.

`uv` is already a public field pointing into the same document (`PixelArtCanvas.ts:205`), so
this widens the surface less than it appears. It is deliberately not a new emitter on
`PixelArtCanvas` itself: that class does not extend `Emitter`, and it already has an
`onResize()` method that a `resized` event would read as a pair with.

**Tests** — `test/buffer/CanvasBuffer.spec.ts` gains: bounds match the union of drawn pixels
for each of the four draw paths; `resize` emits `resized` and not `replaced`; `loadTexture`
emits `replaced` and `canvas()` returns a different element afterwards; neither emits `changed`.

**Docs** — `docs/buffer/CanvasBuffer.md`, `docs/PixelArtCanvas.md`.

**Changeset** — minor for `@jolly-pixel/pixel-draw.renderer`. Additive at the type level, but
`PixelDocument.onChange` is removed, and that type is exported.

**Done when** the three events are emitted, `canvas.document.on("changed", …)` is reachable
from outside the package, and the existing suite is green with no edits beyond `CanvasView`.

---

## P1: `src/three/` in `@jolly-pixel/editor.pixel-art`

**Create**

```
src/three/PixelCanvasTexture.ts   live canvas → THREE.CanvasTexture
src/three/UVGeometryBinding.ts    UVRegion → geometry.attributes.uv
src/three/applyUvGeometry.ts      moved from examples/scripts/preview/
src/three/faceRanges.ts           FaceVertexRange, boxFaceRanges(), rampFaceRanges()
src/three/types.ts                PixelTextureSource
src/three/index.ts                the subpath barrel
docs/three/PixelCanvasTexture.md
docs/three/UVGeometryBinding.md
test/three/PixelCanvasTexture.spec.ts
test/three/UVGeometryBinding.spec.ts
test/three/applyUvGeometry.spec.ts
```

### `PixelCanvasTexture`

```ts
export interface PixelCanvasTextureOptions {
  /** @default "nearest" */
  filter?: "nearest" | "linear";
  /** @default THREE.SRGBColorSpace */
  colorSpace?: THREE.ColorSpace;
  /** @default "frame" */
  flush?: "frame" | "immediate" | "manual";
  /** Overrides requestAnimationFrame. Injected by tests. */
  scheduler?: (callback: () => void) => void;
}

export class PixelCanvasTexture extends Emitter<{
  resized: (event: { size: Vec2; }) => void;
}> {
  readonly texture: THREE.CanvasTexture;
  constructor(source: PixelTextureSource, options?: PixelCanvasTextureOptions);
  /** Applies pending changes now. Returns the union of dirty bounds, or null. */
  consume(): SelectionRect | null;
  dispose(): void;
}
```

It folds in what all three call sites hand-roll: nearest filters, `generateMipmaps: false`,
`needsUpdate` on change, re-pointing `image` on `replaced`, and — the actual fix — one flush
per animation frame instead of one per pixel or one per commit.

`consume()` is the escape hatch and the more interesting half of the API. It returns the
accumulated dirty rectangle, which is what lets P3 repad only the tiles a stroke touched
rather than the atlas. `flush: "manual"` hands the whole schedule to the caller.

`resized` is re-emitted (not just handled) because consumers hold a `textureSize` of their own —
`RegionPreviewGallery.refreshTextureSize()` exists for exactly this and currently rides on
`onBufferUpdated`.

`PixelTextureSource` is a structural interface (`textureCanvas()`, `textureSize`, `document`)
rather than `PixelArtCanvas` itself, mirroring the `RegionPreviewCanvas` interface the example
already declares. `PixelArtCanvas` satisfies it after P0; tests fake it in three lines.

### `UVGeometryBinding`

```ts
export class UVGeometryBinding {
  constructor(options: {
    geometry: THREE.BufferGeometry;
    region: UVRegion;
    textureSize: Vec2;
    faceRanges: Partial<Record<UVFace, FaceVertexRange>>;
  });
  get regionId(): string;
  setRegion(region: UVRegion): void;
  setTextureSize(size: Vec2): void;
  applyFace(face: UVFace | null, geometry: UVGeometry): void;
  /** Subscribes to region-moved, region-dragging, region-state-changed, filtered by id. */
  follow(uv: UVMap): void;
  unfollow(): void;
}
```

This is `applyUvGeometry.ts` plus the applying half of `RegionPreviewBehavior`, with
`region-dragging` wired in. That one subscription is the second live-update fix in this plan:
`UVMap` has emitted a per-pointer-move `region-dragging` event all along, and only the example
listens to it.

The constructor snapshots the geometry's `uv` attribute as its base — the same trick
`RegionPreviewBehavior` uses. Documented as a precondition: pass geometry whose UVs have not
already been rewritten, or the second binding reads the first one's output.

`faceRanges.ts` holds `boxFaceRanges()`, today a private constant in `CubeShape.ts` that
silently encodes `THREE.BoxGeometry`'s vertex order, and `rampFaceRanges()` from `RampShape.ts`.

### Deliberately not in P1

| Not here | Why |
|---|---|
| `resolvePreviewShape` / `CubeShape` / `RampShape` / `borders` / `faceLabels` | They build rounded borders and face-label sprites. That is gallery chrome, not a bridge. Only the face-range tables are generic, and those move. |
| A `RegionPreviewBehavior` equivalent | It is an `ActorComponent` with rotation, lerped layout and selection color. Nothing outside the gallery wants that. |
| `tileRectOf(tileRef, tileSize)` | Duplicated in `BlockUvBridge.#rectOf` and `blockTextureTiles.ts`, but it is voxel-renderer's `TileRef` domain, not UV geometry. Leave it in voxel-map. |
| Anything voxel-model shaped | voxel-model is WIP and slated for its own refactor; it adopts this package later. Building for it now means building without a consumer. |

### Package wiring

- `three` moves from `devDependencies` to `dependencies`.
- Subpath export, matching the `./network/*.ts` idiom in `pixel-draw-renderer/package.json`:

  ```json
  "exports": {
    ".":            { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
    "./three/*.ts": "./dist/three/*.js"
  }
  ```

  A subpath rather than the root barrel: `src/index.ts` pulls the whole Lit UI surface, and a
  consumer wanting a texture helper should not pay for `PixelDrawPanel`.
- The root barrel does **not** re-export `src/three/`.

**Done when** the two classes are covered by unit tests under `happy-dom` (no WebGL needed —
`BufferGeometry`, `BufferAttribute` and `CanvasTexture` are all CPU-side), and
`npm run build -w @jolly-pixel/editor.pixel-art` emits `dist/three/index.js`.

---

## P2: migrate the preview example

The example is the proof, and it is the only thing with e2e coverage of this behavior.

**Delete** `examples/scripts/preview/applyUvGeometry.ts` and the `FaceVertexRange` half of
`PreviewShape.ts`; `CubeShape`/`RampShape` import their ranges from `#src/three/faceRanges.ts`.

**Rewrite** `PixelPreviewScene.awake()` to construct one `PixelCanvasTexture` and drop the
`onBufferUpdated` assignment entirely, including the manual `texture-replaced` branch that
re-points `image` and calls `refreshTextureSize()`. `RegionPreviewGallery` listens to the
texture's `resized` event instead.

**Rewrite** `RegionPreviewBehavior` to delegate to a `UVGeometryBinding` and keep only what is
genuinely presentational: rotation, position lerp, border color, selection.
`RegionPreviewGallery`'s `region-moved` / `region-dragging` / `region-state-changed` handlers
collapse into `binding.follow(uv)` per preview.

**Done when** `test/e2e/uv.e2e.ts` and the `__uvPreviewMeshCount` invariant pass unchanged. If
an e2e assertion has to move, the API is wrong — fix P1, not the test.

> `test/utils/PreviewUv.spec.ts` and `resolvePreviewShape.spec.ts` cover the moved functions
> today. Move the assertions to `test/three/` rather than rewriting them.

---

## P3: live streaming in `@jolly-pixel/editor.voxel-map`

Two halves. The first is small; the second is the real work.

### 3a. Pixels

`TextureEditorBridge` drops `onDrawEnd: () => this.#bridge.syncToThree()` (`TextureEditor.ts:83`)
and holds a `PixelCanvasTexture` in `flush: "manual"` mode, flushing on its own rAF and feeding
`consume()`'s bounds to the tileset. The `PixelSyncClient.on("snapshot")` re-sync also goes: a
snapshot lands through `CanvasBuffer.loadTexture`, which now emits `replaced`.

`syncTransparency()` currently re-scans every block referencing the tileset on every commit.
With dirty bounds in hand it skips blocks whose tiles do not intersect them.

### 3b. The atlas

`padAtlas` cannot run per frame — see §0.4. Add to `@jolly-pixel/voxel.renderer`:

```ts
// src/tileset/atlasLayout.ts
export function padAtlasRegion(
  target: HTMLCanvasElement,
  image: CanvasImageSource,
  layout: AtlasLayout,
  bounds: SelectionRect
): void;

// src/tileset/TilesetManager.ts
updateSourceRegion(image: TilesetImage, bounds: SelectionRect, tilesetId?: string): void;
```

`padAtlasRegion` redraws the nine-slice for only the tiles intersecting `bounds`, into the
existing padded canvas. A brush stroke touches one to four tiles: 9–36 `drawImage` calls
instead of ~147 000. When padding is 0, `entry.texture === entry.sourceTexture` and the whole
path reduces to `needsUpdate = true`.

`updateSourceImage` stays as the full-atlas path for snapshots, resizes and tileset switches.

**Tests** — `padAtlasRegion` over a synthetic atlas produces a canvas byte-identical to a full
`padAtlas` for the same input; tile-intersection math is covered at the boundaries (a rect
ending exactly on a tile edge must not touch the next tile).

**Changeset** — minor for `@jolly-pixel/voxel.renderer`.

### 3c. Live UV drags

`BlockUvBridge` listens to `region-moved` but not `region-dragging`, so dragging a block's UV
region shows nothing on the map until the pointer is released. Add a `region-dragging` handler
that applies the block update through the existing `#applying` guard. Note this writes to the
block registry on every pointer move — if `applyBlockUpdate` proves too heavy for that, throttle
to the same rAF as 3a rather than reverting to release-only.

**Done when** painting a tile repaints the voxel world within a frame, and dragging a UV region
moves the blocks' texture live, both with a 2048px atlas and no visible stutter.

---

## Sequencing and gotchas

P0 → P1 → P2 → P3, strictly. P2 is what proves P1 before voxel-map depends on it.

- **voxel-map reads `dist/`.** Its workspace dep on both `pixel-draw.renderer` and
  `editor.pixel-art` resolves to built output, so `npm run build -w <pkg>` has to run before
  voxel-map picks up P0 or P1. If a build appears to no-op, delete `tsconfig.tsbuildinfo`, not
  just `dist/`.
- **`editor.pixel-art` is `private: true`.** Fine inside the monorepo — voxel-map already
  depends on it — but this API cannot be published without flipping that flag.
- **`colorSpace` is unset today** in all three implementations. `PixelCanvasTexture` defaults to
  `SRGBColorSpace`; if the preview's colors shift in P2, that default is why, and it is the
  correct value rather than a regression.
