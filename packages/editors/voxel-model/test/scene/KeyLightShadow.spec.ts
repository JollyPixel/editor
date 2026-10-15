// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { KeyLightShadow } from "#src/scene/KeyLightShadow.ts";

type Caster = THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;

function boxAt(
  x: number,
  y: number,
  z: number
): Caster {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(2, 2, 2),
    new THREE.MeshStandardMaterial({ map: new THREE.Texture() })
  );
  mesh.position.set(x, y, z);

  return mesh;
}

function createShadow(
  casters: Caster[]
) {
  const light = new THREE.DirectionalLight();
  const shadow = new KeyLightShadow({
    light,
    casters: () => casters
  });
  shadow.aim([4, 6, 5]);

  return {
    light,
    shadow
  };
}

function keyDirection(
  light: THREE.DirectionalLight
): THREE.Vector3 {
  return light.position.clone().sub(light.target.position).normalize();
}

function redraws(
  light: THREE.DirectionalLight,
  shadow: KeyLightShadow
): boolean {
  light.shadow.needsUpdate = false;
  shadow.update();

  return light.shadow.needsUpdate;
}

describe("KeyLightShadow", () => {
  test("switches with the shadow intensity, never with what the materials compile against", () => {
    const { light, shadow } = createShadow([]);
    assert.equal(light.castShadow, true);
    assert.equal(light.shadow.intensity, 0);

    shadow.enabled = true;
    assert.equal(light.shadow.intensity, 1);

    shadow.enabled = false;
    assert.equal(light.shadow.intensity, 0);
    assert.equal(light.castShadow, true);
  });

  test("fits the shadow camera around the casters without turning the light", () => {
    const { light, shadow } = createShadow([boxAt(3, 1, 3)]);
    shadow.enabled = true;
    const before = keyDirection(light);

    shadow.update();

    const { camera } = light.shadow;
    const radius = Math.sqrt(3);
    const distance = light.position.distanceTo(light.target.position);
    assert.deepEqual(light.target.position.toArray(), [3, 1, 3]);
    assert.ok(keyDirection(light).distanceTo(before) < 1e-9);
    assert.ok(camera.right >= radius && camera.top >= radius);
    assert.ok(camera.near <= distance - radius && camera.far >= distance + radius);
  });

  test("redraws the shadow map only after a caster moves, reshapes or repaints", () => {
    const caster = boxAt(0, 1, 0);
    const { light, shadow } = createShadow([caster]);
    assert.equal(redraws(light, shadow), false);

    shadow.enabled = true;
    assert.equal(redraws(light, shadow), true);
    assert.equal(redraws(light, shadow), false);

    caster.rotation.y = 1;
    assert.equal(redraws(light, shadow), true);
    assert.equal(redraws(light, shadow), false);

    caster.geometry = new THREE.BoxGeometry(1, 3, 1);
    assert.equal(redraws(light, shadow), true);

    caster.material.map!.needsUpdate = true;
    assert.equal(redraws(light, shadow), true);
    assert.equal(redraws(light, shadow), false);

    shadow.aim([0, 8, 1]);
    assert.equal(redraws(light, shadow), true);
  });

  test("keeps the shadow map when the same direction and state are applied again", () => {
    const { light, shadow } = createShadow([boxAt(0, 1, 0)]);
    shadow.enabled = true;
    assert.equal(redraws(light, shadow), true);

    shadow.aim([4, 6, 5]);
    shadow.enabled = true;

    assert.equal(redraws(light, shadow), false);
  });
});
