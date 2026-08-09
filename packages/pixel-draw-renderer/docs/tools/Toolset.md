# Toolset

Provides the runtime controls for drawing tools owned by `PixelArtCanvas`. The canvas exposes it as `canvas.tools`.

```ts
canvas.tools.brush.pickArmed = true;
canvas.tools.fill.global = true;
canvas.tools.select.shape = true;
```

Colors, opacity and brush size are configured through [`canvas.brush`](./Brush.md). UV regions are managed through [`canvas.uv`](../uv/UVMap.md).

## Types

```ts
interface Toolset {
  brush: BrushTool;
  fill: FillTool;
  select: SelectTool;
}
```

## Properties

### `brush`

```ts
brush: BrushTool
```

Controls color picking. See [`BrushTool`](./BrushTool.md).

### `fill`

```ts
fill: FillTool
```

Switches between connected and whole-texture fills. See [`FillTool`](./FillTool.md).

### `select`

```ts
select: SelectTool
```

Controls rectangle or shape selection and exposes selection transforms. See [`SelectTool`](./SelectTool.md).
