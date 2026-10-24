// Import Third-party Dependencies
import type {
  VoxelObjectJSON,
  VoxelWorld
} from "@jolly-pixel/voxel.renderer";
import {
  Box3,
  Vector3,
  type Vector3Like
} from "three";
import type { JollyReparentDetail } from "@jolly-pixel/ui";
import { showConfirm } from "@jolly-pixel/ui/elements/dialog";

// Import Internal Dependencies
import {
  EditorMap,
  type EditorMapSignals
} from "../../map/EditorMap.ts";
import type { MapAccessSource } from "../../access/MapAccess.ts";
import {
  ObjectLayerRef,
  ObjectRef,
  parseLayerRef,
  VoxelLayerRef,
  type EditContext,
  type LayerRef,
  type SelectionStore
} from "../../state/index.ts";
import { collectLayerSelections } from "./layerTree.ts";
import { MapObject } from "./objects/MapObject.ts";
import type {
  AddKind,
  AddLayerResult
} from "./dialogs/AddLayerDialog.ts";
import { MergePlan } from "./MergePlan.ts";

export type ConfirmPrompt = typeof showConfirm;

export interface MapLayersOptions {
  world: VoxelWorld;
  selection: SelectionStore;
  editorMap: EditorMapSignals;
  access: MapAccessSource;
  editContext: Pick<EditContext, "draft" | "subscribe">;
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
  readonly #access: MapAccessSource;
  readonly #confirm: ConfirmPrompt;
  readonly #editContext: Pick<EditContext, "draft">;
  readonly #subscriptions: Array<() => void>;

  constructor(
    options: MapLayersOptions
  ) {
    this.#world = options.world;
    this.#selection = options.selection;
    this.#access = options.access;
    this.#confirm = options.confirm ?? showConfirm;
    this.#editContext = options.editContext;

    const { editorMap, editContext } = options;
    this.#subscriptions = [
      editorMap.subscribe("layerUpdated", this.#reconcileSelection),
      editorMap.subscribe("reset", this.#reconcileSelection),
      editContext.subscribe("change", this.#reconcileSelection)
    ];
    this.#reconcileSelection();
  }

  dispose(): void {
    for (const unsubscribe of this.#subscriptions.splice(0)) {
      unsubscribe();
    }
  }

  canEdit(
    kind: AddKind
  ): boolean {
    return this.#access.current.has(kind === "object" ? "objects" : "layers");
  }

  defaultNames(): Record<AddKind, string> {
    return {
      "voxel-layer": `Layer ${EditorMap.layers(this.#world).length + 1}`,
      "object-layer": `Objects ${this.#world.objectLayers.size + 1}`,
      object: "Object"
    };
  }

  create(
    focus: Vector3Like,
    result: AddLayerResult
  ): void {
    if (!this.canEdit(result.kind)) {
      return;
    }

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
    if (ref instanceof ObjectRef && this.canEdit(ref.kind)) {
      ref.update(this.#world, { name });
    }
  }

  lock(
    ref: LayerRef,
    locked: boolean
  ): void {
    if (ref instanceof ObjectRef && this.canEdit(ref.kind)) {
      ref.update(this.#world, { locked });
    }
  }

  async remove(
    ref: LayerRef
  ): Promise<void> {
    if (!this.canEdit(ref.kind)) {
      return;
    }

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

  bounds(
    ref: LayerRef
  ): Box3 | null {
    switch (ref.kind) {
      case "voxel-layer":
        return this.#world.getLayer(ref.name)?.worldBounds() ?? null;
      case "object-layer":
        return objectBounds(
          this.#world.objectLayers.get(ref.name)?.objects ?? []
        );
      default: {
        const object = ref.objectIn(this.#world);

        return object === undefined ? null : objectBounds([object]);
      }
    }
  }

  clone(
    ref: LayerRef
  ): void {
    if (!this.canEdit(ref.kind)) {
      return;
    }

    const clone = ref.cloneIn(this.#world);
    if (clone !== null) {
      this.#selection.current = clone;
    }
  }

  async mergeInto(
    ref: LayerRef,
    target: string
  ): Promise<void> {
    if (ref.kind !== "voxel-layer" || !this.canEdit(ref.kind)) {
      return;
    }

    const plan = MergePlan.planMerge(this.#world, ref.name);
    if (!plan.targets.includes(target)) {
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
    const moved = detail.movedIds.map(parseLayerRef);
    if (
      !MapLayers.acceptsDrop(detail) ||
      !moved.every((ref) => this.canEdit(ref.kind))
    ) {
      return;
    }

    const target = parseLayerRef(detail.targetId);
    for (const ref of moved) {
      ref.moveOnto(this.#world, target, detail.where);
    }
  }

  moveTo(
    ref: LayerRef,
    objectLayer: string
  ): void {
    if (this.canEdit(ref.kind)) {
      ref.moveOnto(this.#world, new ObjectLayerRef(objectLayer), "inside");
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

  readonly #reconcileSelection = (): void => {
    this.#selection.reconcile(this.#selectable());
  };

  #selectable(): LayerRef[] {
    const { draft } = this.#editContext;
    if (draft === null) {
      return collectLayerSelections(this.#world);
    }

    const layer = this.#world.getLayerById(draft.layerId);

    return layer === undefined ? [] : [new VoxelLayerRef(layer.name)];
  }
}

function objectBounds(
  objects: Iterable<VoxelObjectJSON>
): Box3 | null {
  const bounds = new Box3();
  for (const object of objects) {
    const { position, size } = new MapObject(object).area;
    const min = new Vector3().copy(position);
    bounds.expandByPoint(min).expandByPoint(min.add(size));
  }

  return bounds.isEmpty() ? null : bounds;
}
