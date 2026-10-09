// Import Third-party Dependencies
import type * as THREE from "three";
import { Emitter } from "@openally/emitt";
import type { OrbitFlyCamera } from "@jolly-pixel/engine";
import type { BlockTransformJSON } from "@jolly-pixel/asset.voxel-model/client";
import {
  TransformControls,
  type TransformControlsOptions
} from "@jolly-pixel/three";

// Import Internal Dependencies
import type {
  ModelBlock,
  ModelBlocks
} from "../../../scene/blocks/index.ts";
import type { BlockSelectionStore } from "../../../state/index.ts";
import type {
  TransformLiveSync,
  TransformLock
} from "../collaboration/index.ts";
import {
  nodeTool,
  pivotTool,
  resizeTool,
  type GizmoTool,
  type TransformMode
} from "./gizmoTools.ts";
import { TRANSFORM_MODES } from "../transformModes.ts";
import type {
  TransformTarget,
  TransformTool
} from "../TransformTool.ts";
import { RenderOrder } from "../../../scene/renderOrder.ts";

// CONSTANTS
const kAppearance = {
  size: 0.1,
  center: {
    interactive: true
  },
  planes: {
    inset: 0.065,
    size: 0.30
  },
  rings: {
    frontOnly: false
  },
  flipTowardCamera: true,
  viewRing: false,
  outline: {
    color: "#292a2c",
    width: 2.5
  },
  renderOrder: RenderOrder.gizmo
} as const satisfies TransformControlsOptions["appearance"];

export interface TransformGizmoOptions {
  camera: OrbitFlyCamera;
  canvas: HTMLCanvasElement;
  scene: THREE.Object3D;
  blocks: ModelBlocks;
  selection: BlockSelectionStore;
  lock: TransformLock;
  live: Pick<TransformLiveSync, "publish" | "clear">;
  tool: TransformTool;
}

interface GizmoDrag {
  start: BlockTransformJSON;
  target: TransformTarget;
}

export type TransformGizmoEvents = {
  change: (block: ModelBlock) => void;
};

export class TransformGizmo extends Emitter<TransformGizmoEvents> {
  #camera: OrbitFlyCamera;
  #blocks: ModelBlocks;
  #selection: BlockSelectionStore;
  #lock: TransformLock;
  #live: TransformGizmoOptions["live"];
  #tools: Readonly<Record<TransformMode, GizmoTool>>;
  #controls: readonly TransformControls[];
  #tool: TransformTool;
  #enabled = true;
  #pivotBlock: ModelBlock | null = null;
  #drag: GizmoDrag | null = null;

  #onStart = (): void => {
    const block = this.#selectedBlock();
    if (block === null) {
      return;
    }

    const { target } = this.#tool;
    this.#drag = {
      start: block.transform,
      target
    };
    this.#camera.enabled = false;
    target.begin?.(block);
  };

  #onChange = (): void => {
    const block = this.#selectedBlock();
    if (block === null) {
      return;
    }

    if (this.#drag !== null) {
      this.#activeTool().apply(block, this.#drag.start);
      this.#live.publish(block.uuid, block.transform);
    }
    this.emit("change", block);
  };

  #onEnd = (): void => {
    const drag = this.#drag;
    this.#drag = null;
    this.#camera.enabled = true;

    if (drag !== null) {
      const block = this.#selectedBlock();
      if (block !== null) {
        block.roundTransform();
        drag.target.end(block);
      }
      this.#live.clear();
    }
    this.#activeTool().reset();
  };

  #sync = (): void => {
    const block = this.#selectedBlock();
    this.#syncPivotMarker(block);
    const active = !this.#enabled ||
      block === null ||
      this.#lock.lockedBy(block.uuid) !== null ?
      null :
      this.#activeTool();

    for (const tool of Object.values(this.#tools)) {
      if (tool !== active) {
        tool.detach();
      }
    }
    for (const controls of this.#controls) {
      if (controls !== active?.controls) {
        controls.enabled = false;
        controls.detach();
      }
    }
    if (active === null || block === null) {
      return;
    }

    active.controls.mode = active.mode;
    active.controls.orientation = active.orientation(this.#tool.space);
    active.controls.attach(active.attach(block));
    active.controls.enabled = true;
  };

  constructor(
    options: TransformGizmoOptions
  ) {
    super();
    this.#camera = options.camera;
    this.#blocks = options.blocks;
    this.#selection = options.selection;
    this.#lock = options.lock;
    this.#live = options.live;
    this.#tool = options.tool;

    const controls = createControls(options);
    const pivotControls = createControls(options, { handle: { kind: "sphere" } });
    const resizeControls = createControls(options, { scaleHandle: { kind: "slab" } });

    this.#tools = {
      pos: nodeTool(controls, "translate", (space) => (space === "local" ? "parent" : "world")),
      angle: nodeTool(controls, "rotate"),
      scale: nodeTool(controls, "scale"),
      size: resizeTool(resizeControls),
      pivot: pivotTool(pivotControls, options.scene)
    };
    this.#controls = [...new Set(Object.values(this.#tools).map((tool) => tool.controls))];

    for (const each of this.#controls) {
      options.scene.add(each.helper);
      each.addEventListener("start", this.#onStart);
      each.addEventListener("change", this.#onChange);
      each.addEventListener("end", this.#onEnd);
    }
    this.#selection.on("select", this.#sync);
    this.#lock.on("change", this.#sync);
    this.#tool.on("change", this.#sync);
    this.#sync();
  }

  get dragging(): boolean {
    return this.#drag !== null;
  }

  get activeControls(): TransformControls {
    return this.#activeTool().controls;
  }

  get enabled(): boolean {
    return this.#enabled;
  }

  set enabled(
    enabled: boolean
  ) {
    if (enabled === this.#enabled) {
      return;
    }

    this.#enabled = enabled;
    this.#sync();
  }

  dispose(): void {
    this.#selection.off("select", this.#sync);
    this.#lock.off("change", this.#sync);
    this.#tool.off("change", this.#sync);
    for (const tool of Object.values(this.#tools)) {
      tool.detach();
    }
    for (const each of this.#controls) {
      each.removeEventListener("start", this.#onStart);
      each.removeEventListener("change", this.#onChange);
      each.removeEventListener("end", this.#onEnd);
      each.helper.removeFromParent();
      each.dispose();
    }
  }

  #selectedBlock(): ModelBlock | null {
    const uuid = this.#selection.selected;

    return uuid === null ? null : this.#blocks.get(uuid) ?? null;
  }

  #activeTool(): GizmoTool {
    return this.#tools[this.#tool.mode];
  }

  #syncPivotMarker(
    selected: ModelBlock | null
  ): void {
    const block = this.#enabled && TRANSFORM_MODES[this.#tool.mode].showsPivot ?
      selected :
      null;
    if (this.#pivotBlock !== null && this.#pivotBlock !== block) {
      this.#pivotBlock.pivotMarkerVisible = false;
    }
    if (block !== null) {
      block.pivotMarkerVisible = true;
    }
    this.#pivotBlock = block;
  }
}

function createControls(
  options: TransformGizmoOptions,
  appearance: TransformControlsOptions["appearance"] = {}
): TransformControls {
  return new TransformControls(
    options.camera.threeCamera,
    options.canvas,
    { appearance: { ...kAppearance, ...appearance } }
  );
}
