// Import Third-party Dependencies
import type { ReactiveControllerHost } from "lit";
import * as THREE from "three";
import type {
  ModelChange,
  ModelDocument
} from "@jolly-pixel/asset.voxel-model/client";

// Import Internal Dependencies
import type {
  ModelBlock,
  ModelBlocks
} from "../../scene/index.ts";
import type { BlockSelectionStore } from "../../state/index.ts";
import type {
  GizmoSpace,
  TransformGizmo,
  TransformLock,
  TransformMode
} from "./index.ts";
import { TRANSFORM_MODES } from "./transformModes.ts";
import { WorkspaceController } from "../../shared/WorkspaceController.ts";

// CONSTANTS
const kDisplayDecimals = 2;

export interface TransformWorkspace {
  document: ModelDocument;
  blocks: ModelBlocks;
  selection: BlockSelectionStore;
  gizmo: TransformGizmo;
  lock: TransformLock;
}

export class TransformPanelController {
  #host: ReactiveControllerHost;
  #connection: WorkspaceController<TransformWorkspace>;
  #selected: ModelBlock | null = null;
  #mode: TransformMode = "pos";
  #space: GizmoSpace = "local";
  #axisValues: THREE.Vector3Like = {
    x: 0,
    y: 0,
    z: 0
  };

  #onSelect = (
    uuid: string | null
  ): void => {
    if (this.#selected !== null) {
      this.#selected.pivotMarkerVisible = false;
    }
    this.#selected = uuid === null ? null : this.#workspace?.blocks.get(uuid) ?? null;
    this.#syncAxisValues();
    this.#syncPivotMarkerVisibility();
    this.#host.requestUpdate();
  };

  #onChange = (
    change: ModelChange
  ): void => {
    const selected = this.#selected;
    if (selected !== null && rewritesTransformOf(change, selected.uuid)) {
      this.#refresh(selected);
    }
  };

  #refresh = (
    block: ModelBlock
  ): void => {
    if (block === this.#selected) {
      this.#syncAxisValues();
      this.#host.requestUpdate();
    }
  };

  #onLockChange = (): void => {
    this.#host.requestUpdate();
  };

  constructor(
    host: ReactiveControllerHost
  ) {
    this.#host = host;
    this.#connection = new WorkspaceController(
      host,
      (workspace) => this.#subscribeTo(workspace)
    );
  }

  get #workspace(): TransformWorkspace | null {
    return this.#connection.current;
  }

  get mode(): TransformMode {
    return this.#mode;
  }

  set mode(
    mode: TransformMode
  ) {
    this.#mode = mode;
    this.#syncAxisValues();
    this.#syncGizmo();
    this.#syncPivotMarkerVisibility();
    this.#host.requestUpdate();
  }

  get space(): GizmoSpace {
    return this.#space;
  }

  set space(
    space: GizmoSpace
  ) {
    this.#space = space;
    this.#syncAxisValues();
    this.#syncGizmo();
    this.#host.requestUpdate();
  }

  get axisValues(): THREE.Vector3Like {
    return this.#axisValues;
  }

  set axisValues(
    value: THREE.Vector3Like
  ) {
    this.#axisValues = value;
    this.#applyAxisValues();
    this.#host.requestUpdate();
  }

  get disabled(): boolean {
    return this.#selected === null ||
      (this.#workspace?.lock.lockedBy(this.#selected.uuid) ?? null) !== null;
  }

  attach(
    workspace: TransformWorkspace
  ): void {
    this.#connection.attach(workspace);
    this.#onSelect(workspace.selection.selected);
    this.#syncGizmo();
  }

  #subscribeTo(
    workspace: TransformWorkspace
  ): Array<() => void> {
    const {
      document,
      selection,
      gizmo,
      lock
    } = workspace;
    selection.on("select", this.#onSelect);
    document.on("change", this.#onChange);
    gizmo.on("change", this.#refresh);

    return [
      () => selection.off("select", this.#onSelect),
      () => document.off("change", this.#onChange),
      () => gizmo.off("change", this.#refresh),
      lock.subscribe("change", this.#onLockChange)
    ];
  }

  #syncGizmo(): void {
    this.#workspace?.gizmo.configure(this.#mode, this.#space);
  }

  #syncPivotMarkerVisibility(): void {
    if (this.#selected !== null) {
      this.#selected.pivotMarkerVisible = TRANSFORM_MODES[this.#mode].showsPivot;
    }
  }

  #syncAxisValues(): void {
    if (this.#selected !== null) {
      this.#axisValues = roundVector3(
        TRANSFORM_MODES[this.#mode].read(this.#selected, this.#space === "world")
      );
    }
  }

  #applyAxisValues(): void {
    const block = this.#selected;
    const workspace = this.#workspace;
    if (
      block === null ||
      workspace === null ||
      workspace.lock.lockedBy(block.uuid) !== null
    ) {
      return;
    }

    const { x, y, z } = this.#axisValues;
    TRANSFORM_MODES[this.#mode].write(
      block,
      new THREE.Vector3(x, y, z),
      this.#space === "world"
    );

    workspace.blocks.commitTransform(block.uuid);
  }
}

function rewritesTransformOf(
  change: ModelChange,
  uuid: string
): boolean {
  const { command } = change;
  switch (command.action) {
    case "node-transformed":
      return command.id === uuid;
    case "node-moved":
      return command.transforms.some(({ id }) => id === uuid);
    default:
      return false;
  }
}

function roundVector3(
  value: THREE.Vector3Like
): THREE.Vector3Like {
  return {
    x: Number(value.x.toFixed(kDisplayDecimals)),
    y: Number(value.y.toFixed(kDisplayDecimals)),
    z: Number(value.z.toFixed(kDisplayDecimals))
  };
}
