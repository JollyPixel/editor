// Import Third-party Dependencies
import * as THREE from "three";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import type { OrbitFlyCamera } from "@jolly-pixel/engine";

// Import Internal Dependencies
import type GroupManager from "../groups/GroupManager.ts";
import type { GroupTransformSnapshot } from "../groups/hooks.ts";
import { snapshotTransform } from "../groups/transformCodec.ts";
import { editorState } from "../../app/state/index.ts";

export type GizmoMode = "translate" | "rotate" | "scale";
export type GizmoTarget = "group" | "pivot" | "mesh";
export type GizmoSpace = "world" | "local";

export interface GizmoConfig {
  mode: GizmoMode;
  target: GizmoTarget;
  space?: GizmoSpace;
}

export interface GizmoManagerOptions {
  camera: OrbitFlyCamera;
  canvas: HTMLCanvasElement;
  getSelectedGroup(): GroupManager | null;
  commitTransform(uuid: string): void;
  /** Fires on every frame a drag is in progress, for an optional live preview. */
  onDragProgress?(
    uuid: string,
    transform: GroupTransformSnapshot
  ): void;
  /** True when a remote peer currently holds the transform lock on `uuid`. */
  isRemotelyLocked?(uuid: string): boolean;
  claimTransformLock?(uuid: string): void;
}

export default class GizmoManager {
  #camera: OrbitFlyCamera;
  #getSelectedGroup: () => GroupManager | null;
  #commitTransform: (uuid: string) => void;
  #onDragProgress: ((uuid: string, transform: GroupTransformSnapshot) => void) | undefined;
  #isRemotelyLocked: ((uuid: string) => boolean) | undefined;
  #claimTransformLock: ((uuid: string) => void) | undefined;
  #transformControl: TransformControls;
  #gizmoTarget: GizmoTarget | null = null;
  #dragging = false;

  constructor(options: GizmoManagerOptions) {
    this.#camera = options.camera;
    this.#getSelectedGroup = options.getSelectedGroup;
    this.#commitTransform = options.commitTransform;
    this.#onDragProgress = options.onDragProgress;
    this.#isRemotelyLocked = options.isRemotelyLocked;
    this.#claimTransformLock = options.claimTransformLock;

    this.#transformControl = new TransformControls(this.#camera.threeCamera, options.canvas);
    this.#transformControl.addEventListener("dragging-changed", (event: any) => {
      this.#dragging = event.value;
      this.#camera.enabled = !event.value;

      const group = this.#getSelectedGroup();
      if (event.value) {
        if (group) {
          this.#claimTransformLock?.(group.getGroupUUID());
        }

        return;
      }

      if (group) {
        group.roundTransform();
        this.#commitTransform(group.getGroupUUID());
      }
    });
    this.#transformControl.addEventListener("objectChange", () => {
      const group = this.#getSelectedGroup();
      if (!group) {
        return;
      }

      if (this.#gizmoTarget === "pivot") {
        group.syncMeshToPivot();
      }

      editorState.modelEvents.emit("groupTransformChanged", { group });

      if (this.#dragging) {
        this.#onDragProgress?.(group.getGroupUUID(), snapshotTransform(group));
      }
    });
  }

  public get transformControl(): TransformControls {
    return this.#transformControl;
  }

  public get dragging(): boolean {
    return this.#dragging;
  }

  public setMode(config: GizmoConfig | null): void {
    const group = this.#getSelectedGroup();
    this.#gizmoTarget = config?.target ?? null;

    const locked = group !== null && (this.#isRemotelyLocked?.(group.getGroupUUID()) ?? false);
    if (config === null || group === null || locked) {
      this.#transformControl.enabled = false;
      this.#transformControl.getHelper().visible = false;

      return;
    }

    this.#transformControl.attach(this.#resolveTarget(config.target, group));
    this.#transformControl.setMode(config.mode);
    this.#transformControl.setSpace(config.space ?? "world");
    this.#transformControl.enabled = true;
    this.#transformControl.getHelper().visible = true;
  }

  public setEnabled(enabled: boolean): void {
    this.#transformControl.enabled = enabled;
  }

  #resolveTarget(
    target: GizmoTarget,
    group: GroupManager
  ): THREE.Object3D {
    switch (target) {
      case "pivot":
        return group.getPivot();
      case "mesh":
        return group.getMesh();
      default:
        return group.getGroup();
    }
  }
}
