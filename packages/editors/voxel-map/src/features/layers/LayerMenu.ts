// Import Third-party Dependencies
import type { VoxelWorld } from "@jolly-pixel/voxel.renderer";
import {
  MenuSession,
  disableEntries,
  type MenuEntry,
  type MenuItem
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import type {
  LayerRef,
  ObjectRef
} from "../../state/index.ts";
import type {
  LayerCommand,
  LayerCommands,
  LayerRootCommand
} from "./LayerCommands.ts";
import type { MapLayers } from "./MapLayers.ts";
import { MergePlan } from "./MergePlan.ts";

// CONSTANTS
const kMergePrefix = "merge:";
const kMovePrefix = "move:";
const kItems = {
  frame: {
    id: "frame",
    label: "Frame in view",
    icon: "frame"
  },
  rename: {
    id: "rename",
    label: "Rename",
    icon: "pencil"
  },
  duplicate: {
    id: "duplicate",
    label: "Duplicate",
    icon: "copy"
  },
  "save-template": {
    id: "save-template",
    label: "Save as template",
    icon: "template-save"
  },
  "add-object": {
    id: "add-object",
    label: "New object…",
    icon: "plus"
  },
  lock: {
    id: "lock",
    label: "Lock",
    icon: "lock"
  },
  unlock: {
    id: "unlock",
    label: "Unlock",
    icon: "lock"
  },
  "show-only": {
    id: "show-only",
    label: "Show only this layer",
    icon: "eye"
  },
  "show-all": {
    id: "show-all",
    label: "Show all layers",
    icon: "eye"
  },
  "add-layer": {
    id: "add-layer",
    label: "New layer…",
    icon: "plus"
  },
  delete: {
    id: "delete",
    label: "Delete",
    icon: "trash",
    intent: "danger"
  }
} satisfies {
  [TCommand in LayerCommand | LayerRootCommand]: MenuItem<TCommand>;
};

type MergeChoice = `${typeof kMergePrefix}${string}`;
type MoveChoice = `${typeof kMovePrefix}${string}`;
type LayerMenuAction = LayerCommand | MergeChoice | MoveChoice;

export type LayerMenuCommands = Pick<
  LayerCommands,
  "run" | "runRoot" | "mergeInto" | "moveTo"
>;

export interface LayerMenuOptions {
  world: VoxelWorld;
  layers: Pick<MapLayers, "canEdit" | "bounds">;
  templatesEditable: boolean;
  commands: LayerMenuCommands;
}

export class LayerMenu {
  readonly #world: VoxelWorld;
  readonly #layers: LayerMenuOptions["layers"];
  readonly #templatesEditable: boolean;
  readonly #commands: LayerMenuCommands;

  constructor(
    options: LayerMenuOptions
  ) {
    this.#world = options.world;
    this.#layers = options.layers;
    this.#templatesEditable = options.templatesEditable;
    this.#commands = options.commands;
  }

  rootSession(): MenuSession {
    const entries: MenuEntry<LayerRootCommand>[] = [
      kItems["add-layer"],
      "separator",
      kItems["show-all"]
    ];

    return MenuSession.from(
      disableEntries(
        entries,
        (action) => action === "add-layer" &&
          !this.#layers.canEdit("voxel-layer")
      ),
      (action) => this.#commands.runRoot(action)
    );
  }

  session(
    ref: LayerRef
  ): MenuSession {
    const commands = this.#commands;

    return MenuSession.forRow(
      this.#entries(ref),
      () => ref.exists(this.#world),
      (action) => {
        if (isChoice(action, kMergePrefix)) {
          return commands.mergeInto(ref, action.slice(kMergePrefix.length));
        }
        if (isChoice(action, kMovePrefix)) {
          return commands.moveTo(ref, action.slice(kMovePrefix.length));
        }

        return commands.run(ref, action);
      }
    );
  }

  #entries(
    ref: LayerRef
  ): MenuEntry<LayerMenuAction>[] {
    const editable = this.#layers.canEdit(ref.kind);
    const framable = this.#layers.bounds(ref) !== null;
    const entries: MenuEntry<LayerMenuAction>[] = [
      kItems.frame,
      "separator",
      ...this.#editEntries(ref),
      "separator",
      ref.kind === "object" ?
        {
          ...kItems["show-only"],
          label: "Show only this object"
        } :
        kItems["show-only"],
      kItems["show-all"],
      "separator",
      kItems.delete
    ];

    return disableEntries(entries, (action) => {
      switch (action) {
        case "frame":
          return !framable;
        case "show-only":
        case "show-all":
          return false;
        case "save-template":
          return !this.#templatesEditable || this.#voxelCount(ref) === 0;
        case "add-object":
          return !this.#layers.canEdit("object");
        default:
          return !editable;
      }
    });
  }

  #editEntries(
    ref: LayerRef
  ): MenuEntry<LayerMenuAction>[] {
    switch (ref.kind) {
      case "voxel-layer":
        return [
          kItems.duplicate,
          this.#mergeEntry(ref.name),
          kItems["save-template"]
        ];
      case "object-layer":
        return [kItems["add-object"]];
      default:
        return [
          kItems.rename,
          kItems.duplicate,
          this.#moveEntry(ref),
          ref.objectIn(this.#world)?.locked === true ?
            kItems.unlock :
            kItems.lock
        ];
    }
  }

  #mergeEntry(
    layerName: string
  ): MenuEntry<LayerMenuAction> {
    const { targets } = MergePlan.planMerge(this.#world, layerName);

    return {
      id: "merge",
      label: "Merge into",
      icon: "merge",
      disabled: targets.length === 0,
      items: targets.map((target): MenuItem<MergeChoice> => {
        return {
          id: `${kMergePrefix}${target}`,
          label: target,
          icon: "voxel-layer"
        };
      })
    };
  }

  #moveEntry(
    ref: ObjectRef
  ): MenuEntry<LayerMenuAction> {
    const targets = this.#world.objectLayers.toArray()
      .filter((layer) => layer.name !== ref.layerName);

    return {
      id: "move",
      label: "Move to",
      icon: "object-layer",
      disabled: targets.length === 0,
      items: targets.map((layer): MenuItem<MoveChoice> => {
        return {
          id: `${kMovePrefix}${layer.name}`,
          label: layer.name,
          icon: "object-layer"
        };
      })
    };
  }

  #voxelCount(
    ref: LayerRef
  ): number {
    return ref.kind === "voxel-layer" ?
      this.#world.getLayer(ref.name)?.voxelCount ?? 0 :
      0;
  }
}

function isChoice<TPrefix extends string>(
  action: LayerMenuAction,
  prefix: TPrefix
): action is Extract<LayerMenuAction, `${TPrefix}${string}`> {
  return action.startsWith(prefix);
}
