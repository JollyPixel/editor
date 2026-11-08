// Import Third-party Dependencies
import {
  type Actor,
  ActorComponent
} from "@jolly-pixel/engine";
import * as THREE from "three";

// Import Internal Dependencies
import { scaleCollider } from "./shapes/scale.ts";
import { outlineGeometry } from "./shapes/outline.ts";
import type { RigidBodySettings } from "./RigidBody.ts";

// CONSTANTS
const kWorldPosition = new THREE.Vector3();
const kWorldRotation = new THREE.Quaternion();
const kWorldScale = new THREE.Vector3();
const kOutlineRenderOrder = 999;
const kSolidColor = 0x4ade80;
const kSensorColor = 0xfbbf24;

export class ColliderOutline extends ActorComponent {
  readonly #root = new THREE.Group();
  readonly #materials = {
    solid: outlineMaterial(kSolidColor),
    sensor: outlineMaterial(kSensorColor)
  };
  readonly #drawnScale = new THREE.Vector3();
  #settings: Readonly<RigidBodySettings>;

  constructor(
    actor: Actor<any>,
    settings: Readonly<RigidBodySettings>
  ) {
    super({
      actor,
      typeName: "ColliderOutline"
    });
    this.#settings = settings;
    this.#root.name = "ColliderOutline";
    actor.node.object3D.add(this.#root);
    this.#rebuild(worldScale(actor));
  }

  get settings(): Readonly<RigidBodySettings> {
    return this.#settings;
  }

  get shown(): boolean {
    return this.#root.visible;
  }

  set shown(
    value: boolean
  ) {
    this.#root.visible = value;
  }

  draw(
    settings: Readonly<RigidBodySettings>
  ): void {
    this.#settings = settings;
    this.#rebuild(worldScale(this.actor));
  }

  update(): void {
    const scale = worldScale(this.actor);
    if (!scale.equals(this.#drawnScale)) {
      this.#rebuild(scale);
    }
  }

  protected override onDestroy(): void {
    this.#root.removeFromParent();
    this.#clear();
    this.#materials.solid.dispose();
    this.#materials.sensor.dispose();
  }

  #rebuild(
    scale: THREE.Vector3
  ): void {
    this.#drawnScale.copy(scale);
    this.#clear();
    if (scale.x === 0 || scale.y === 0 || scale.z === 0) {
      return;
    }

    this.#root.scale.set(1 / scale.x, 1 / scale.y, 1 / scale.z);
    for (const collider of this.#settings.colliders) {
      const lines = new THREE.LineSegments(
        outlineGeometry(scaleCollider(collider, scale)),
        collider.sensor ? this.#materials.sensor : this.#materials.solid
      );
      lines.renderOrder = kOutlineRenderOrder;
      this.#root.add(lines);
    }
  }

  #clear(): void {
    for (const child of this.#root.children) {
      if (child instanceof THREE.LineSegments) {
        child.geometry.dispose();
      }
    }
    this.#root.clear();
  }
}

function worldScale(
  actor: Actor<any>
): THREE.Vector3 {
  actor.transform.global.matrix.decompose(
    kWorldPosition,
    kWorldRotation,
    kWorldScale
  );

  return kWorldScale;
}

function outlineMaterial(
  color: number
): THREE.LineBasicMaterial {
  return new THREE.LineBasicMaterial({
    color,
    depthTest: false,
    transparent: true,
    toneMapped: false
  });
}
