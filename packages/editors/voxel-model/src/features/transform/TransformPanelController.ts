// Import Third-party Dependencies
import type { ReactiveController, ReactiveControllerHost } from "lit";
import * as THREE from "three";

// Import Internal Dependencies
import type GroupManager from "../groups/GroupManager.ts";
import type { GizmoConfig, GizmoSpace, ModelSceneComponent } from "../../app/ModelSceneComponent.ts";

export type TransformMode = "pos" | "angle" | "size" | "pivot" | "scale";
export type Vector3Value = { x: number; y: number; z: number; };

function gizmoConfigFor(
  mode: TransformMode,
  space: GizmoSpace
): GizmoConfig | null {
  switch (mode) {
    case "pos":
      return { mode: "translate", target: "group", space };
    case "angle":
      return { mode: "rotate", target: "pivot", space };
    case "pivot":
      return { mode: "translate", target: "pivot", space };
    case "scale":
      return { mode: "scale", target: "mesh", space };
    default:
      return null;
  }
}

const kDisplayDecimals = 2;
const kPivotVisibleModes: readonly TransformMode[] = ["pos", "angle", "size", "pivot"];

function roundVector3Value(
  value: Vector3Value
): Vector3Value {
  return {
    x: Number(value.x.toFixed(kDisplayDecimals)),
    y: Number(value.y.toFixed(kDisplayDecimals)),
    z: Number(value.z.toFixed(kDisplayDecimals))
  };
}

export class TransformPanelController implements ReactiveController {
  #host: ReactiveControllerHost;
  #sceneManager: ModelSceneComponent | null = null;
  #selectedGroup: GroupManager | null = null;
  #mode: TransformMode = "pos";
  #space: GizmoSpace = "local";
  #axisValues: Vector3Value = { x: 0, y: 0, z: 0 };

  constructor(host: ReactiveControllerHost) {
    this.#host = host;
    host.addController(this);
  }

  hostConnected(): void {
    document.addEventListener("groupSelected", this.#onGroupSelected);
    document.addEventListener("groupTransformChanged", this.#onGroupTransformChanged);
  }

  hostDisconnected(): void {
    document.removeEventListener("groupSelected", this.#onGroupSelected);
    document.removeEventListener("groupTransformChanged", this.#onGroupTransformChanged);
  }

  public get mode(): TransformMode {
    return this.#mode;
  }

  public get axisValues(): Vector3Value {
    return this.#axisValues;
  }

  public get disabled(): boolean {
    return this.#selectedGroup === null;
  }

  public get space(): GizmoSpace {
    return this.#space;
  }

  public attach(sceneManager: ModelSceneComponent): void {
    this.#sceneManager = sceneManager;
    this.#syncGizmoMode();
  }

  public setMode(mode: TransformMode): void {
    this.#mode = mode;
    this.#syncAxisValues();
    this.#syncGizmoMode();
    this.#syncPivotMarkerVisibility();
    this.#host.requestUpdate();
  }

  public setSpace(space: GizmoSpace): void {
    this.#space = space;
    this.#syncAxisValues();
    this.#syncGizmoMode();
    this.#host.requestUpdate();
  }

  public setAxisValues(value: Vector3Value): void {
    this.#axisValues = value;
    this.#applyAxisValues();
    this.#host.requestUpdate();
  }

  #syncGizmoMode(): void {
    this.#sceneManager?.setGizmoMode(gizmoConfigFor(this.#mode, this.#space));
  }

  #syncPivotMarkerVisibility(): void {
    this.#selectedGroup?.setPivotMarkerVisible(kPivotVisibleModes.includes(this.#mode));
  }

  readonly #onGroupSelected = (
    event: Event
  ): void => {
    const { group } = (event as CustomEvent<{ group: GroupManager | null; }>).detail;
    this.#selectedGroup?.setPivotMarkerVisible(false);
    this.#selectedGroup = group;
    this.#syncAxisValues();
    this.#syncGizmoMode();
    this.#syncPivotMarkerVisibility();
    this.#host.requestUpdate();
  };

  readonly #onGroupTransformChanged = (
    event: Event
  ): void => {
    const { group } = (event as CustomEvent<{ group: GroupManager; }>).detail;
    if (group !== this.#selectedGroup) {
      return;
    }

    this.#axisValues = this.#readAxisValues(this.#selectedGroup, this.#mode);
    this.#host.requestUpdate();
  };

  #syncAxisValues(): void {
    if (!this.#selectedGroup) {
      return;
    }

    this.#axisValues = this.#readAxisValues(this.#selectedGroup, this.#mode);
  }

  #readAxisValues(
    group: GroupManager,
    mode: TransformMode
  ): Vector3Value {
    switch (mode) {
      case "pos":
        return roundVector3Value(
          this.#space === "world" ? group.getPositionWorld() : group.getPosition()
        );
      case "angle": {
        const rotation = this.#space === "world" ? group.getRotationWorld() : group.getRotation();

        return roundVector3Value({
          x: THREE.MathUtils.radToDeg(rotation.x),
          y: THREE.MathUtils.radToDeg(rotation.y),
          z: THREE.MathUtils.radToDeg(rotation.z)
        });
      }
      case "size":
        return roundVector3Value(group.getSize());
      case "pivot":
        return roundVector3Value(
          this.#space === "world" ? group.getPivotOffsetWorld() : group.getPivotOffset()
        );
      case "scale":
        return roundVector3Value(group.getScale());
      default:
        return { x: 0, y: 0, z: 0 };
    }
  }

  #applyAxisValues(): void {
    if (!this.#selectedGroup) {
      return;
    }

    const { x, y, z } = this.#axisValues;

    switch (this.#mode) {
      case "pos":
        if (this.#space === "world") {
          this.#selectedGroup.setPositionWorld(new THREE.Vector3(x, y, z));
        }
        else {
          this.#selectedGroup.setPosition(new THREE.Vector3(x, y, z));
        }
        break;
      case "angle": {
        const rotation = new THREE.Euler(
          THREE.MathUtils.degToRad(x),
          THREE.MathUtils.degToRad(y),
          THREE.MathUtils.degToRad(z)
        );

        if (this.#space === "world") {
          this.#selectedGroup.setRotationWorld(rotation);
        }
        else {
          this.#selectedGroup.setRotation(rotation);
        }
        break;
      }
      case "size":
        this.#selectedGroup.resize(new THREE.Vector3(x, y, z));
        break;
      case "pivot":
        if (this.#space === "world") {
          this.#selectedGroup.setPivotOffsetWorld(new THREE.Vector3(x, y, z));
        }
        else {
          this.#selectedGroup.setPivotOffset(new THREE.Vector3(x, y, z));
        }
        break;
      case "scale":
        this.#selectedGroup.setScale(new THREE.Vector3(x, y, z));
        break;
      default:
        break;
    }
  }
}
