# FillTool

Configures the paint bucket used in fill mode. `PixelArtCanvas` exposes it as `canvas.tools.fill`.

```ts
canvas.mode = "fill";
canvas.tools.fill.global = true;
```

Left-click fills with `canvas.brush.primary`; right-click uses `canvas.brush.secondary`.

## Types

```ts
interface FillTool {
  global: boolean;
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
