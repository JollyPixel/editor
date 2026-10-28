// Import Node.js Dependencies
import { describe, test, mock } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { Actor } from "../../../src/actor/Actor.ts";
import { ActorComponent } from "../../../src/actor/ActorComponent.ts";
import { CameraDefinition } from "../../../src/components/camera/CameraDefinition.ts";
import type { SceneMode } from "../../../src/systems/scene/file/definitions/ComponentDefinition.ts";
import { createSceneSetup } from "../../helpers/scene/sceneSetup.ts";
import { createComponentContext } from "../../helpers/scene/sceneFile.ts";
import { Viewport } from "../../../src/systems/rendering/Viewport.ts";

function createCamera(
  mode: SceneMode
) {
  const { world } = createSceneSetup();
  const renderer = {
    addRenderComponent: mock.fn(),
    removeRenderComponent: mock.fn()
  };
  const actor = new Actor({ ...world, renderer } as any, { name: "camera" });
  const definition = new CameraDefinition();
  const component = definition.create(
    actor,
    definition.parse({ fov: 60, viewport: { x: 0.5 } }),
    createComponentContext(mode)
  );
  actor.awake();

  return { definition, component, renderer };
}

describe("Components.CameraDefinition", () => {
  test("renders in play mode and never in edit mode", () => {
    const play = createCamera("play");
    const edit = createCamera("edit");

    assert.deepEqual(
      play.renderer.addRenderComponent.mock.calls.map((call) => call.arguments),
      [[play.component]]
    );
    assert.strictEqual(edit.renderer.addRenderComponent.mock.callCount(), 0);
  });

  test("parses a partial viewport and patches the camera on apply", () => {
    const { definition, component } = createCamera("edit");
    assert.deepEqual(
      component.viewport,
      new Viewport({ x: 0.5, y: 0, width: 1, height: 1 })
    );
    assert.strictEqual(component.settings.fov, 60);

    definition.apply(component, definition.parse({
      projectionMode: "orthographic",
      orthographicScale: 4
    }));

    assert.strictEqual(component.settings.projectionMode, "orthographic");
    assert.strictEqual(component.settings.orthographicScale, 4);
    assert.strictEqual(component.settings.fov, 45);
    assert.strictEqual(component.viewport, null);
  });

  test("captures the settings it parses from a live camera", () => {
    const { definition, component } = createCamera("edit");
    component.configure({ fov: 70, depth: 2 });

    const captured = definition.capture(component);

    assert.deepEqual(definition.parse(captured), {
      projectionMode: "perspective",
      fov: 70,
      near: 0.1,
      far: 10000,
      orthographicScale: 1,
      viewport: { x: 0.5, y: 0, width: 1, height: 1 },
      depth: 2
    });
  });

  test("owns cameras only", () => {
    const { definition, component } = createCamera("edit");
    const other = new ActorComponent({ actor: component.actor, typeName: "Other" });

    assert.strictEqual(definition.owns(component), true);
    assert.strictEqual(definition.owns(other), false);
  });
});
