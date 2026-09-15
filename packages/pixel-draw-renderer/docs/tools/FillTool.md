# FillTool

Configures the paint bucket used in fill mode. `PixelArtCanvas` exposes it as `canvas.tools.fill`.

```ts
canvas.mode = "fill";
canvas.tools.fill.global = true;
canvas.tools.fill.uvClip = true;
```

Left-click fills with `canvas.brush.primary`; right-click uses `canvas.brush.secondary`.

## Types

```ts
interface FillTool {
  global: boolean;
  uvClip: boolean;
}
```

## Properties

### `global`

```ts
get global(): boolean
set global(value: boolean)
```

When `false`, the fill covers the four-connected region containing the clicked pixel. When `true`, it recolors every pixel on the texture with the same RGBA value as the clicked pixel.

The default is `false`. The value persists across mode changes.

### `uvClip`

```ts
get uvClip(): boolean
set uvClip(value: boolean)
```

Narrows the fill with a [UV clip](../../GLOSSARY.md#uv-clip). It combines with `global`: flood fill still matches the seed color with four-connectivity, and a global fill still recolors every matching pixel, but only inside the clip.

- Seed pixel inside one or more slots: the fill stays inside the union of those slots.
- Seed pixel outside every slot: the fill stays outside all slots. Gaps between the slots of an unfolded net count as outside.
- No regions: the fill is a plain fill.

Every region counts, whatever [`UVMap.isVisible()`](../uv/UVMap.md) returns. Inactive slots do not clip. A pixel belongs to a slot when its center lies inside the slot geometry, so triangles clip on their diagonal.

A clipped global fill is committed as a `stroke` hook event with its positions. Only an unclipped global fill emits `global-fill`, whose receivers recolor the whole texture.

The default is `false`. The value persists across mode changes.
