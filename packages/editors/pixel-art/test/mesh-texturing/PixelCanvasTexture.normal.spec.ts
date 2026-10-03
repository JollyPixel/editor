// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { PixelCanvasTexture } from "#src/mesh-texturing/PixelCanvasTexture.ts";
import {
  FakeTextureSource,
  enableNormalMap
} from "./fixtures/FakeTextureSource.ts";
import { FakeFrames } from "../fixtures/frames.ts";

describe("PixelCanvasTexture.normalTexture", () => {
  test("is null while the normal map is off", (t) => {
    new FakeFrames(t);
    const source = new FakeTextureSource();
    const bridge = new PixelCanvasTexture(source, { flush: "manual" });

    assert.equal(bridge.normalTexture(), null);
    assert.equal(source.normals.retained, false);
  });

  test("returns a linear, nearest texture over the generated map", (t) => {
    new FakeFrames(t);
    const source = new FakeTextureSource();
    enableNormalMap(source);
    const bridge = new PixelCanvasTexture(source, { flush: "manual" });

    const texture = bridge.normalTexture();

    assert.ok(texture instanceof THREE.DataTexture);
    assert.equal(texture.colorSpace, THREE.NoColorSpace);
    assert.equal(texture.magFilter, THREE.NearestFilter);
    assert.equal(texture.minFilter, THREE.NearestFilter);
    assert.equal(texture.generateMipmaps, false);
    assert.equal(texture.flipY, true);
    assert.equal(texture.image.data, source.normals.pixels);
    assert.deepEqual(
      [texture.image.width, texture.image.height],
      [64, 32]
    );
    assert.deepEqual(
      Array.from(source.normals.pixels.subarray(0, 4)),
      [128, 128, 255, 255]
    );
    assert.equal(source.normals.retained, true);
    assert.equal(bridge.normalTexture(), texture);
  });

  test("flags the texture when the normal map is regenerated", (t) => {
    const frames = new FakeFrames(t);
    const source = new FakeTextureSource();
    enableNormalMap(source);
    const bridge = new PixelCanvasTexture(source, { flush: "manual" });
    const texture = bridge.normalTexture()!;
    const { version } = texture;

    source.normals.invalidateAll();
    frames.run();

    assert.equal(texture.version, version + 1);
  });

  test("follows a texture resize", (t) => {
    new FakeFrames(t);
    const source = new FakeTextureSource();
    enableNormalMap(source);
    const bridge = new PixelCanvasTexture(source, { flush: "manual" });
    const texture = bridge.normalTexture()!;
    let released = 0;
    texture.addEventListener("dispose", () => {
      released++;
    });

    source.textureSize = { x: 16, y: 8 };
    source.pixels = new Uint8ClampedArray(16 * 8 * 4);
    source.normals.invalidateIslands();
    source.normals.flush();

    assert.equal(released, 1);
    assert.equal(texture.image.data, source.normals.pixels);
    assert.deepEqual(
      [texture.image.width, texture.image.height],
      [16, 8]
    );
  });

  test("emits normal-map-toggled when the feature turns on or off", (t) => {
    new FakeFrames(t);
    const source = new FakeTextureSource();
    const bridge = new PixelCanvasTexture(source, { flush: "manual" });
    const events: boolean[] = [];
    bridge.on("normal-map-toggled", ({ enabled }) => events.push(enabled));

    enableNormalMap(source);
    const texture = bridge.normalTexture()!;
    let released = 0;
    texture.addEventListener("dispose", () => {
      released++;
    });
    source.toggleNormalMap(source.normalMap!.withDefaults({ strength: 4 }));
    source.toggleNormalMap(null);

    assert.deepEqual(events, [true, false]);
    assert.equal(released, 1);
    assert.equal(source.normals.retained, false);
    assert.equal(bridge.normalTexture(), null);
  });

  test("dispose releases the normal map", (t) => {
    new FakeFrames(t);
    const source = new FakeTextureSource();
    enableNormalMap(source);
    const bridge = new PixelCanvasTexture(source, { flush: "manual" });
    bridge.normalTexture();
    const events: boolean[] = [];
    bridge.on("normal-map-toggled", ({ enabled }) => events.push(enabled));

    bridge.dispose();
    source.toggleNormalMap(null);

    assert.equal(source.normals.retained, false);
    assert.equal(bridge.normalTexture(), null);
    assert.deepEqual(events, []);
  });
});
