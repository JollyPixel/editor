// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { Actor } from "../../../src/actor/Actor.ts";
import { LightDefinition } from "../../../src/components/light/LightDefinition.ts";
import type { JSONObject } from "../../../src/systems/scene/file/SceneFile.ts";
import { createSceneSetup } from "../../helpers/scene/sceneSetup.ts";

function createLight(
  data: JSONObject = {}
) {
  const { world } = createSceneSetup();
  const actor = new Actor(world as any, { name: "light" });
  const definition = new LightDefinition();
  const component = definition.create(
    actor,
    definition.parse(data)
  );

  return { actor, definition, component };
}

describe("Components.LightDefinition", () => {
  test("parses missing or invalid fields to their defaults", () => {
    const definition = new LightDefinition();

    assert.deepEqual(
      definition.parse({ kind: "laser", color: "red", intensity: "bright" }),
      definition.parse({})
    );
    assert.deepEqual(definition.parse({}), {
      kind: "directional",
      color: "#ffffff",
      groundColor: "#444444",
      intensity: 1,
      distance: 0,
      decay: 2,
      angle: 60,
      penumbra: 0,
      castShadow: false,
      shadowMapSize: 1024,
      shadowBias: 0
    });
  });

  test("aims a directional light along the actor's forward axis", () => {
    const { actor, component } = createLight({ kind: "directional" });
    actor.object3D.rotation.y = Math.PI / 2;
    actor.object3D.updateMatrixWorld(true);

    const light = component.threeLight as THREE.DirectionalLight;
    const direction = light.target.getWorldPosition(new THREE.Vector3())
      .sub(light.getWorldPosition(new THREE.Vector3()));

    assert.strictEqual(light.parent, actor.object3D);
    assert.ok(direction.distanceTo(actor.transform.getForward(new THREE.Vector3())) < 1e-9);
  });

  test("apply patches the live light in place", () => {
    const { definition, component } = createLight({ kind: "point" });
    const light = component.threeLight as THREE.PointLight;

    definition.apply(component, definition.parse({
      kind: "point",
      color: "#ff0000",
      intensity: 3,
      distance: 12,
      castShadow: true,
      shadowMapSize: 2048
    }));

    assert.strictEqual(component.threeLight, light);
    assert.strictEqual(light.color.getHexString(), "ff0000");
    assert.strictEqual(light.intensity, 3);
    assert.strictEqual(light.distance, 12);
    assert.strictEqual(light.castShadow, true);
    assert.deepEqual(light.shadow.mapSize.toArray(), [2048, 2048]);
  });

  test("apply with another kind swaps the light under the actor", () => {
    const { actor, definition, component } = createLight({ kind: "point" });
    const previous = component.threeLight;

    definition.apply(component, definition.parse({ kind: "spot", angle: 30 }));

    const spot = component.threeLight as THREE.SpotLight;
    assert.ok(spot instanceof THREE.SpotLight);
    assert.strictEqual(component.kind, "spot");
    assert.strictEqual(previous.parent, null);
    assert.strictEqual(spot.parent, actor.object3D);
    assert.ok(Math.abs(spot.angle - (Math.PI / 6)) < 1e-9);
  });

  test("destroy removes the light from the actor", () => {
    const { actor, component } = createLight({ kind: "ambient" });
    const light = component.threeLight;

    component.destroy();

    assert.ok(light instanceof THREE.AmbientLight);
    assert.strictEqual(light.parent, null);
    assert.deepEqual(actor.components, []);
  });
});
