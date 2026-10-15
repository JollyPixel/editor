// Import Third-party Dependencies
import * as THREE from "three";

// CONSTANTS
const kShadowMapSize = 2048;
const kMinRadius = 0.5;
const kUnfittedDistance = 10;

export interface ShadowCaster extends THREE.Object3D {
  geometry: THREE.BufferGeometry;
  material: {
    map: THREE.Texture | null;
  };
}

export interface KeyLightShadowOptions {
  light: THREE.DirectionalLight;
  casters: () => Iterable<ShadowCaster>;
}

export class KeyLightShadow {
  #light: THREE.DirectionalLight;
  #casters: () => Iterable<ShadowCaster>;
  #direction = new THREE.Vector3(0, 1, 0);
  #distance = kUnfittedDistance;
  #box = new THREE.Box3();
  #sphere = new THREE.Sphere();
  #state: number[] = [];
  #enabled = false;
  #stale = true;

  constructor(
    options: KeyLightShadowOptions
  ) {
    this.#light = options.light;
    this.#casters = options.casters;

    this.#light.castShadow = true;
    const { shadow } = this.#light;
    shadow.autoUpdate = false;
    shadow.intensity = 0;
    shadow.mapSize.set(kShadowMapSize, kShadowMapSize);
    shadow.bias = -0.0005;
    shadow.normalBias = 0.02;
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
    this.#light.shadow.intensity = enabled ? 1 : 0;
    this.#stale = true;
  }

  aim(
    from: THREE.Vector3Tuple
  ): void {
    const direction = new THREE.Vector3().fromArray(from).normalize();
    if (direction.equals(this.#direction)) {
      return;
    }

    this.#direction.copy(direction);
    this.#place();
    this.#stale = true;
  }

  readonly update = (): void => {
    if (!this.#enabled || !(this.#trackCasters() || this.#stale)) {
      return;
    }

    this.#stale = false;
    this.#light.shadow.needsUpdate = true;
    this.#box.makeEmpty();
    for (const caster of this.#casters()) {
      this.#box.expandByObject(caster);
    }
    if (!this.#box.isEmpty()) {
      this.#fit(this.#box.getBoundingSphere(this.#sphere));
    }
  };

  #fit(
    { center, radius }: THREE.Sphere
  ): void {
    const extent = Math.max(radius, kMinRadius);
    this.#distance = extent * 2;
    this.#light.target.position.copy(center);
    this.#light.target.updateMatrixWorld();
    this.#place();

    const { camera } = this.#light.shadow;
    camera.left = -extent;
    camera.right = extent;
    camera.top = extent;
    camera.bottom = -extent;
    camera.near = this.#distance - extent;
    camera.far = this.#distance + extent;
    camera.updateProjectionMatrix();
  }

  #place(): void {
    this.#light.position
      .copy(this.#light.target.position)
      .addScaledVector(this.#direction, this.#distance);
  }

  #trackCasters(): boolean {
    const state = this.#state;
    let index = 0;
    let changed = false;
    function track(
      value: number
    ): void {
      if (state[index] !== value) {
        state[index] = value;
        changed = true;
      }
      index++;
    }

    for (const caster of this.#casters()) {
      caster.updateWorldMatrix(true, false);
      caster.matrixWorld.elements.forEach(track);
      track(caster.geometry.id);
      track(caster.material.map?.id ?? -1);
      track(caster.material.map?.version ?? -1);
    }
    if (state.length !== index) {
      state.length = index;
      changed = true;
    }

    return changed;
  }
}
