// Import Third-party Dependencies
import type {
  ReactiveController,
  ReactiveControllerHost
} from "lit";
import * as THREE from "three";

// Import Internal Dependencies
import type {
  ModelBlock,
  ModelChange,
  ModelDocument
} from "../../model/index.ts";
import type {
  GizmoConfig,
  GizmoSpace,
  TransformGizmo
} from "../../scene/index.ts";
import type { TransformLock } from "../../collaboration/index.ts";

// CONSTANTS
const kDisplayDecimals = 2;
const kPivotVisibleModes: readonly TransformMode[] = [
  "pos",
  "angle",
  "size",
  "pivot"
];

export type TransformMode =
  | "pos"
  | "angle"
  | "size"
  | "pivot"
  | "scale";

export interface TransformWorkspace {
  document: ModelDocument;
  gizmo: TransformGizmo;
  lock: TransformLock;
}

export class TransformPanelController implements ReactiveController {
  #host: ReactiveControllerHost;
  #workspace: TransformWorkspace | null = null;
  #subscriptions: Array<() => void> = [];
  #selected: ModelBlock | null = null;
  #mode: TransformMode = "pos";
  #space: GizmoSpace = "local";
  #axisValues: THREE.Vector3Like = {
    x: 0,
    y: 0,
    z: 0
  };

  #onSelect = (
    block: ModelBlock | null
  ): void => {
    if (this.#selected !== null) {
      this.#selected.pivotMarkerVisible = false;
    }
    this.#selected = block;
    this.#syncAxisValues();
    this.#syncPivotMarkerVisibility();
    this.#host.requestUpdate();
  };

  #onChange = (
    change: ModelChange
  ): void => {
    const { command } = change;
    if (
      command.action === "group-transformed" &&
      command.uuid === this.#selected?.uuid
    ) {
      this.#refresh(this.#selected);
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
    host.addController(this);
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
    this.#unsubscribe();
    this.#workspace = workspace;
    this.#subscribe();
    this.#onSelect(workspace.document.blocks.selected);
    this.#syncGizmo();
  }

  hostConnected(): void {
    this.#subscribe();
  }

  hostDisconnected(): void {
    this.#unsubscribe();
  }

  #subscribe(): void {
    const workspace = this.#workspace;
    if (
      workspace === null ||
      this.#subscriptions.length > 0
    ) {
      return;
    }

    const { document, gizmo, lock } = workspace;
    document.blocks.on("select", this.#onSelect);
    document.on("change", this.#onChange);
    gizmo.on("change", this.#refresh);
    this.#subscriptions = [
      () => document.blocks.off("select", this.#onSelect),
      () => document.off("change", this.#onChange),
      () => gizmo.off("change", this.#refresh),
      lock.subscribe("change", this.#onLockChange)
    ];
  }

  #unsubscribe(): void {
    for (const unsubscribe of this.#subscriptions.splice(0)) {
      unsubscribe();
    }
  }

  #syncGizmo(): void {
    this.#workspace?.gizmo.configure(
      gizmoConfigFor(this.#mode, this.#space)
    );
  }

  #syncPivotMarkerVisibility(): void {
    if (this.#selected !== null) {
      this.#selected.pivotMarkerVisible = kPivotVisibleModes.includes(
        this.#mode
      );
    }
  }

  #syncAxisValues(): void {
    if (this.#selected !== null) {
      this.#axisValues = readAxisValues(
        this.#selected,
        this.#mode,
        this.#space
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
    const world = this.#space === "world";

    switch (this.#mode) {
      case "pos":
        if (world) {
          block.worldPosition = new THREE.Vector3(x, y, z);
        }
        else {
          block.position = new THREE.Vector3(x, y, z);
        }
        break;
      case "angle": {
        const rotation = new THREE.Euler(
          THREE.MathUtils.degToRad(x),
          THREE.MathUtils.degToRad(y),
          THREE.MathUtils.degToRad(z)
        );
        if (world) {
          block.worldRotation = rotation;
        }
        else {
          block.rotation = rotation;
        }
        break;
      }
      case "size":
        block.resize(new THREE.Vector3(x, y, z));
        break;
      case "pivot":
        if (world) {
          block.worldPivotOffset = new THREE.Vector3(x, y, z);
        }
        else {
          block.pivotOffset = new THREE.Vector3(x, y, z);
        }
        break;
      case "scale":
        block.scale = new THREE.Vector3(x, y, z);
        break;
      default:
        break;
    }

    workspace.document.blocks.commitTransform(block.uuid);
  }
}

function gizmoConfigFor(
  mode: TransformMode,
  space: GizmoSpace
): GizmoConfig | null {
  switch (mode) {
    case "pos":
      return {
        mode: "translate",
        target: "group",
        space
      };
    case "angle":
      return {
        mode: "rotate",
        target: "pivot",
        space
      };
    case "pivot":
      return {
        mode: "translate",
        target: "pivot",
        space
      };
    case "scale":
      return {
        mode: "scale",
        target: "mesh",
        space
      };
    default:
      return null;
  }
}

function readAxisValues(
  block: ModelBlock,
  mode: TransformMode,
  space: GizmoSpace
): THREE.Vector3Like {
  const world = space === "world";

  switch (mode) {
    case "pos":
      return roundVector3(
        world ? block.worldPosition : block.position
      );
    case "angle": {
      const rotation = world
        ? block.worldRotation
        : block.rotation;

      return roundVector3({
        x: THREE.MathUtils.radToDeg(rotation.x),
        y: THREE.MathUtils.radToDeg(rotation.y),
        z: THREE.MathUtils.radToDeg(rotation.z)
      });
    }
    case "size":
      return roundVector3(block.size);
    case "pivot":
      return roundVector3(
        world ? block.worldPivotOffset : block.pivotOffset
      );
    case "scale":
      return roundVector3(block.scale);
    default:
      return { x: 0, y: 0, z: 0 };
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
