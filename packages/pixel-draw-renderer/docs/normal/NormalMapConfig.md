# NormalMapConfig

Immutable settings of a texture's normal map: texture defaults plus per UV region zones. A document stores this, never normal pixels; [`NormalMap`](./NormalMap.md) derives the pixels from it.

```ts
const config = NormalMapConfig.create({ border: "bevel" })
  .withZone({ regionId: "glass", settings: "off" });

doc.enableNormalMap(config);
```

## Settings

```ts
interface NormalMapSettings {
  height: "luminance" | "regions" | "flat";
  invert: boolean;
  strength: number;
  border: "wrap" | "clamp" | "bevel";
  bevel: {
    width: number;
    profile: "linear" | "round";
  };
  edgeIntensity: number;
  levels: number;
}
```

| Field | Default | Meaning |
|---|---|---|
| `height` | `"luminance"` | `"luminance"`: Rec. 709 luma. `"regions"`: distance to the edge of the pixel's same-colour area, shaped by `bevel`. `"flat"`: `1` |
| `invert` | `false` | uses `1 - height` |
| `strength` | `2` | gradient multiplier, `>= 0` |
| `border` | `"wrap"` | what a sample outside the island reads, see [NormalMap](./NormalMap.md#border) |
| `bevel` | `{ width: 1, profile: "round" }` | `width > 0`, in pixels |
| `edgeIntensity` | `1` | multiplier of the difference toward a transparent neighbour, `>= 0`; `0` removes the rim around cut-outs |
| `levels` | `0` | `0` (off) or an odd count `>= 3` of steps `n.x` and `n.y` snap to |

`DEFAULT_NORMAL_MAP_SETTINGS` holds the defaults. Transparent pixels always have height `0`, and partial alpha scales the height.

## Zones

```ts
interface NormalMapZone {
  regionId: string;
  settings: Partial<NormalMapSettings> | "off";
}
```

A zone overrides the defaults for one UV region by id and stores no geometry. `"off"` flattens every island the region touches. A zone whose region does not exist is ignored and kept.

On an island shared by several regions, the last matching zone in `zones` wins. `zones` keeps creation order.

## Construction

```ts
static create(defaults?: Partial<NormalMapSettings>): NormalMapConfig;
static from(data: NormalMapData): NormalMapConfig;
static parse(value: unknown): NormalMapConfig | null;

interface NormalMapData {
  defaults: NormalMapSettings;
  zones: NormalMapZone[];
}
```

`from` throws for invalid data: `InvalidNormalMapSettingsError` for an incomplete `defaults` or an out-of-range value, `RangeError` for two zones for one region. `parse` returns `null` for the same cases and for an empty `regionId` or a value of the wrong shape. Unknown setting keys are dropped.

`create`, `withDefaults` and `withZone` throw `InvalidNormalMapSettingsError` for an out-of-range setting value. `NORMAL_MAP_HEIGHTS`, `NORMAL_MAP_BORDERS` and `NORMAL_MAP_BEVEL_PROFILES` list the accepted values of the enumerated settings.

## Properties

```ts
readonly defaults: Readonly<NormalMapSettings>;
readonly zones: readonly Readonly<NormalMapZone>[];
```

Both are frozen.

## Methods

```ts
zoneOf(regionId: string): Readonly<NormalMapZone> | undefined;
indexOf(regionId: string): number;
pickDefaults(keys: Iterable<keyof NormalMapSettings>): Partial<NormalMapSettings>;
withDefaults(patch: Partial<NormalMapSettings>): NormalMapConfig;
withZone(zone: NormalMapZone, index?: number): NormalMapConfig;
withoutZone(regionId: string): NormalMapConfig;
resolve(regionIds: Iterable<string>): Readonly<NormalMapSettings> | "off";
winningZone(regionIds: Iterable<string>): Readonly<NormalMapZone> | undefined;
toJSON(): NormalMapData;
```

`withZone` replaces an existing zone in place. A new zone is appended, or inserted at `index` (clamped). `withoutZone` returns the same instance when the region has no zone. `resolve` merges the winning zone over the defaults; with no matching zone it returns `defaults`.

## Commands

```ts
function isNormalMapCommand(command: { action: string }): boolean;
```

Normal map commands are [pixel commands](../PixelCommand.md), applied by [`PixelDocumentState`](../PixelDocumentState.md). Patches and zone commands leave a disabled feature off. `isNormalMapCommand` narrows any command union to the four actions below.

| Action | Metadata |
|---|---|
| `normal-map-toggled` | `{ config: NormalMapData \| null }` |
| `normal-map-defaults-patched` | `{ patch: Partial<NormalMapSettings> }` |
| `normal-map-zone-set` | `{ zone: NormalMapZone, index: number }` |
| `normal-map-zone-deleted` | `{ regionId: string }` |

`normal-map-zone-set` replaces the region's zone in place, or inserts a new zone at `index`. Commands carry only the change: undo data stays in the [history step](../history/PixelHistory.md).
