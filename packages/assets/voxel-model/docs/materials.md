# Material library

Exported from `@jolly-pixel/asset.voxel-model/client`. A model owns its material library: materials sorted into material folders, in one ordered tree kept apart from the nodes. A block points to a material, never a folder, with its optional `materialId`; a block without one renders as `MaterialSurface.create()`.

```ts
import {
  MaterialSurface,
  ModelDocument
} from "@jolly-pixel/asset.voxel-model/client";

const document = new ModelDocument();
const metals = document.addMaterialFolder({ name: "Metals" })!;
const steel = document.addMaterial({
  name: "Steel",
  parentId: metals,
  surface: MaterialSurface.create({ color: "#9aa4ad", roughness: 0.3, metalness: 1 })
})!;

document.addBlock({ name: "Helm", materialId: steel });
document.changeMaterial(steel, { roughness: 0.5 });
```

## Entries

`MaterialEntryJSON` is a `ModelMaterialJSON` `{ kind: "material", id, parentId, name, surface }` or a `MaterialFolderJSON` `{ kind: "folder", id, parentId, name }`. `parentId` is a material folder, or `null` for the library root. Names are labels and may repeat; entries are told apart by ID.

A `MaterialSurfaceJSON` holds:

| Field | Value |
|---|---|
| `color`, `emissive` | Lowercase `#rrggbb`. |
| `opacity`, `roughness`, `metalness` | From 0 to 1. |
| `emissiveIntensity` | 0 or more. |

## Editing

| Method | Description |
|---|---|
| `addMaterial({ name, id?, parentId?, beforeId?, surface? })` | Adds a material and returns its ID, or `null`. `surface` defaults to `MaterialSurface.create()`. |
| `addMaterialFolder({ name, id?, parentId?, beforeId? })` | Adds a folder and returns its ID, or `null`. |
| `moveMaterial(id, parentId, beforeId?)` | Moves a material or a folder. A folder cannot move into its own subtree. |
| `removeMaterial(id, { keepContents? }?)` | Removes a material, or a folder and everything in it. The removed materials are cleared from their blocks. With `keepContents`, a folder goes alone and its entries take its place, in their order. |
| `renameMaterial(id, name)` | Renames a material or a folder. |
| `changeMaterial(id, surface)` | Merges a `MaterialSurfacePatchJSON` into a material's surface, keeping the fields it does not name. |

An entry lands before the sibling `beforeId`, or last without one. The methods return `false`, or `null` for the `add*` methods, when the library refuses the command, including a surface that breaks the rules above.

## Reading the library

`document.tree.materials` reads the library in its order. Reads return copies.

| Member | Description |
|---|---|
| `size`, `has(id)`, `get(id)`, `values()` | Materials and folders. |
| `childrenOf(parentId)`, `nextSiblingOf(id)`, `subtreeOf(id)` | Sibling order and subtrees. |
| `material(id)`, `materials()` | Materials only. |

`tree.blocksUsing(materialId)` and `tree.materialUses()` tell which blocks use a material.

## `MaterialSurface`

| Member | Description |
|---|---|
| `MaterialSurface.create(overrides?)` | The default surface, with `overrides` applied. |
| `MaterialSurface.isValid(value)` | Whether a value is a valid surface. It needs no schema compiler, so browser code can check input with it. |
| `MaterialSurface.isPatch(value)` | Whether a value is a valid, non-empty surface patch. |
| `MaterialSurface.KEYS` | The surface field names. |
| `MaterialSurface.PROPERTIES` | The JSON schema of each field; the network schemas are built from them. |
| `new MaterialSurface(surface)` | Holds a surface. Throws a `RangeError` for an invalid one. |
| `changesTo(next)` | The fields of `next` that differ, as a patch, empty when none do. |
| `holds(patch)` | Whether the surface already has every field of `patch`. |

## Clipboard

`encodeMaterialTransfer(materials)` writes materials as clipboard text tagged with `MATERIAL_TRANSFER_KIND`, each as a `MaterialTransferJSON` `{ name, surface }`, without its ID or place in the library. `decodeMaterialTransfer(text)` returns them, or `null` for any other text or an invalid material.
