// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { resolveRendererSettings } from "../../../src/systems/rendering/ThreeRenderer.ts";

describe("Systems.Rendering.resolveRendererSettings", () => {
  describe("webgl parameters", () => {
    test("should default to antialiasing, alpha and the discrete GPU", () => {
      const { webgl } = resolveRendererSettings({}, 1);

      assert.deepStrictEqual(webgl, {
        antialias: true,
        alpha: true,
        powerPreference: "high-performance"
      });
    });

    test("should let the caller disable antialiasing", () => {
      const { webgl } = resolveRendererSettings(
        { webgl: { antialias: false } },
        1
      );

      assert.strictEqual(webgl.antialias, false);
      assert.strictEqual(webgl.alpha, true);
    });

    test("should forward unknown context parameters untouched", () => {
      const { webgl } = resolveRendererSettings(
        { webgl: { logarithmicDepthBuffer: true, stencil: false } },
        1
      );

      assert.strictEqual(webgl.logarithmicDepthBuffer, true);
      assert.strictEqual(webgl.stencil, false);
    });
  });

  describe("pixelRatio", () => {
    test("should cap the device pixel ratio at 2 by default", () => {
      assert.strictEqual(resolveRendererSettings({}, 3).pixelRatio, 2);
    });

    test("should keep a device pixel ratio below the cap", () => {
      assert.strictEqual(resolveRendererSettings({}, 1.5).pixelRatio, 1.5);
    });

    test("should honour a custom maxPixelRatio", () => {
      const settings = resolveRendererSettings(
        { output: { maxPixelRatio: 1 } },
        3
      );

      assert.strictEqual(settings.pixelRatio, 1);
    });

    test("should let an explicit pixelRatio bypass the cap", () => {
      const settings = resolveRendererSettings(
        { output: { pixelRatio: 4 } },
        1
      );

      assert.strictEqual(settings.pixelRatio, 4);
    });
  });

  describe("shadows", () => {
    test("should be disabled by default", () => {
      const { shadows } = resolveRendererSettings({}, 1);

      assert.strictEqual(shadows.enabled, false);
    });

    test("should default to PCFSoftShadowMap once enabled", () => {
      const { shadows } = resolveRendererSettings(
        { output: { shadows: {} } },
        1
      );

      assert.strictEqual(shadows.enabled, true);
      assert.strictEqual(shadows.type, THREE.PCFSoftShadowMap);
    });

    test("should accept an explicit shadow map type", () => {
      const { shadows } = resolveRendererSettings(
        { output: { shadows: { type: THREE.BasicShadowMap } } },
        1
      );

      assert.strictEqual(shadows.enabled, true);
      assert.strictEqual(shadows.type, THREE.BasicShadowMap);
    });
  });

  describe("output state", () => {
    test("should default to sRGB, neutral tone mapping and 1.25 exposure", () => {
      const settings = resolveRendererSettings({}, 1);

      assert.strictEqual(settings.outputColorSpace, THREE.SRGBColorSpace);
      assert.strictEqual(settings.toneMapping, THREE.NeutralToneMapping);
      assert.strictEqual(settings.toneMappingExposure, 1.25);
    });

    test("should accept a custom tone mapping curve and exposure", () => {
      const settings = resolveRendererSettings(
        {
          output: {
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1
          }
        },
        1
      );

      assert.strictEqual(settings.toneMapping, THREE.ACESFilmicToneMapping);
      assert.strictEqual(settings.toneMappingExposure, 1);
    });

    test("should accept a linear output color space", () => {
      const settings = resolveRendererSettings(
        { output: { outputColorSpace: THREE.LinearSRGBColorSpace } },
        1
      );

      assert.strictEqual(settings.outputColorSpace, THREE.LinearSRGBColorSpace);
    });
  });
});
