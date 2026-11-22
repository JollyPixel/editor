// Import Node.js Dependencies
import { describe, test, mock } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  Actor,
  ActorComponent,
  Systems
} from "@jolly-pixel/ecs";

// Import Internal Dependencies
import { CameraDefinition } from "../../../src/components/camera/CameraDefinition.ts";
import { createThreeSceneSetup } from "../../helpers/scene/threeSceneSetup.ts";
import { createComponentContext } from "../../helpers/scene/sceneFile.ts";

function createCamera(
  mode: Systems.SceneMode
) {
  const { world } = createThreeSceneSetup();
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
      new Systems.Viewport({ x: 0.5, y: 0, width: 1, height: 1 })
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
