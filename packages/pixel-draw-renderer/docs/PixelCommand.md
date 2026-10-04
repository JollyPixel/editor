# PixelCommand

One change to a [pixel document](./PixelDocument.md): its pixels, UV regions or normal map settings. A document emits commands for local edits, undo and redo, and applies commands from peers. A headless [`PixelDocumentState`](./PixelDocumentState.md) applies the same commands.

```ts
type PixelCommand = (
  | { action: "stroke"; metadata: { color: RGBA8; positions: Vec2[] } }
  | { action: "resized"; metadata: { size: Vec2 } }
  | { action: "texture-replaced"; metadata: { size: Vec2; pixels: string } }
  | { action: "global-fill"; metadata: { fromColor: RGBA8; toColor: RGBA8 } }
  | { action: "select-edit"; metadata: { positions: Vec2[]; colors: RGBA8[] } }
  | { action: "uv-region-created"; metadata: { region: UVRegionData } }
  | { action: "uv-region-deleted"; metadata: { id: string } }
  | { action: "uv-region-moved"; metadata: { id: string; face: UVSlot | null; rect: SelectionRect } }
  | { action: "uv-region-state-changed"; metadata: { region: UVRegionData } }
  | { action: "uv-region-rotated"; metadata: UVRegionRotation }
  | NormalMapCommand
) & { originTimestamp?: number };

type PixelCommandAction = PixelCommand["action"];
```

`texture-replaced` carries base64 RGBA8 bytes. `originTimestamp` is set on undo and redo commands to the timestamp of the history entry they replay. Normal map commands are listed in [`NormalMapConfig`](./normal/NormalMapConfig.md#commands).

## DocumentCommand

```ts
type DocumentCommand = /* the same variants, without originTimestamp */;

function toPixelCommand(command: DocumentCommand, originTimestamp?: number): PixelCommand;
function toDocumentCommand(command: PixelCommand): DocumentCommand;
```

`DocumentCommand` is the in-memory form: `texture-replaced` holds its bytes as a `Uint8ClampedArray`. History entries and `PixelDocumentState.apply()` use it. The two functions convert between the forms; every other variant is returned as is.

## Applying

| Action | Effect |
|---|---|
| `stroke` | paints `color` at `positions` |
| `resized` | resizes the texture, restoring retained pixels |
| `texture-replaced` | replaces the size and every pixel |
| `global-fill` | repaints every pixel of `fromColor` with `toColor` |
| `select-edit` | paints each position with its own color |
| `uv-region-created` | adds the region, or replaces it when its id exists |
| `uv-region-deleted` | removes the region and its normal map zone |
| `uv-region-moved` | moves the region, or the slot of a free region, kept inside the texture; an unknown slot is ignored |
| `uv-region-state-changed` | replaces an existing region |
| `uv-region-rotated` | replaces an existing region, or one slot's geometry |

Commands for a missing region are ignored.
