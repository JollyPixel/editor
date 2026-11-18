// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { ActorComponent } from "../../../core/actor/ActorComponent.ts";
import type { Actor } from "../../../core/actor/Actor.ts";
import type { AudioZoneSettings } from "./AudioZoneComponent.ts";
import { AudioZoneShape } from "./AudioZoneShape.ts";

// CONSTANTS
const kOutlineRenderOrder = 999;

export class AudioZoneOutline extends ActorComponent {
  readonly #material = new THREE.LineBasicMaterial({
    depthTest: false,
    transparent: true,
    toneMapped: false
  });
  readonly #lines: THREE.LineSegments;
  #settings: Readonly<AudioZoneSettings>;

  constructor(
    actor: Actor<any>,
    settings: Readonly<AudioZoneSettings>
  ) {
    super({
      actor,
      typeName: "AudioZoneOutline"
    });

    this.#settings = settings;
    this.#material.color.set(settings.color);
    this.#lines = new THREE.LineSegments(
      new AudioZoneShape(settings).outline(),
      this.#material
    );
    this.#lines.name = "AudioZoneOutline";
    this.#lines.renderOrder = kOutlineRenderOrder;
    actor.node.object3D.add(this.#lines);
  }

  get settings(): Readonly<AudioZoneSettings> {
    return this.#settings;
  }

  draw(
    settings: Readonly<AudioZoneSettings>
  ): void {
    this.#settings = settings;
    this.#material.color.set(settings.color);
    this.#lines.geometry.dispose();
    this.#lines.geometry = new AudioZoneShape(settings).outline();
  }

  protected override onDestroy(): void {
    this.#lines.removeFromParent();
    this.#lines.geometry.dispose();
    this.#material.dispose();
  }
}
