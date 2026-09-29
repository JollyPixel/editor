// Import Third-party Dependencies
import type { VoxelWorld } from "@jolly-pixel/voxel.renderer";
import type { Vector3Like } from "three";
import {
  showConfirm,
  type JollyReparentDetail
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  ObjectRef,
  parseLayerRef,
  type LayerRef,
  type SelectionStore
} from "../../state/index.ts";
import { MapObject } from "./objects/MapObject.ts";
import type {
  AddKind,
  AddLayerResult
} from "./dialogs/AddLayerDialog.ts";
import type { MergeLayerContext } from "./dialogs/MergeLayerDialog.ts";
import { MergePlan } from "./MergePlan.ts";

export type ConfirmPrompt = typeof showConfirm;

export interface MapLayersOptions {
  world: VoxelWorld;
  selection: SelectionStore;
  confirm?: ConfirmPrompt;
}

export class MapLayers {
  static acceptsDrop(
    detail: JollyReparentDetail
  ): boolean {
    const target = parseLayerRef(detail.targetId);

    return detail.movedIds.every(
      (movedId) => parseLayerRef(movedId).canMoveOnto(target, detail.where)
    );
  }

  readonly #world: VoxelWorld;
  readonly #selection: SelectionStore;
  readonly #confirm: ConfirmPrompt;

  constructor(
    options: MapLayersOptions
  ) {
    this.#world = options.world;
    this.#selection = options.selection;
    this.#confirm = options.confirm ?? showConfirm;
  }

  defaultNames(): Record<AddKind, string> {
    return {
      "voxel-layer": `Layer ${this.#world.getLayers().length + 1}`,
      "object-layer": `Objects ${this.#world.objectLayers.size + 1}`,
      object: "Object"
    };
  }

  create(
    focus: Vector3Like,
    result: AddLayerResult
  ): void {
    switch (result.kind) {
      case "voxel-layer":
        this.#world.addLayer(result.name);
        this.#selection.selectVoxelLayer(result.name);
        break;
      case "object-layer":
        this.#world.objectLayers.add(result.name);
        this.#selection.selectObjectLayer(result.name);
        break;
      default:
        this.#createObject(focus, result.name);
        break;
    }
  }

  rename(
    ref: LayerRef,
    name: string
  ): void {
    if (ref instanceof ObjectRef) {
      ref.update(this.#world, { name });
    }
  }

  lock(
    ref: LayerRef,
    locked: boolean
  ): void {
    if (ref instanceof ObjectRef) {
      ref.update(this.#world, { locked });
    }
  }

  async remove(
    ref: LayerRef
  ): Promise<void> {
    const message = ref.removalMessage(this.#world);
    const confirmed = message === null || await this.#confirm({
      title: "Delete layer",
      message,
      confirmLabel: "Delete",
      icon: "trash",
      danger: true
    });
    if (confirmed) {
      ref.removeFrom(this.#world);
    }
  }

  clone(
    ref: LayerRef
  ): void {
    if (ref.kind !== "voxel-layer") {
      return;
    }

    const clone = this.#world.cloneLayer(ref.name);
    if (clone !== undefined) {
      this.#selection.selectVoxelLayer(clone.name);
    }
  }

  async merge(
    ref: LayerRef,
    pickTarget: (context: MergeLayerContext) => Promise<string | null>
  ): Promise<void> {
    if (ref.kind !== "voxel-layer") {
      return;
    }

    const plan = MergePlan.of(this.#world, ref.name);
    if (plan.defaultTarget === null) {
      return;
    }

    const target = await pickTarget({
      sourceName: ref.name,
      options: [...plan.options],
      defaultTarget: plan.defaultTarget
    });
    if (target === null) {
      return;
    }

    const confirmed = plan.warnings.length === 0 || await this.#confirm({
      title: "Merge layer",
      message: [
        `Merge "${ref.name}" into "${target}"?`,
        ...plan.warnings
      ].join(" "),
      confirmLabel: "Merge",
      icon: "merge",
      intent: "warning"
    });
    if (confirmed && this.#world.mergeLayer(ref.name, target)) {
      this.#selection.selectVoxelLayer(target);
    }
  }

  reparent(
    detail: JollyReparentDetail
  ): void {
    if (!MapLayers.acceptsDrop(detail)) {
      return;
    }

    const target = parseLayerRef(detail.targetId);
    for (const movedId of detail.movedIds) {
      parseLayerRef(movedId).moveOnto(this.#world, target, detail.where);
    }
  }

  #createObject(
    focus: Vector3Like,
    name: string
  ): void {
    const layerName = this.#selection.objectLayer;
    if (layerName === null) {
      return;
    }

    const object = MapObject.create(name, focus);
    this.#world.objectLayers.addObject(layerName, object);
    this.#selection.selectObject(new ObjectRef(layerName, object.id));
  }
}
