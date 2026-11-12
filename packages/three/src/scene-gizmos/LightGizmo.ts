// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  GizmoIcon,
  type GizmoIconGlyph
} from "./GizmoIcon.ts";

export interface LightGizmoOptions {
  /**
   * @default "#f5c46b"
   */
  selectedColor?: THREE.ColorRepresentation;
}

// CONSTANTS
const kDefaultSelectedColor = "#f5c46b";
const kForward = new THREE.Vector3(0, 0, -1);
const kArrowStart = 0.25;
const kArrowLength = 1.2;
const kArrowHead = 0.15;
const kSpotFallbackLength = 2;
const kCircleSegments = 48;
const kTargetPosition = new THREE.Vector3();
const kDirection = new THREE.Vector3();

interface LightShape {
  glyph: GizmoIconGlyph;
  key: string;
  target: THREE.Object3D | null;
  points(): THREE.Vector3[];
}

export class LightGizmo extends THREE.Group {
  readonly #selectedColor: THREE.Color;
  readonly #icon = new GizmoIcon("ambient");
  readonly #shape: THREE.LineSegments<
    THREE.BufferGeometry, THREE.LineBasicMaterial
  >;
  #shapeKey = "";
  #selected = false;
  #lightColor = new THREE.Color();

  constructor(
    options: LightGizmoOptions = {}
  ) {
    super();
    const { selectedColor = kDefaultSelectedColor } = options;

    this.#selectedColor = new THREE.Color(selectedColor);
    this.#shape = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: selectedColor })
    );
    this.#shape.visible = false;
    this.add(this.#icon, this.#shape);
  }

  get selected(): boolean {
    return this.#selected;
  }

  set selected(
    selected: boolean
  ) {
    this.#selected = selected;
    this.#paint();
  }

  update(
    light: THREE.Light
  ): void {
    const shape = lightShape(light);
    this.#icon.glyph = shape.glyph;
    this.#lightColor.copy(light.color);
    this.#paint();

    if (shape.key !== this.#shapeKey) {
      this.#shapeKey = shape.key;
      this.#shape.geometry.dispose();
      this.#shape.geometry = new THREE.BufferGeometry().setFromPoints(
        shape.points()
      );
    }

    light.getWorldPosition(this.position);
    this.#aim(shape.target);
  }

  override dispose(): void {
    this.#shape.geometry.dispose();
    this.#shape.material.dispose();
    this.#icon.dispose();
  }

  #paint(): void {
    this.#icon.color = this.#selected ? this.#selectedColor : this.#lightColor;
    this.#shape.visible = this.#selected;
  }

  #aim(
    target: THREE.Object3D | null
  ): void {
    if (target !== null) {
      target.getWorldPosition(kTargetPosition);
      kDirection.subVectors(kTargetPosition, this.position);
      if (kDirection.lengthSq() > 0) {
        this.quaternion.setFromUnitVectors(kForward, kDirection.normalize());

        return;
      }
    }

    this.quaternion.identity();
  }
}

function lightShape(
  light: THREE.Light
): LightShape {
  if (light instanceof THREE.DirectionalLight) {
    return {
      glyph: "directional",
      key: "directional",
      target: light.target,
      points: arrowPoints
    };
  }
  if (light instanceof THREE.SpotLight) {
    const length = light.distance > 0 ? light.distance : kSpotFallbackLength;
    const { angle } = light;

    return {
      glyph: "spot",
      key: `spot:${length}:${angle}`,
      target: light.target,
      points: () => conePoints(length, angle)
    };
  }
  if (light instanceof THREE.PointLight) {
    const { distance } = light;

    return {
      glyph: "point",
      key: `point:${distance}`,
      target: null,
      points: () => (distance > 0 ? rangePoints(distance) : [])
    };
  }

  const glyph = light instanceof THREE.HemisphereLight ?
    "hemisphere" :
    "ambient";

  return {
    glyph,
    key: glyph,
    target: null,
    points: () => []
  };
}

function arrowPoints(): THREE.Vector3[] {
  const tip = new THREE.Vector3(0, 0, -kArrowLength);
  const neck = -kArrowLength + kArrowHead;

  return [
    new THREE.Vector3(0, 0, -kArrowStart), tip,
    tip, new THREE.Vector3(kArrowHead, 0, neck),
    tip, new THREE.Vector3(-kArrowHead, 0, neck),
    tip, new THREE.Vector3(0, kArrowHead, neck),
    tip, new THREE.Vector3(0, -kArrowHead, neck)
  ];
}

function conePoints(
  length: number,
  angle: number
): THREE.Vector3[] {
  const radius = length * Math.tan(angle);
  const apex = new THREE.Vector3();
  const rim = circlePoints(radius, (x, y) => new THREE.Vector3(x, y, -length));

  return [
    ...rim,
    apex, new THREE.Vector3(radius, 0, -length),
    apex, new THREE.Vector3(-radius, 0, -length),
    apex, new THREE.Vector3(0, radius, -length),
    apex, new THREE.Vector3(0, -radius, -length)
  ];
}

function rangePoints(
  radius: number
): THREE.Vector3[] {
  return [
    ...circlePoints(radius, (x, y) => new THREE.Vector3(x, y, 0)),
    ...circlePoints(radius, (x, y) => new THREE.Vector3(x, 0, y)),
    ...circlePoints(radius, (x, y) => new THREE.Vector3(0, x, y))
  ];
}

function circlePoints(
  radius: number,
  place: (x: number, y: number) => THREE.Vector3
): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  for (let segment = 0; segment < kCircleSegments; segment++) {
    const from = (segment / kCircleSegments) * Math.PI * 2;
    const to = ((segment + 1) / kCircleSegments) * Math.PI * 2;
    points.push(
      place(Math.cos(from) * radius, Math.sin(from) * radius),
      place(Math.cos(to) * radius, Math.sin(to) * radius)
    );
  }

  return points;
}
