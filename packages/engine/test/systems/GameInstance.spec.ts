// Import Node.js Dependencies
import { describe, test, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  Window,
  type Document,
  type HTMLCanvasElement
} from "happy-dom";

// Import Internal Dependencies
import { GameInstance } from "../../src/systems/GameInstance.js";

// VARS
let canvas: HTMLCanvasElement;

describe.skip("GameInstance", () => {
  let window: Window;
  let document: Document;
  let gameInstance: GameInstance | null = null;

  beforeEach(() => {
    window = new Window({
      url: "http://localhost:3000",
      width: 1024,
      height: 768
    });
    document = window.document;

    // Create a proper canvas element
    canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 600;

    // Add canvas to document body
    document.body.appendChild(canvas);
  });

  afterEach(() => {
    gameInstance?.disconnect();
  });

  test("should create GameInstance with default options", () => {
    gameInstance = new GameInstance(canvas as any, {
      threeRendererProvider: MockedThreeRenderer as any
    });

    assert.ok(gameInstance instanceof GameInstance);
    assert.equal(gameInstance.framesPerSecond, 60);
    assert.deepEqual(gameInstance.layers, ["Default"]);
    assert.equal(gameInstance.ratio, null);
    assert.ok(gameInstance.tree);
    assert.ok(gameInstance.input);
    assert.ok(gameInstance.threeRenderer);
    assert.ok(gameInstance.threeScene);
    assert.equal(global.game, gameInstance);
  });

  // test("should create GameInstance with custom options", () => {
  //   const customOptions = {
  //     layers: ["UI", "Game", "Background"],
  //     enableOnExit: true
  //   };

  //   gameInstance = new GameInstance(canvas, customOptions);

  //   assert.deepEqual(gameInstance.layers, ["UI", "Game", "Background"]);
  //   assert.ok(gameInstance.input);
  // });

  // test("should initialize Three.js renderer with correct settings", () => {
  //   gameInstance = new GameInstance(canvas);

  //   assert.ok(gameInstance.threeRenderer);
  //   assert.equal(gameInstance.threeRenderer.shadowMap.enabled, true);
  //   assert.equal(gameInstance.threeRenderer.autoClear, false);
  // });

  // test("should setup tree with callbacks", () => {
  //   gameInstance = new GameInstance(canvas);

  //   // Verify tree has the expected structure
  //   assert.ok(gameInstance.tree);
  //   assert.equal(gameInstance.tree.root.length, 0);
  // });

  // test("should handle connect and disconnect", () => {
  //   gameInstance = new GameInstance(canvas);

  //   // Connect should not throw
  //   const result = gameInstance.connect();
  //   assert.equal(result, gameInstance);

  //   // Disconnect should not throw
  //   const disconnectResult = gameInstance.disconnect();
  //   assert.equal(disconnectResult, gameInstance);
  // });

  // test("should handle setRatio", () => {
  //   gameInstance = new GameInstance(canvas);

  //   gameInstance.setRatio(16 / 9);
  //   assert.equal(gameInstance.ratio, 16 / 9);

  //   gameInstance.setRatio(null);
  //   assert.equal(gameInstance.ratio, null);
  // });
});

class MockedThreeRenderer {
  constructor(public options: any) {}

  setPixelRatio = mock.fn();
  shadowMap = {
    enabled: true,
    type: "BasicShadowMap"
  };
  setSize = mock.fn();
  autoClear = false;
  domElement = canvas;
}
