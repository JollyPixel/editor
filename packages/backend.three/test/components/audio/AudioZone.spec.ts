// Import Node.js Dependencies
import {
  describe,
  test,
  beforeEach
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import { Actor, Systems } from "@jolly-pixel/ecs";

// Import Internal Dependencies
import type { GlobalAudio } from "../../../src/audio/GlobalAudio.ts";
import { Sound } from "../../../src/audio/Sound.ts";
import { AudioZoneComponent } from "../../../src/components/audio/AudioZoneComponent.ts";
import { AudioZoneDefinition } from "../../../src/components/audio/AudioZoneDefinition.ts";
import { AudioZoneOutline } from "../../../src/components/audio/AudioZoneOutline.ts";
import { AudioZoneShape } from "../../../src/components/audio/AudioZoneShape.ts";
import {
  fakeAudioBuffer,
  installFakeAudioContext
} from "../../helpers/audio/FakeAudioContext.ts";
import { createThreeSceneSetup } from "../../helpers/scene/threeSceneSetup.ts";

function createZoneWorld() {
  installFakeAudioContext();
  const { world } = createThreeSceneSetup();
  const zone = new Actor(world as any, { name: "zone" });
  const player = new Actor(world as any, { name: "player" });

  return {
    audio: world.audio as GlobalAudio,
    zone,
    player
  };
}

describe("Components.AudioZoneShape", () => {
  test("measures zero inside a box and the world distance outside it", () => {
    const shape = new AudioZoneShape({
      shape: "box",
      size: { x: 4, y: 4, z: 4 },
      radius: 0
    });
    const matrix = new THREE.Matrix4().compose(
      new THREE.Vector3(10, 0, 0),
      new THREE.Quaternion(),
      new THREE.Vector3(2, 2, 2)
    );

    assert.strictEqual(shape.distanceTo(new THREE.Vector3(13, 3, -3), matrix), 0);
    assert.ok(Math.abs(shape.distanceTo(new THREE.Vector3(16, 0, 0), matrix) - 2) < 1e-9);
  });

  test("measures the distance to the surface of a sphere", () => {
    const shape = new AudioZoneShape({
      shape: "sphere",
      size: { x: 0, y: 0, z: 0 },
      radius: 2
    });

    assert.ok(Math.abs(shape.distanceTo(new THREE.Vector3(0, 5, 0), new THREE.Matrix4()) - 3) < 1e-9);
  });
});

describe("Components.AudioZoneComponent", () => {
  let setup: ReturnType<typeof createZoneWorld>;

  beforeEach(() => {
    setup = createZoneWorld();
  });

  test("plays a trigger sound while the target actor is inside and reports each crossing", () => {
    const { zone, player } = setup;
    const component = zone.addComponentAndGet(AudioZoneComponent, {
      mode: "trigger",
      target: "player",
      sound: new Sound(fakeAudioBuffer())
    });
    const crossings: [string, Actor<any> | null][] = [];
    component.entered.connect((target) => crossings.push(["entered", target]));
    component.exited.connect((target) => crossings.push(["exited", target]));

    player.transform.local.position = new THREE.Vector3(1, 0, 0);
    component.update();
    const played = component.instance;
    component.update();
    player.transform.local.position = new THREE.Vector3(10, 0, 0);
    component.update();

    assert.deepStrictEqual(crossings, [["entered", player], ["exited", player]]);
    assert.strictEqual(played?.state, "stopped");
    assert.strictEqual(component.instance, null);
  });

  test("fades an ambient sound with the listener distance and stops it past the falloff", () => {
    const { audio, zone } = setup;
    const component = zone.addComponentAndGet(AudioZoneComponent, {
      falloff: 4,
      volume: 0.5,
      sound: new Sound(fakeAudioBuffer())
    });

    audio.listener.position.set(3, 0, 0);
    component.update();
    const instance = component.instance;

    assert.strictEqual(instance?.settings.loop, true);
    assert.strictEqual(instance?.volume, 0.375);

    audio.listener.position.set(20, 0, 0);
    component.update();

    assert.strictEqual(instance?.state, "stopped");
    assert.strictEqual(component.instance, null);
  });
});

describe("Components.AudioZoneDefinition", () => {
  test("draws an outline in edit mode and runs a live zone in play mode", () => {
    const { zone } = createZoneWorld();
    const definition = new AudioZoneDefinition();
    const data = definition.parse({ shape: "sphere", radius: 3 });
    const assets = new Systems.ComponentAssets(definition.assets, {}, {
      resolve: () => null
    });

    const outline = definition.create(zone, data, { mode: "edit", assets });
    const live = definition.create(zone, data, { mode: "play", assets });

    assert.ok(outline instanceof AudioZoneOutline);
    assert.ok(live instanceof AudioZoneComponent);
    assert.strictEqual(live.shape.settings.radius, 3);
  });

  test("draws the outline in the zone color and repaints it when the color changes", () => {
    const { zone } = createZoneWorld();
    const definition = new AudioZoneDefinition();
    const assets = new Systems.ComponentAssets(definition.assets, {}, {
      resolve: () => null
    });
    const outline = definition.create(
      zone,
      definition.parse({ color: "#ff8800" }),
      { mode: "edit", assets }
    );
    const lines = zone.node.object3D.getObjectByName("AudioZoneOutline");
    assert.ok(lines instanceof THREE.LineSegments);
    const material = lines.material as THREE.LineBasicMaterial;

    assert.strictEqual(material.color.getHexString(), "ff8800");

    definition.apply(outline, definition.parse({ color: "#00ff00" }));

    assert.strictEqual(material.color.getHexString(), "00ff00");
  });
});
