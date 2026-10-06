// Import Third-party Dependencies
import type { ReactiveControllerHost } from "lit";
import * as THREE from "three";
import { SubscriptionController } from "@jolly-pixel/ui";

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
import type { TransformTool } from "./TransformTool.ts";
import { TRANSFORM_MODES } from "./transformModes.ts";

// CONSTANTS
const kDisplayDecimals = 2;

export interface TransformWorkspace {
  blocks: ModelBlocks;
  selection: BlockSelectionStore;
  gizmo: TransformGizmo;
  lock: TransformLock;
  tool: TransformTool;
}

export class TransformPanelController {
  #host: ReactiveControllerHost;
  #connection: SubscriptionController<TransformWorkspace>;
  #selected: ModelBlock | null = null;
  #axisValues: THREE.Vector3Like = {
    x: 0,
    y: 0,
    z: 0
  };

  #onSelect = (
    uuid: string | null
  ): void => {
    this.#selected = uuid === null ? null : this.#workspace?.blocks.get(uuid) ?? null;
    this.#refresh();
  };

  #onTransformApplied = (
    uuid: string
  ): void => {
    if (uuid === this.#selected?.uuid) {
      this.#refresh();
    }
  };

  #onGizmoChange = (
    block: ModelBlock
  ): void => {
    if (block === this.#selected) {
      this.#refresh();
    }
  };

  #refresh = (): void => {
    this.#syncAxisValues();
    this.#host.requestUpdate();
  };

  constructor(
    host: ReactiveControllerHost
  ) {
    this.#host = host;
    this.#connection = new SubscriptionController(
      host,
      (workspace) => this.#subscribeTo(workspace)
    );
  }

  get #workspace(): TransformWorkspace | null {
    return this.#connection.current;
  }

  get modes(): readonly TransformMode[] {
    return this.#workspace?.tool.target.modes ?? [];
  }

  get mode(): TransformMode {
    return this.#workspace?.tool.mode ?? "pos";
  }

  set mode(
    mode: TransformMode
  ) {
    if (this.#workspace !== null) {
      this.#workspace.tool.mode = mode;
    }
  }

  get space(): GizmoSpace {
    return this.#workspace?.tool.space ?? "local";
  }

  set space(
    space: GizmoSpace
  ) {
    if (this.#workspace !== null) {
      this.#workspace.tool.space = space;
    }
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
  }

  #subscribeTo(
    workspace: TransformWorkspace
  ): Array<() => void> {
    const {
      blocks,
      selection,
      gizmo,
      lock,
      tool
    } = workspace;

    return [
      selection.subscribe("select", this.#onSelect),
      blocks.subscribe("transformApplied", this.#onTransformApplied),
      gizmo.subscribe("change", this.#onGizmoChange),
      tool.subscribe("change", this.#refresh),
      lock.subscribe("change", this.#refresh)
    ];
  }

  #syncAxisValues(): void {
    if (this.#selected !== null) {
      this.#axisValues = roundVector3(
        TRANSFORM_MODES[this.mode].read(this.#selected, this.space === "world")
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
    TRANSFORM_MODES[this.mode].write(
      block,
      new THREE.Vector3(x, y, z),
      this.space === "world"
    );

    workspace.tool.target.commit(block);
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
