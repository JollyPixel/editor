// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  createSceneFile,
  SCENE_FILE
} from "#src/index.ts";
import { SceneTransform } from "#src/model/changes/SceneTransform.ts";
import {
  actor,
  sceneFile
} from "../helpers/scene.ts";

describe("createSceneFile", () => {
  test("seeds a main camera, a sun and a sky", () => {
    const file = createSceneFile();

    assert.deepEqual(
      file.actors.map(({ name, components }) => [name, components.map(({ type, data }) => [type, data])]),
      [
        ["Main Camera", [["Camera", { projectionMode: "perspective" }]]],
        ["Sun", [["Light", { kind: "directional", castShadow: true }]]],
        ["Sky", [["Light", { kind: "hemisphere" }]]]
      ]
    );
  });

  test("aims the main camera from (0, 2, 6) at the origin", () => {
    const [camera] = createSceneFile().actors;
    const { position, rotation } = camera.transform;
    const pitch = rotation.x * Math.PI / 180;
    const length = Math.hypot(position.x, position.y, position.z);

    assert.deepEqual(position, { x: 0, y: 2, z: 6 });
    assert.ok(Math.abs(Math.sin(pitch) - (-position.y / length)) < 1e-9);
    assert.ok(Math.abs(-Math.cos(pitch) - (-position.z / length)) < 1e-9);
  });

  test("gives every actor and component a distinct id", () => {
    const { actors } = createSceneFile();
    const ids = actors.flatMap((entry) => [entry.id, ...entry.components.map(({ id }) => id)]);

    assert.equal(new Set(ids).size, 6);
  });
});

describe("scene file codec", () => {
  const file = sceneFile([
    actor("plain"),
    actor("moved", {
      visible: false,
      transform: SceneTransform.create({ position: { x: 1, y: 0, z: 0 } })
    })
  ]);

  test("stores only the transform fields and visibility that differ from the defaults", () => {
    const stored = JSON.parse(new TextDecoder().decode(SCENE_FILE.encode(file)));

    assert.equal("transform" in stored.actors[0], false);
    assert.equal("visible" in stored.actors[0], false);
    assert.deepEqual(stored.actors[1].transform, { position: { x: 1, y: 0, z: 0 } });
    assert.equal(stored.actors[1].visible, false);
  });

  test("decodes the stored form back to the full file", () => {
    assert.deepEqual(SCENE_FILE.decode(SCENE_FILE.encode(file)), file);
  });
});
