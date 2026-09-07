// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { screenScaleFactor } from "../common/screenScaleFactor.ts";
import { createTranslationHandleGeometry } from "./geometry.ts";
import { TranslationCenter } from "./TranslationCenter.ts";
import { TranslationHandle } from "./TranslationHandle.ts";
import type {
  TranslationAxis,
  TranslationAxisAppearance,
  TranslationAxisAppearanceOptions,
  TranslationDirection,
  TranslationDirectionPolicy,
  TranslationGizmoAppearanceOptions,
  TranslationHandleOptions,
  TranslationOutlineOptions,
  TranslationSpace
} from "./types.ts";

// CONSTANTS
const kAxes: readonly TranslationAxis[] = ["x", "y", "z"];
const kDefaultSize = 0.05;
const kDefaultGap = 0.15;
const kDefaultPickerRadius = 0.28;
const kDefaultPickerLengthScale = 1;
const kDefaultRenderOrder = 20;
const kDefaultCenterColor = "#ffffff";
const kDefaultCenterRadius = 0.13;
const kDefaultCenterSegments = 16;
const kDefaultHandle: TranslationHandleOptions = { kind: "arrow" };
const kDefaultDirections: TranslationDirectionPolicy = "positive";
const kDefaultHoverColor = "#ffd452";
const kDefaultActiveColor = "#ffd452";
const kDefaultOutline: Required<TranslationOutlineOptions> = {
  color: "#080b11",
  opacity: 1,
  scale: 1.18
};
const kAxisColor: Record<TranslationAxis, THREE.ColorRepresentation> = {
  x: "#ff6b6b",
  y: "#7ee787",
  z: "#6fb3ff"
};
const kAxisDirection: Record<TranslationAxis, THREE.Vector3> = {
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 1, 0),
  z: new THREE.Vector3(0, 0, 1)
};
const kUpDirection = new THREE.Vector3(0, 1, 0);
const kIdentityQuaternion = new THREE.Quaternion();

const _desiredMatrix = new THREE.Matrix4();
const _desiredQuaternion = new THREE.Quaternion();
const _desiredScale = new THREE.Vector3();
const _handleDirection = new THREE.Vector3();
const _parentInverse = new THREE.Matrix4();
const _targetPosition = new THREE.Vector3();

export interface TranslationHandleTarget {
  axis: TranslationAxis;
  direction: TranslationDirection;
}

interface ResolvedAppearance {
  size: number;
  gap: number;
  pickerRadius: number;
  pickerLengthScale: number;
  hoverColor: THREE.ColorRepresentation;
  activeColor: THREE.ColorRepresentation;
  outline: false | Required<TranslationOutlineOptions>;
  depthTest: boolean;
  renderOrder: number;
}

/**
 * Camera-scaled visual helper and picker collection.
 */
export class TranslationGizmo extends THREE.Object3D {
  override readonly type = "TranslationGizmo";

  #camera: THREE.Camera;
  #target: THREE.Object3D | null = null;
  #space: TranslationSpace = "world";
  #appearance: ResolvedAppearance;
  #handles: TranslationHandle[] = [];
  #center: TranslationCenter | null = null;
  #handleByPicker = new Map<THREE.Object3D, TranslationHandle>();
  #hovered: TranslationHandle | null = null;
  #active: TranslationHandle | null = null;
  #worldScale = 0;
  #disposed = false;

  constructor(
    camera: THREE.Camera,
    options: TranslationGizmoAppearanceOptions = {}
  ) {
    super();

    this.#camera = camera;
    this.#appearance = resolveAppearance(options);
    this.name = "translation-gizmo";
    this.matrixAutoUpdate = false;
    this.visible = false;

    for (const axis of kAxes) {
      const axisAppearance = options.axes?.[axis];
      if (axisAppearance === false) {
        continue;
      }

      this.#createAxisHandles(
        axis,
        axisAppearance,
        options
      );
    }

    if (options.center !== undefined && options.center !== false) {
      const centerOutline = options.center.outline === undefined
        ? this.#appearance.outline
        : resolveOutline(options.center.outline);
      this.#center = new TranslationCenter({
        color: options.center.color ?? kDefaultCenterColor,
        radius: positive(
          options.center.radius ?? kDefaultCenterRadius,
          "center.radius"
        ),
        radialSegments: segments(
          options.center.radialSegments ?? kDefaultCenterSegments,
          "center.radialSegments"
        ),
        outline: centerOutline,
        depthTest: this.#appearance.depthTest,
        renderOrder: this.#appearance.renderOrder
      });
      this.add(this.#center);
    }
  }

  get target(): THREE.Object3D | null {
    return this.#target;
  }

  get hoveredAxis(): TranslationAxis | null {
    return this.#hovered?.axis ?? null;
  }

  get activeAxis(): TranslationAxis | null {
    return this.#active?.axis ?? null;
  }

  setTarget(
    target: THREE.Object3D | null
  ): void {
    this.#target = target;
    this.visible = target !== null;
    if (target === null) {
      this.hover(null);
      this.activate(null);
    }
  }

  setSpace(
    space: TranslationSpace
  ): void {
    this.#space = space;
  }

  hover(
    target: TranslationHandleTarget | null
  ): void {
    const handle = this.#findHandle(target);
    if (handle === this.#hovered) {
      return;
    }

    this.#hovered = handle;
    this.#paintStates();
  }

  activate(
    target: TranslationHandleTarget | null
  ): void {
    const handle = this.#findHandle(target);
    if (handle === this.#active) {
      return;
    }

    this.#active = handle;
    this.#paintStates();
  }

  pick(
    raycaster: THREE.Raycaster
  ): TranslationHandleTarget | null {
    if (this.#target === null || !this.visible) {
      return null;
    }

    const distance = raycaster.ray.distanceToPoint(_targetPosition);
    if (
      distance < this.#worldScale * this.#appearance.gap
    ) {
      return null;
    }

    const pickers = this.#handles
      .filter((handle) => handle.visible)
      .map((handle) => handle.picker);
    const intersections = raycaster.intersectObjects(pickers, false);
    if (intersections.length === 0) {
      return null;
    }

    const handle = this.#handleByPicker.get(intersections[0].object);
    if (handle === undefined) {
      return null;
    }

    return {
      axis: handle.axis,
      direction: handle.direction
    };
  }

  override updateMatrixWorld(
    force?: boolean
  ): void {
    const target = this.#target;
    if (target === null) {
      super.updateMatrixWorld(force);

      return;
    }

    target.updateWorldMatrix(true, false);
    this.#camera.updateWorldMatrix(true, false);
    target.getWorldPosition(_targetPosition);
    if (this.#space === "local") {
      target.getWorldQuaternion(_desiredQuaternion);
    }
    else {
      _desiredQuaternion.copy(kIdentityQuaternion);
    }

    this.#worldScale = screenScaleFactor(
      this.#camera,
      _targetPosition
    ) * this.#appearance.size;
    _desiredScale.setScalar(this.#worldScale);
    _desiredMatrix.compose(
      _targetPosition,
      _desiredQuaternion,
      _desiredScale
    );

    if (this.parent === null) {
      this.matrix.copy(_desiredMatrix);
    }
    else {
      _parentInverse.copy(this.parent.matrixWorld).invert();
      this.matrix.multiplyMatrices(_parentInverse, _desiredMatrix);
    }

    super.updateMatrixWorld(force);
  }

  dispose(): void {
    if (this.#disposed) {
      return;
    }

    this.#disposed = true;
    for (const handle of this.#handles.splice(0)) {
      handle.dispose();
    }
    this.#center?.dispose();
    this.#center = null;
    this.#handleByPicker.clear();
    this.clear();
  }

  #createAxisHandles(
    axis: TranslationAxis,
    axisAppearance: TranslationAxisAppearance | undefined,
    options: TranslationGizmoAppearanceOptions
  ): void {
    const overrides: TranslationAxisAppearanceOptions =
      axisAppearance === false || axisAppearance === undefined
        ? {}
        : axisAppearance;
    const directions = resolveDirections(
      overrides.directions ?? options.directions ?? kDefaultDirections
    );
    const handleOptions = overrides.handle ?? options.handle ?? kDefaultHandle;

    for (const direction of directions) {
      const { geometry, length } = createTranslationHandleGeometry(
        handleOptions
      );
      const handle = new TranslationHandle({
        axis,
        direction,
        geometry,
        length,
        color: overrides.color ?? kAxisColor[axis],
        hoverColor: this.#appearance.hoverColor,
        activeColor: this.#appearance.activeColor,
        outline: this.#appearance.outline,
        pickerRadius: this.#appearance.pickerRadius,
        pickerLengthScale: this.#appearance.pickerLengthScale,
        depthTest: this.#appearance.depthTest,
        renderOrder: this.#appearance.renderOrder
      });

      _handleDirection
        .copy(kAxisDirection[axis])
        .multiplyScalar(direction);
      handle.position
        .copy(_handleDirection)
        .multiplyScalar(this.#appearance.gap);
      handle.quaternion.setFromUnitVectors(
        kUpDirection,
        _handleDirection
      );

      this.#handles.push(handle);
      this.#handleByPicker.set(handle.picker, handle);
      this.add(handle);
    }
  }

  #findHandle(
    target: TranslationHandleTarget | null
  ): TranslationHandle | null {
    if (target === null) {
      return null;
    }

    return this.#handles.find(
      (handle) => handle.axis === target.axis &&
        handle.direction === target.direction
    ) ?? null;
  }

  #paintStates(): void {
    for (const handle of this.#handles) {
      if (handle === this.#active) {
        handle.state = "active";
      }
      else if (handle === this.#hovered) {
        handle.state = "hovered";
      }
      else {
        handle.state = "idle";
      }
    }
  }
}

function resolveAppearance(
  options: TranslationGizmoAppearanceOptions
): ResolvedAppearance {
  return {
    size: positive(options.size ?? kDefaultSize, "size"),
    gap: nonNegative(options.gap ?? kDefaultGap, "gap"),
    pickerRadius: positive(
      options.picker?.radius ?? kDefaultPickerRadius,
      "picker.radius"
    ),
    pickerLengthScale: positive(
      options.picker?.lengthScale ?? kDefaultPickerLengthScale,
      "picker.lengthScale"
    ),
    hoverColor: options.hoverColor ?? kDefaultHoverColor,
    activeColor: options.activeColor ?? kDefaultActiveColor,
    outline: resolveOutline(options.outline),
    depthTest: options.depthTest ?? false,
    renderOrder: finite(
      options.renderOrder ?? kDefaultRenderOrder,
      "renderOrder"
    )
  };
}

function resolveOutline(
  options: false | TranslationOutlineOptions | undefined
): false | Required<TranslationOutlineOptions> {
  if (options === false) {
    return false;
  }

  return {
    color: options?.color ?? kDefaultOutline.color,
    opacity: normalizedOpacity(
      options?.opacity ?? kDefaultOutline.opacity
    ),
    scale: greaterThan(
      options?.scale ?? kDefaultOutline.scale,
      1,
      "outline.scale"
    )
  };
}

function resolveDirections(
  policy: TranslationDirectionPolicy
): readonly TranslationDirection[] {
  if (policy === "positive") {
    return [1];
  }
  if (policy === "negative") {
    return [-1];
  }

  return [1, -1];
}

function positive(
  value: number,
  label: string
): number {
  return greaterThan(value, 0, label);
}

function nonNegative(
  value: number,
  label: string
): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`Translation gizmo ${label} cannot be negative`);
  }

  return value;
}

function greaterThan(
  value: number,
  lowerBound: number,
  label: string
): number {
  if (!Number.isFinite(value) || value <= lowerBound) {
    throw new RangeError(
      `Translation gizmo ${label} must be greater than ${lowerBound}`
    );
  }

  return value;
}

function normalizedOpacity(
  value: number
): number {
  if (!Number.isFinite(value)) {
    throw new RangeError("Translation gizmo outline.opacity must be finite");
  }

  return THREE.MathUtils.clamp(value, 0, 1);
}

function segments(
  value: number,
  label: string
): number {
  if (!Number.isInteger(value) || value < 3) {
    throw new RangeError(
      `Translation gizmo ${label} must be an integer of at least 3`
    );
  }

  return value;
}

function finite(
  value: number,
  label: string
): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`Translation gizmo ${label} must be finite`);
  }

  return value;
}
