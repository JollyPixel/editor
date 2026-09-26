# MaterialGroup

A material group is the surface finish shared by every block whose
[`BlockSurface`](../blocks/BlockSurface.md) names it in `materialGroup`. The
finish is stored in the [tileset document](../tilesets/TilesetDocument.md),
next to `blocks`, so it is saved, loaded and synced with the tileset; a world
receives it projected under `"<tilesetId>/<groupId>"`.

```ts
import { VoxelEngine } from "@jolly-pixel/voxel.renderer";

const engine = new VoxelEngine({
  blocks: [
    { id: 1, name: "Gold", shapeId: "cube", defaultTexture, materialGroup: "gold" }
  ],
  materialGroups: [
    { id: "gold", roughness: 0.35, metalness: 1 }
  ]
});

engine.defineMaterialGroup({ id: "gold", roughness: 0.2, metalness: 1 });
```

```ts
interface MaterialGroupJSON {
  id: string;
  roughness?: number;
  metalness?: number;
  emissive?: string;
  emissiveIntensity?: number;
}

type MaterialGroupFinish = Required<Omit<MaterialGroupJSON, "id">>;

class MaterialGroup {
  static readonly defaults: Readonly<MaterialGroupFinish>;
  static parse(value: unknown): MaterialGroup | null;

  constructor(json: MaterialGroupJSON);
  readonly id: string;
  readonly roughness: number;
  readonly metalness: number;
  readonly emissive: string;
  readonly emissiveIntensity: number;

  with(finish: Partial<MaterialGroupFinish>): MaterialGroup;
  applyTo(material: THREE.MeshLambertMaterial | THREE.MeshStandardMaterial): void;
  equals(other: MaterialGroup): boolean;
  toJSON(): Required<MaterialGroupJSON>;
}
```

| Field | Default | Bounds |
|---|---|---|
| `id` | Required | Non-empty string, matching `BlockSurface.materialGroup`. |
| `roughness` | `1` | `0` to `1`. |
| `metalness` | `0` | `0` to `1`. |
| `emissive` | `"#000000"` | A `#rrggbb` colour, stored in lower case. |
| `emissiveIntensity` | `1` | `0` or more. |

The instance is frozen. The constructor throws `RangeError` for a value out
of bounds; `parse()` returns `null` instead. `with()` returns a new group.

## Rendering

A block whose group is defined is drawn with a `MeshStandardMaterial` carrying
the finish, even when the view's `material` is `"lambert"`. Blocks without a
group, or naming a group the document does not define, keep the view's
material. `applyTo()` writes only the emissive fields on a Lambert material.

The `materialCustomizer` runs after the finish is applied, so host code can
still override it when a material is created. Editing a finish afterwards
updates the existing materials in place, without the customizer. Defining or
removing a group rebuilds every chunk.

A metallic finish reflects its environment. With no `scene.environment`, a
metalness near `1` renders dark.

## MaterialGroupList

`VoxelDocument.materialGroups` and `VoxelEngine.materialGroups` hold the
groups of a document.

```ts
class MaterialGroupList implements Iterable<MaterialGroup> {
  constructor(groups?: Iterable<unknown>);
  readonly version: number;
  readonly size: number;

  ids(): Set<string>;
  has(groupId: string): boolean;
  get(groupId: string): MaterialGroup | undefined;
  define(group: MaterialGroup | MaterialGroupJSON): boolean;
  remove(groupId: string): boolean;
  replace(groups: Iterable<unknown>): void;
  clear(): void;
  toJSON(): MaterialGroupJSON[];
}
```

`define()` returns `false` for an invalid group or one equal to the current
definition. `replace()` and the constructor skip invalid entries and keep the
first of duplicate IDs. Mutating the list directly emits no command; use
`engine.defineMaterialGroup()` for an edit that should sync.

## Commands

```ts
function applyMaterialGroupCommand(
  groups: MaterialGroupList,
  command: VoxelMaterialGroupCommand
): VoxelMaterialGroupCommand | null;
```

Applies a `material-group-defined` or `material-group-removed`
[command](../core/commands.md#material-group-commands) to a list. Returns the
command as applied, a defined group with every field filled in, or `null` when
the list did not change.
