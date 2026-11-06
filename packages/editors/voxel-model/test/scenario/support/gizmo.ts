// Import Third-party Dependencies
import type { Page } from "@playwright/test";
import type {
  Mesh,
  Object3D,
  Vector3Like
} from "three";
import { nextFrames } from "@jolly-pixel/e2e/editor";

// Import Internal Dependencies
import {
  toClientPoint,
  type ScreenPoint,
  type ViewSnapshot
} from "./projection.ts";
import { resolveEditor } from "./scene.ts";

// CONSTANTS
const kCenter = { x: 0, y: 0, z: 0 };

export type Axis = "X" | "Y" | "Z";

export async function blockPoint(
  page: Page,
  name: string,
  offset: Vector3Like = kCenter
): Promise<ScreenPoint> {
  const editor = await resolveEditor(page);

  const { view, point } = await editor.evaluate(({ editing, runtime }, blockName) => {
    const { blocks, gizmo } = editing;
    const block = [...blocks.values()]
      .find((candidate) => candidate.name === blockName);
    if (block === undefined) {
      throw new Error(`No block named '${blockName}'.`);
    }

    const controls = gizmo.activeControls;
    if (controls === null) {
      throw new Error("No active gizmo tool.");
    }
    const { camera } = controls;
    const bounds = runtime.world.renderer.canvas.getBoundingClientRect();
    block.mesh.updateWorldMatrix(true, false);
    camera.updateMatrixWorld(true);
    const snapshot: ViewSnapshot = {
      projection: camera.projectionMatrix.toArray(),
      world: camera.matrixWorld.toArray(),
      bounds: {
        left: bounds.left,
        top: bounds.top,
        width: bounds.width,
        height: bounds.height
      }
    };
    const { x, y, z } = block.mesh.getWorldPosition(camera.position.clone());

    return {
      view: snapshot,
      point: { x, y, z }
    };
  }, name);

  return toClientPoint(view, {
    x: point.x + offset.x,
    y: point.y + offset.y,
    z: point.z + offset.z
  });
}

export async function gizmoHandlePoints(
  page: Page,
  axis: Axis
): Promise<[ScreenPoint, ScreenPoint]> {
  const editor = await resolveEditor(page);
  await page.waitForFunction(({ editing }) => {
    const { gizmo } = editing;

    return (gizmo.activeControls?.target ?? null) !== null;
  }, editor);
  await nextFrames(page);

  const { view, points } = await editor.evaluate(({ editing, runtime }, axisName) => {
    const kDragRatio = 3;
    const { gizmo } = editing;
    const controls = gizmo.activeControls;
    if (controls === null) {
      throw new Error("No active gizmo tool.");
    }
    const { camera, helper } = controls;
    const bounds = runtime.world.renderer.canvas.getBoundingClientRect();

    function isMesh(
      object: Object3D | undefined
    ): object is Mesh {
      return object !== undefined && "isMesh" in object;
    }
    const handleName = [
      "transform-handle",
      controls.mode,
      axisName.toLowerCase(),
      "positive"
    ].join("-");
    const picker = helper
      .getObjectByName(handleName)
      ?.getObjectByName("transform-handle-picker");
    if (!isMesh(picker)) {
      throw new Error(`No picker mesh under '${handleName}'.`);
    }

    camera.updateMatrixWorld(true);
    helper.updateMatrixWorld(true);
    const origin = helper.position.clone()
      .setFromMatrixPosition(helper.matrixWorld);
    picker.geometry.computeBoundingBox();
    const { boundingBox } = picker.geometry;
    if (boundingBox === null) {
      throw new Error(`Picker '${handleName}' has no bounding box.`);
    }

    const grab = picker.localToWorld(
      boundingBox.getCenter(picker.position.clone())
    );
    const reach = grab.sub(origin);

    function worldPointAt(
      ratio: number
    ): Vector3Like {
      const { x, y, z } = origin.clone().addScaledVector(reach, ratio);

      return { x, y, z };
    }
    const snapshot: ViewSnapshot = {
      projection: camera.projectionMatrix.toArray(),
      world: camera.matrixWorld.toArray(),
      bounds: {
        left: bounds.left,
        top: bounds.top,
        width: bounds.width,
        height: bounds.height
      }
    };

    return {
      view: snapshot,
      points: [worldPointAt(1), worldPointAt(kDragRatio)]
    };
  }, axis);

  return [
    toClientPoint(view, points[0]),
    toClientPoint(view, points[1])
  ];
}
