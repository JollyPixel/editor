// Import Internal Dependencies
import type {
  MaterialEntryJSON,
  ModelMaterialJSON,
  VoxelModelCommand
} from "../network/types.ts";
import { OrderedTree } from "./OrderedTree.ts";

export type MaterialCommand = Extract<
  VoxelModelCommand,
  { action: `material-${string}`; }
>;

export type ModelMaterialsReader = Pick<
  ModelMaterials,
  | "size"
  | "has"
  | "get"
  | "material"
  | "values"
  | "materials"
  | "childrenOf"
  | "nextSiblingOf"
  | "subtreeOf"
>;

export class ModelMaterials extends OrderedTree<MaterialEntryJSON> {
  constructor() {
    super({
      kind: "material",
      canContain: (parent) => parent.kind === "folder"
    });
  }

  material(
    id: string
  ): ModelMaterialJSON | undefined {
    const entry = this.peek(id);

    return entry?.kind === "material" ? structuredClone(entry) : undefined;
  }

  * materials(): IterableIterator<ModelMaterialJSON> {
    for (const entry of this.scan()) {
      if (entry.kind === "material") {
        yield structuredClone(entry);
      }
    }
  }

  accepts(
    command: MaterialCommand
  ): boolean {
    switch (command.action) {
      case "material-added":
        return this.canAdd(command.material, command.beforeId);
      case "material-folder-added":
        return this.canAdd(command.folder, command.beforeId);
      case "material-moved":
        return this.canMove(command.id, command.parentId, command.beforeId);
      case "material-removed":
        return command.keepContents === true ?
          this.peek(command.id)?.kind === "folder" :
          this.has(command.id);
      case "material-renamed":
        return this.has(command.id);
      case "material-changed":
        return this.peek(command.id)?.kind === "material" &&
          Object.keys(command.surface).length > 0;
    }
  }

  apply(
    command: MaterialCommand
  ): void {
    switch (command.action) {
      case "material-added":
        this.add(command.material, command.beforeId);
        break;

      case "material-folder-added":
        this.add(command.folder, command.beforeId);
        break;

      case "material-moved":
        this.move(command.id, command.parentId, command.beforeId);
        break;

      case "material-removed":
        if (command.keepContents === true) {
          this.liftChildren(command.id);
        }
        this.remove(command.id);
        break;

      case "material-renamed":
        this.update(command.id, (entry) => {
          return {
            ...entry,
            name: command.name
          };
        });
        break;

      case "material-changed":
        this.update(command.id, (entry) => (entry.kind === "material" ?
          {
            ...entry,
            surface: {
              ...entry.surface,
              ...command.surface
            }
          } :
          entry));
        break;
    }
  }
}
