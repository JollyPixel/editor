# Asset preview

The Details card of the asset browser (`src/shell/assets/AssetDetails.ts`)
shows a preview of the selected asset. The card header holds the asset name
and an "Open" button, and one muted line under the preview gives the kind and
the parent folder. A kind without a preview, a folder, a multiple selection
and an empty selection show an icon in the same frame, so the card always has
the same height.

Previews appear in the Details card only, never in the asset tree.

## Two sources

The shell never loads kind or editor code, so it cannot draw a preview itself.
A preview comes from one of two places, chosen per kind:

- **Server hook**, for 2D kinds: the kind handler encodes an image from the
  asset state. Selecting a pixel art or a texture boots no frame and opens no
  room.
- **Preview frame**, for 3D kinds: a hidden iframe joins the asset room,
  renders the state with three.js and returns a PNG.

Both work from the asset state and refresh when the catalog revision changes,
about 2 s after edits stop (the snapshot delay). Neither is live while
someone edits.

The project manifest tells the shell which kinds have a preview and where it
comes from. Each kind entry gets `preview?: "server"`, set when the kind's
handler has a `preview` hook; `"frame"` joins it with the preview frame. The
shell never guesses from the kind name.

The built-in texture kind is listed in the manifest like a packaged kind, with
`creatable: false` so "New asset" does not offer an empty image.

## Server hook

`AssetKindHandler` gains an optional method:

```ts
preview?(state: TState): Promise<AssetPreview | null>;

interface AssetPreview {
  readonly type: string;
  readonly bytes: Uint8Array;
}
```

The 2D hooks draw at the asset's own size and the card scales the image, so
the hook takes no size. A size argument can come with 3D server hooks, if any.

- A new `catalog:preview` query sits next to `catalog:read`, so access goes
  through the catalog room like every other read. Unlike `catalog:read`, it
  does not flush the asset and returns only what the hook draws.
- When the asset room is open, the hook reads the live state. Otherwise
  `AssetPreviews` creates a state, loads the stored content into it and drops
  it after the call.
- `AssetPreviews` keeps the result per `id@revision`, up to 32 MiB in all, and
  concurrent requests for the same revision share one draw. A draw that ends
  after the revision moved is returned but not kept.
- `null` means no preview for this asset; the card shows the kind icon.

First kinds:

- **Pixel art**: `encodePngPixels` from `@jolly-pixel/pixel-draw.renderer`,
  which `asset.pixel-art` already depends on, on the document buffer.
- **Texture**: the stored bytes, unchanged, when the first bytes match a format
  a browser shows (png, jpeg, gif, webp, bmp) and the file is at most 2 MiB.
  `null` for ktx2 and for larger files. Server-side downscaling can come later
  if large textures turn out to be common.

## Preview frame

One shared page, owned by the studio, renders every 3D kind.

- An editor package declares `"jollypixel": { "preview": "./preview" }` and
  exports `PreviewRenderer`s keyed by kind. The studio compiles them into
  `virtual:jolly-pixel/contributions/preview`, the same way it builds
  `virtual:jolly-pixel/contributions/scene`.
- One hidden iframe holds one WebGPU device and one copy of three.js. The shell
  creates it on the first 3D selection and keeps it for the session.
- The frame connects to the back-end with the `editor.host` connection
  helpers, as an editor frame does.
- The shell sends `render(assetId, size)` over `postMessage` and gets a PNG
  back, or an error.
- Each render is one-shot: join the asset room, take the snapshot, render,
  leave. The server evicts the state after its usual grace period.
- Renderers load dependencies through a loader the frame provides. It joins
  each dependency's room the same way and caches the loaded state per
  `id@revision`, so a voxel map and its blockset are not fetched twice.
- A renderer that throws fails that render only. The card shows the kind icon
  and the frame keeps serving other assets.
- The image is a 256 px square times the device pixel ratio. A 3D renderer
  frames the bounding box from a fixed three-quarter angle.

First kinds, reusing editor code:

- **Model**: `parseModel` from `@jolly-pixel/engine`, as `ModelPreview` in
  `editor.model` does.
- **Voxel model** and **voxel map**: the render-target readback that
  `PreviewPixels` already does for the voxel-map template turntables.

Scene is out of the first iteration: one scene can pull in dozens of assets.

## Shell

- `summarizeSelection` adds `preview: AssetPreviewTarget | null` to
  `AssetFileSummary`, from the manifest flag, next to `editableAssetId`. The
  target holds the asset id and its catalog revision. The asset browser renders
  again on every catalog change, so a new revision reaches the card as a new
  target.
- A `<asset-preview>` element tops the Details card. It shows the kind icon
  while loading, then the image on a checkerboard background with
  `image-rendering: pixelated` and the image size in pixels in a corner. Its
  frame has a fixed height and is shown for every selection.
- `AssetPreviewController` holds the element's logic. It loads again when the
  target's revision moves, keeps the previous image until the next one
  arrives, and drops a result that arrives after the target changed.
- `AssetPreviewCache`, one per catalog the asset browser binds, keeps an LRU of
  Blob URLs keyed `id@revision` and revokes them on eviction and when the
  browser unbinds. Nothing persists across a reload.
- For frame previews, the key will add the revision of each transitive
  dependency from `catalog.dependencies.transitiveDependencies(id)`, so
  repainting a voxel model's texture refreshes the model's preview even though
  the model's own revision did not move. Server-hook kinds have no
  dependencies, so their key stays `id@revision`.

## Open points

- Offline and static build: server previews work offline, since the studio's
  in-browser back-end runs the same kind handlers. For the preview frame, check
  where that back-end lives (`editors/host/src/connection/OfflineMode.ts`). If
  each frame gets its own, the preview frame cannot see the shell's assets, and
  frame previews stay off offline.
- Tests: the frame protocol and the dependency cache key take unit tests. The
  3D render needs WebGPU in a real browser, so it gets one e2e test: select a
  model, see the image.

## Steps

1. Done: `AssetKindHandler.preview`, the `catalog:preview` query, the server
   cache, and the hook for pixel art and texture.
2. Done: the manifest flag, `<asset-preview>`, the shell cache, and the new
   Details card layout. This step ships previews for 2D kinds on its own.
3. The preview page, the contributions module, the frame protocol and the
   dependency loader.
4. Renderers for model, voxel model and voxel map, then the e2e test.
