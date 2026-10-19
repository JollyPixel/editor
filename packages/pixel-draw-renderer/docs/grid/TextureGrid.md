# TextureGrid

Lines drawn over the texture every `size` texture pixels, and the cell lattice UV drags snap to. `PixelArtCanvas` exposes it as `canvas.grid`. It is view state: it is never saved in the document or shared with peers.

```ts
canvas.grid.size = 16;
canvas.grid.visible = true;
canvas.grid.snap = true;
```

## Types

```ts
interface TextureGridOptions {
  size?: number; // default 16
  visible?: boolean; // default false
  snap?: boolean; // default false
  color?: ByteColorInput; // default "rgba(0, 0, 0, 0.45)"
}

type TextureGridEvent = {
  changed: () => void;
};
```

## Properties

```ts
size: number
visible: boolean
snap: boolean
color: string
```

- `size` is a cell side in texture pixels. A fractional value is rounded, a value under `1` becomes `1`, and a non-finite value is ignored.
- `color` accepts a CSS color string or an RGBA8 object and reads back as a CSS `rgba()` string.
- Every setter emits `changed` when the value differs from the current one, and the canvas redraws.

## Methods

### `nearestLine(value: number): number`

Returns the multiple of `size` closest to `value`, a texture coordinate.

## Drawing

- Lines sit on cell boundaries inside the texture, one screen pixel wide, above the texture and below every overlay.
- Each line is drawn in `color`, then dashed with black or white, whichever contrasts with `color`, at the same opacity. It stays visible on light, dark and mid-tone textures.
- Lines are hidden while a cell is smaller than four screen pixels.
- They show in both the albedo and normal [texture views](../PixelArtCanvas.md#textureview--pixelslocked--pixelsreadonly--unavailablemodes).

## Snapping

While `snap` is `true`, UV move and resize drags land on cell lines, as [`UVTool`](../tools/UVTool.md#snapping-to-the-grid) describes. Pixel selections and programmatic [`UVMap`](../uv/UVMap.md) edits never snap.
