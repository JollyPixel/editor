// Import Third-party Dependencies
import * as THREE from "three";
import { TransformControls } from "three/examples/jsm/Addons.js";

// Import Internal Dependencies
import type GroupManager from "../groups/GroupManager.ts";
import type { FreeFlyCamera } from "../../scene/camera/FreeFlyCamera.ts";

export type GizmoMode = "translate" | "rotate" | "scale";
export type GizmoTarget = "group" | "pivot" | "mesh";
export type GizmoSpace = "world" | "local";

export interface GizmoConfig {
  mode: GizmoMode;
  target: GizmoTarget;
  space?: GizmoSpace;
}

export interface GizmoManagerOptions {
  camera: FreeFlyCamera;
  canvas: HTMLCanvasElement;
  getSelectedGroup(): GroupManager | null;
}

export default class GizmoManager {
  #camera: FreeFlyCamera;
  #getSelectedGroup: () => GroupManager | null;
  #transformControl: TransformControls;
  #gizmoTarget: GizmoTarget | null = null;
  #dragging = false;

  constructor(options: GizmoManagerOptions) {
    this.#camera = options.camera;
    this.#getSelectedGroup = options.getSelectedGroup;

    this.#transformControl = new TransformControls(this.#camera.threeCamera, options.canvas);
    this.#transformControl.addEventListener("dragging-changed", (event: any) => {
      this.#dragging = event.value;
      this.#camera.enabled = !event.value;

      if (!event.value) {
        const group = this.#getSelectedGroup();
        if (group) {
          group.roundTransform();
          document.dispatchEvent(new CustomEvent("groupTransformChanged", { detail: { group } }));
        }
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

      document.dispatchEvent(new CustomEvent("groupTransformChanged", { detail: { group } }));
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

    if (config === null || group === null) {
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
