// Import Third-party Dependencies
import type {
  JSHandle,
  Page
} from "@playwright/test";
import type {
  Camera,
  Mesh,
  Object3D,
  Vector3Like
} from "three";
import type { SceneActorView } from "@jolly-pixel/asset.scene/client";
import { nextFrames } from "@jolly-pixel/e2e/editor";

// Import Internal Dependencies
import type { SceneEditor } from "#src/boot/SceneEditor.ts";
import {
  toClientPoint,
  type ScreenPoint,
  type ViewSnapshot
} from "./projection.ts";

export type GizmoAxis = "x" | "y" | "z";

export function resolveEditor(
  page: Page
): Promise<JSHandle<SceneEditor>> {
  return page.evaluateHandle(() => {
    const editor = window.sceneEditor;
    if (editor === undefined) {
      throw new Error("window.sceneEditor is only exposed in dev mode.");
    }

    return editor;
  });
}

export async function findActor(
  page: Page,
  name: string
): Promise<SceneActorView | null> {
  const editor = await resolveEditor(page);

  return editor.evaluate(({ editing }, actorName) => {
    for (const actor of editing.document.tree.actors()) {
      if (actor.name === actorName) {
        return actor;
      }
    }

    return null;
  }, name);
}

export async function actorOverridden(
  page: Page,
  name: string
): Promise<boolean> {
  const editor = await resolveEditor(page);

  return editor.evaluate(({ editing }, actorName) => {
    for (const actor of editing.document.tree.actors()) {
      if (actor.name === actorName) {
        return editing.overrides.actorOverridden(actor.id);
      }
    }

    throw new Error(`No actor named '${actorName}'.`);
  }, name);
}

export async function actorPoint(
  page: Page,
  name: string,
  offset: Vector3Like = { x: 0, y: 0, z: 0 }
): Promise<ScreenPoint> {
  const actor = await findActor(page, name);
  if (actor === null) {
    throw new Error(`No actor named '${name}'.`);
  }
  const { position } = actor.transform;

  return toClientPoint(await viewSnapshot(page), {
    x: position.x + offset.x,
    y: position.y + offset.y,
    z: position.z + offset.z
  });
}

export async function gizmoHandlePoints(
  page: Page,
  axis: GizmoAxis
): Promise<[ScreenPoint, ScreenPoint]> {
  const editor = await resolveEditor(page);
  await nextFrames(page);

  const [grab, release] = await editor.evaluate(({ editing, runtime }, axisName) => {
    const kDragRatio = 3;
    const helper = runtime.world.sceneManager
      .getSource()
      .getObjectByName("transform-gizmo");
    if (helper === undefined) {
      throw new Error("The transform gizmo is missing.");
    }

    function isMesh(
      object: Object3D | undefined
    ): object is Mesh {
      return object !== undefined && "isMesh" in object;
    }
    const handleName = `transform-handle-${editing.gizmo.mode}-${axisName}-positive`;
    const picker = helper
      .getObjectByName(handleName)
      ?.getObjectByName("transform-handle-picker");
    if (!isMesh(picker)) {
      throw new Error(`No picker mesh under '${handleName}'.`);
    }

    helper.updateMatrixWorld(true);
    picker.geometry.computeBoundingBox();
    const { boundingBox } = picker.geometry;
    if (boundingBox === null) {
      throw new Error(`Picker '${handleName}' has no bounding box.`);
    }
    const origin = helper.position.clone()
      .setFromMatrixPosition(helper.matrixWorld);
    const start = picker.localToWorld(boundingBox.getCenter(origin.clone()));
    const end = origin.clone()
      .addScaledVector(start.clone().sub(origin), kDragRatio);

    return [start, end].map(({ x, y, z }) => {
      return { x, y, z };
    });
  }, axis);
  const view = await viewSnapshot(page);

  return [
    toClientPoint(view, grab),
    toClientPoint(view, release)
  ];
}

async function viewSnapshot(
  page: Page
): Promise<ViewSnapshot> {
  const editor = await resolveEditor(page);

  return editor.evaluate(({ runtime }) => {
    const { world } = runtime;
    function isCamera(
      value: unknown
    ): value is Camera {
      return typeof value === "object" && value !== null && "isCamera" in value;
    }
    const components = world.sceneManager.getActor("editor-camera")?.components;
    const camera = [...components ?? []]
      .map((component) => ("camera" in component ? component.camera : null))
      .find(isCamera);
    if (camera === undefined) {
      throw new Error("The editor camera is missing.");
    }

    camera.updateMatrixWorld(true);
    const {
      left,
      top,
      width,
      height
    } = world.renderer.canvas.getBoundingClientRect();

    return {
      projection: camera.projectionMatrix.toArray(),
      world: camera.matrixWorld.toArray(),
      bounds: {
        left,
        top,
        width,
        height
      }
    };
  });
}
