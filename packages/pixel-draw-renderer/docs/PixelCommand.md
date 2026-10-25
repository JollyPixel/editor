# PixelCommand

One change to a [pixel document](./PixelDocument.md): its pixels, UV regions, saved UV nets or normal map settings. A document emits commands for local edits, undo and redo, and applies commands from peers. A headless [`PixelDocumentState`](./PixelDocumentState.md) applies the same commands.

```ts
type PixelCommand = (
  | { action: "stroke"; metadata: { color: RGBA8; positions: Vec2[] } }
  | { action: "resized"; metadata: { size: Vec2 } }
  | { action: "texture-replaced"; metadata: { size: Vec2; pixels: string } }
  | { action: "global-fill"; metadata: { fromColor: RGBA8; toColor: RGBA8 } }
  | { action: "select-edit"; metadata: { positions: Vec2[]; colors: RGBA8[] } }
  | { action: "palette-color-changed"; metadata: { index: number; color: RGBA8 } }
  | { action: "uv-region-created"; metadata: { region: UVRegionData } }
  | { action: "uv-region-deleted"; metadata: { id: string } }
  | { action: "uv-region-moved"; metadata: { id: string; face: UVSlot | null; rect: SelectionRect } }
  | { action: "uv-region-state-changed"; metadata: { region: UVRegionData } }
  | { action: "uv-region-rotated"; metadata: UVRegionRotation }
  | UVNetCommand
  | NormalMapCommand
);

type UVNetCommand =
  | { action: "uv-net-saved"; metadata: { net: SavedUVNetData } }
  | { action: "uv-net-deleted"; metadata: { id: string } }
  | { action: "uv-net-default-changed"; metadata: { id: string | null } };

type PixelCommandAction = PixelCommand["action"];

function uvNetId(command: UVNetCommand): string | null;
```

`uvNetId` returns the id of the saved net a UV net command writes, or `null` for `uv-net-default-changed`, which writes the default.

`texture-replaced` carries base64 RGBA8 bytes. Normal map commands are listed in [`NormalMapConfig`](./normal/NormalMapConfig.md#commands).

## PixelDocumentCommand

```ts
type PixelDocumentCommand = /* the same variants, with texture bytes in memory */;

function toPixelCommand(command: PixelDocumentCommand): PixelCommand;
function toPixelDocumentCommand(command: PixelCommand): PixelDocumentCommand;
```

`PixelDocumentCommand` is the in-memory form: `texture-replaced` holds its bytes as a `Uint8ClampedArray`. Document changes, history steps and `PixelDocumentState.apply()` use it. The two functions convert between the forms; every other variant is returned as is.

## Applying

| Action | Effect |
|---|---|
| `stroke` | paints `color` at `positions` |
| `resized` | resizes the texture, restoring retained pixels |
| `texture-replaced` | replaces the size and every pixel |
| `global-fill` | repaints every pixel of `fromColor` with `toColor` |
| `select-edit` | paints each position with its own color |
| `palette-color-changed` | replaces one saved palette color; index must be `0–9` and all RGBA channels must be integer bytes |
| `uv-region-created` | adds the region, or replaces it when its id exists |
| `uv-region-deleted` | removes the region and its normal map zone |
| `uv-region-moved` | moves the region, or the slot of a free region, kept inside the texture; an unknown slot is ignored |
| `uv-region-state-changed` | replaces an existing region |
| `uv-region-rotated` | replaces an existing region, or one slot's geometry |
| `uv-net-saved` | adds the [saved net](./uv/SavedUVNet.md), or replaces the one with its id; throws like the `SavedUVNet` constructor for an invalid net |
| `uv-net-deleted` | removes the saved net and leaves the default id unchanged |
| `uv-net-default-changed` | sets the default net id, `null` for none |

Commands for a missing region or saved net are ignored.
