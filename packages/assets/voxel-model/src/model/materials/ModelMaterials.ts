// Import Third-party Dependencies
import { OrderedTree } from "@jolly-pixel/asset.common";

// Import Internal Dependencies
import type {
  MaterialEntryJSON,
  ModelMaterialJSON,
  MaterialSurfacePatchJSON
} from "../types.ts";

export type ModelMaterialsReader = Pick<
  ModelMaterials,
  | "size"
  | "has"
  | "get"
  | "canAdd"
  | "canMove"
  | "isSiblingSlot"
  | "material"
  | "isAssignable"
  | "values"
  | "materials"
  | "listChildren"
  | "findNextSibling"
  | "subtreeFrom"
  | "ancestorIds"
>;

export class ModelMaterials extends OrderedTree<MaterialEntryJSON> {
  constructor() {
    super({
      entry: "material",
      canContain: (parent) => parent.kind === "folder"
    });
  }

  material(
    id: string
  ): ModelMaterialJSON | undefined {
    const entry = this.peek(id);

    return entry?.kind === "material" ? structuredClone(entry) : undefined;
  }

  isAssignable(
    materialId: string | null | undefined
  ): boolean {
    return materialId === null ||
      materialId === undefined ||
      this.peek(materialId)?.kind === "material";
  }

  * materials(): IterableIterator<ModelMaterialJSON> {
    for (const entry of this.scan()) {
      if (entry.kind === "material") {
        yield structuredClone(entry);
      }
    }
  }

  rename(
    id: string,
    name: string
  ): void {
    this.update(id, (entry) => {
      return {
        ...entry,
        name
      };
    });
  }

  changeSurface(
    id: string,
    surface: MaterialSurfacePatchJSON
  ): void {
    this.update(id, (entry) => (entry.kind === "material" ?
      {
        ...entry,
        surface: {
          ...entry.surface,
          ...surface
        }
      } :
      entry));
  }
}
