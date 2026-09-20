// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import type { Axis } from "../../common/axes.ts";
import type { ResolvedOutline } from "../appearance.ts";
import type {
  TransformHandle,
  TransformMode
} from "../types.ts";
import {
  handleAxes,
  handleKey
} from "./handleId.ts";
import {
  createVisualMaterial,
  type FrontClip
} from "./materials.ts";
import { createHandleOutline } from "./outline.ts";

// CONSTANTS
const kVisualLayer = 1;
const kMaxDepthRank = 0.9;

export type GizmoHandleState = "idle" | "hovered" | "active";

export interface GizmoView {
  eye: THREE.Vector3;
  cameraQuaternion: THREE.Quaternion;
  hideAligned: boolean;
  flip: boolean;
}

export interface GizmoHandleStyle {
  hoverColor: THREE.ColorRepresentation;
  activeColor: THREE.ColorRepresentation;
  outline: false | ResolvedOutline;
  depthTest: boolean;
  renderOrder: number;
}

export interface GizmoHandleOptions {
  modes: readonly TransformMode[];
  id: TransformHandle;
  geometry: THREE.BufferGeometry;
  pickerGeometry: THREE.BufferGeometry | null;
  borderGeometry?: THREE.BufferGeometry;
  color: THREE.ColorRepresentation;
  style: GizmoHandleStyle;
  opacity?: number;
  layer?: number;
  side?: THREE.Side;
  clip?: FrontClip;
}

type HandleMesh = THREE.Mesh<
  THREE.BufferGeometry,
  THREE.MeshBasicNodeMaterial
>;
type PickerMesh = THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;

export class GizmoHandle extends THREE.Object3D {
  override readonly type: string = "TransformHandle";

  readonly modes: readonly TransformMode[];
  readonly handleId: TransformHandle;
  readonly axes: readonly Axis[];
  readonly picker: PickerMesh | null;

  #visual: HandleMesh;
  #border: HandleMesh | null;
  #outline: HandleMesh | null;
  #visualOrder: number;
  #color: THREE.Color;
  #hoverColor: THREE.Color;
  #activeColor: THREE.Color;
  #state: GizmoHandleState = "idle";
  #disposed = false;

  constructor(
    options: GizmoHandleOptions
  ) {
    super();

    const {
      modes,
      id,
      geometry,
      pickerGeometry,
      borderGeometry,
      color,
      style,
      opacity = 1,
      layer = 0,
      side = THREE.FrontSide,
      clip
    } = options;

    this.modes = modes;
    this.handleId = id;
    this.axes = handleAxes(id);
    this.name = modes.length === 1
      ? `transform-handle-${modes[0]}-${handleKey(id)}`
      : `transform-handle-${handleKey(id)}`;
    this.#color = new THREE.Color(color);
    this.#hoverColor = new THREE.Color(style.hoverColor);
    this.#activeColor = new THREE.Color(style.activeColor);

    this.#visualOrder = style.renderOrder + layer + kVisualLayer;
    this.#visual = new THREE.Mesh(
      geometry,
      createVisualMaterial({
        color: this.#color,
        opacity,
        depthTest: style.depthTest,
        side,
        clip
      })
    );
    this.#visual.name = "transform-handle-visual";
    this.#visual.renderOrder = this.#visualOrder;
    this.#visual.frustumCulled = false;

    this.#border = borderGeometry === undefined
      ? null
      : new THREE.Mesh(
        borderGeometry,
        createVisualMaterial({
          color: this.#color,
          opacity: 1,
          depthTest: style.depthTest,
          side,
          clip
        })
      );

    this.#outline = style.outline === false
      ? null
      : createHandleOutline(geometry, {
        outline: style.outline,
        depthTest: style.depthTest,
        renderOrder: style.renderOrder + layer,
        clip
      });

    this.picker = pickerGeometry === null
      ? null
      : new THREE.Mesh(
        pickerGeometry,
        new THREE.MeshBasicMaterial({
          visible: false,
          side
        })
      );

    if (this.#outline) {
      this.add(this.#outline);
    }
    this.add(this.#visual);
    if (this.#border) {
      this.#border.name = "transform-handle-border";
      this.#border.renderOrder = this.#visualOrder;
      this.#border.frustumCulled = false;
      this.add(this.#border);
    }
    if (this.picker) {
      this.picker.name = "transform-handle-picker";
      this.picker.frustumCulled = false;
      this.add(this.picker);
    }
  }

  get state(): GizmoHandleState {
    return this.#state;
  }

  set state(
    state: GizmoHandleState
  ) {
    if (state === this.#state) {
      return;
    }

    this.#state = state;
    let color = this.#color;
    if (state === "active") {
      color = this.#activeColor;
    }
    else if (state === "hovered") {
      color = this.#hoverColor;
    }
    this.#visual.material.color.copy(color);
    this.#border?.material.color.copy(color);
  }

  orderByDepth(
    rank: number
  ): void {
    const order = this.#visualOrder +
      (THREE.MathUtils.clamp(rank, 0, 1) * kMaxDepthRank);
    this.#visual.renderOrder = order;
    if (this.#border) {
      this.#border.renderOrder = order;
    }
  }

  accepts(
    _worldPoint: THREE.Vector3
  ): boolean {
    return true;
  }

  face(
    _view: GizmoView
  ): boolean {
    return true;
  }

  override dispose(): void {
    if (this.#disposed) {
      return;
    }

    this.#disposed = true;
    this.#visual.geometry.dispose();
    this.#visual.material.dispose();
    this.#border?.geometry.dispose();
    this.#border?.material.dispose();
    this.#outline?.geometry.dispose();
    this.#outline?.material.dispose();
    this.picker?.geometry.dispose();
    this.picker?.material.dispose();
    this.clear();
  }
}
