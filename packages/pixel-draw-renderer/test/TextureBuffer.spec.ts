// Import Node.js Dependencies
import { describe, test, before } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { Window } from "happy-dom";

// Import Internal Dependencies
import { TextureBuffer } from "../src/TextureBuffer.ts";
import { installCanvasMock } from "./mocks.ts";

// CONSTANTS
const kEmulatedBrowserWindow = new Window();
// Small master canvas size for fast tests (real default is 2048)
const kTestMaxSize = 32;

before(() => {
  globalThis.document = kEmulatedBrowserWindow.document as unknown as Document;
  installCanvasMock(globalThis.document);
});

describe("TextureBuffer", () => {
  describe("constructor", () => {
    test("getSize returns the initial textureSize", () => {
      const buf = new TextureBuffer({ textureSize: { x: 16, y: 8 }, maxSize: kTestMaxSize });
      assert.deepStrictEqual(buf.getSize(), { x: 16, y: 8 });
    });

    test("getCanvas returns a canvas with correct dimensions", () => {
      const buf = new TextureBuffer({ textureSize: { x: 16, y: 16 }, maxSize: kTestMaxSize });
      const canvas = buf.getCanvas();
      assert.strictEqual(canvas.width, 16);
      assert.strictEqual(canvas.height, 16);
    });
  });

  describe("drawPixels / samplePixel", () => {
    test("writes RGBA values to specified pixels", () => {
      const buf = new TextureBuffer({ textureSize: { x: 4, y: 4 }, maxSize: kTestMaxSize });
      buf.drawPixels([{ x: 1, y: 1 }], { r: 255, g: 0, b: 0, a: 255 });
      const [r, g, b, a] = buf.samplePixel(1, 1);
      assert.strictEqual(r, 255);
      assert.strictEqual(g, 0);
      assert.strictEqual(b, 0);
      assert.strictEqual(a, 255);
    });

    test("draws multiple pixels at once", () => {
      const buf = new TextureBuffer({ textureSize: { x: 4, y: 4 }, maxSize: kTestMaxSize });
      const pixels = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }];
      buf.drawPixels(pixels, { r: 0, g: 255, b: 0, a: 200 });
      for (const p of pixels) {
        const [r, g, b, a] = buf.samplePixel(p.x, p.y);
        assert.strictEqual(r, 0);
        assert.strictEqual(g, 255);
        assert.strictEqual(b, 0);
        assert.strictEqual(a, 200);
      }
    });
  });

  describe("setSize", () => {
    test("updates getSize", () => {
      const buf = new TextureBuffer({ textureSize: { x: 8, y: 8 }, maxSize: kTestMaxSize });
      buf.setSize({ x: 16, y: 4 });
      assert.deepStrictEqual(buf.getSize(), { x: 16, y: 4 });
    });

    test("updates working canvas dimensions", () => {
      const buf = new TextureBuffer({ textureSize: { x: 8, y: 8 }, maxSize: kTestMaxSize });
      buf.setSize({ x: 20, y: 10 });
      const canvas = buf.getCanvas();
      assert.strictEqual(canvas.width, 20);
      assert.strictEqual(canvas.height, 10);
    });

    test("copies master data into new working canvas", () => {
      const buf = new TextureBuffer({ textureSize: { x: 8, y: 8 }, maxSize: kTestMaxSize });
      // Write a pixel and commit to master
      buf.drawPixels([{ x: 2, y: 2 }], { r: 10, g: 20, b: 30, a: 255 });
      buf.copyToMaster();
      // Resize to larger canvas — pixel at (2,2) should survive
      buf.setSize({ x: 16, y: 16 });
      const [r, g, b, a] = buf.samplePixel(2, 2);
      assert.strictEqual(r, 10);
      assert.strictEqual(g, 20);
      assert.strictEqual(b, 30);
      assert.strictEqual(a, 255);
    });
  });

  describe("copyToMaster", () => {
    test("persists working canvas data across setSize", () => {
      const buf = new TextureBuffer({ textureSize: { x: 4, y: 4 }, maxSize: kTestMaxSize });
      buf.drawPixels([{ x: 0, y: 0 }], { r: 100, g: 150, b: 200, a: 255 });
      buf.copyToMaster();
      buf.setSize({ x: 4, y: 4 });
      const [r, g, b, a] = buf.samplePixel(0, 0);
      assert.strictEqual(r, 100);
      assert.strictEqual(g, 150);
      assert.strictEqual(b, 200);
      assert.strictEqual(a, 255);
    });
  });

  describe("setTexture", () => {
    test("replaces working canvas with provided canvas", () => {
      const buf = new TextureBuffer({ textureSize: { x: 4, y: 4 }, maxSize: kTestMaxSize });
      const externalCanvas = kEmulatedBrowserWindow.document.createElement("canvas") as unknown as HTMLCanvasElement;
      externalCanvas.width = 10;
      externalCanvas.height = 5;
      buf.setTexture(externalCanvas);
      assert.deepStrictEqual(buf.getSize(), { x: 10, y: 5 });
      assert.strictEqual(buf.getCanvas(), externalCanvas);
    });
  });

  describe("getPixels", () => {
    test("returns Uint8ClampedArray of the correct length", () => {
      const buf = new TextureBuffer({ textureSize: { x: 4, y: 4 }, maxSize: kTestMaxSize });
      const pixels = buf.getPixels();
      assert.strictEqual(pixels.length, 4 * 4 * 4);
    });
  });
});
