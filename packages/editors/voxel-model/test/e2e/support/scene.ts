// Import Third-party Dependencies
import type {
  JSHandle,
  Page
} from "@playwright/test";
import type {
  Mesh,
  Object3D,
  Vector3Like
} from "three";
import { pressAt } from "@jolly-pixel/e2e";
import { nextFrames } from "@jolly-pixel/e2e/editor";

// Import Internal Dependencies
import type { VoxelModelEditor } from "#src/boot/VoxelModelEditor.ts";
import {
  clientPointOf,
  type ScreenPoint,
  type ViewSnapshot
} from "./projection.ts";

export type { ScreenPoint } from "./projection.ts";

export type Axis = "X" | "Y" | "Z";

export interface BlockSummary {
  position: Vector3Like;
  worldPosition: Vector3Like;
  rotation: Vector3Like;
  size: Vector3Like;
  scale: Vector3Like;
  pivotOffset: Vector3Like;
}

function editorOf(
  page: Page
): Promise<JSHandle<VoxelModelEditor>> {
  return page.evaluateHandle(() => {
    const editor = window.voxelModelEditor;
    if (editor === undefined) {
      throw new Error("window.voxelModelEditor is only exposed in dev mode.");
    }

    return editor;
  });
}

export async function outline(
  page: Page
): Promise<string[]> {
  const editor = await editorOf(page);

  return editor.evaluate(({ workspace }) => {
    const { hierarchy } = workspace;
    type Nodes = ReturnType<typeof hierarchy.nodes>;
    const lines: string[] = [];

    function visit(
      nodes: Nodes,
      depth: number
    ): void {
      for (const node of nodes) {
        const suffix = node.kind === "folder" ? "/" : "";
        lines.push(`${"  ".repeat(depth)}${node.name}${suffix}`);
        visit(node.children, depth + 1);
      }
    }
    visit(hierarchy.nodes(), 0);

    return lines;
  });
}

export async function selectedBlock(
  page: Page
): Promise<string | null> {
  const editor = await editorOf(page);

  return editor.evaluate(({ workspace }) => {
    const { blocks } = workspace;

    return blocks.selected?.name ?? null;
  });
}

export async function blockSummary(
  page: Page,
  name: string
): Promise<BlockSummary | null> {
  const editor = await editorOf(page);

  return editor.evaluate(({ workspace }, blockName) => {
    const { blocks } = workspace;
    const block = [...blocks.values()]
      .find((candidate) => candidate.name === blockName);
    if (block === undefined) {
      return null;
    }

    function roundAxis(
      component: number
    ): number {
      const hundredths = Math.round(component * 100) / 100;

      return Object.is(hundredths, -0) ? 0 : hundredths;
    }

    function rounded(
      value: Vector3Like,
      factor = 1
    ) {
      return {
        x: roundAxis(value.x * factor),
        y: roundAxis(value.y * factor),
        z: roundAxis(value.z * factor)
      };
    }

    return {
      position: rounded(block.position),
      worldPosition: rounded(block.worldPosition),
      rotation: rounded(block.rotation, 180 / Math.PI),
      size: rounded(block.size),
      scale: rounded(block.scale),
      pivotOffset: rounded(block.pivotOffset)
    };
  }, name);
}

export async function blockPoint(
  page: Page,
  name: string
): Promise<ScreenPoint> {
  const editor = await editorOf(page);

  const { view, point } = await editor.evaluate(({ workspace, runtime }, blockName) => {
    const { blocks, gizmo } = workspace;
    const block = [...blocks.values()]
      .find((candidate) => candidate.name === blockName);
    if (block === undefined) {
      throw new Error(`No block named '${blockName}'.`);
    }

    const { camera } = gizmo.controls;
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

  return clientPointOf(view, point);
}

export async function gizmoHandlePoints(
  page: Page,
  axis: Axis
): Promise<[ScreenPoint, ScreenPoint]> {
  const editor = await editorOf(page);
  await page.waitForFunction(({ workspace }) => {
    const { gizmo } = workspace;

    return gizmo.controls.target !== null;
  }, editor);
  await nextFrames(page);

  const { view, points } = await editor.evaluate(({ workspace, runtime }, axisName) => {
    const kDragRatio = 3;
    const { gizmo } = workspace;
    const { controls } = gizmo;
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
    clientPointOf(view, points[0]),
    clientPointOf(view, points[1])
  ];
}

export async function clickBlock(
  page: Page,
  name: string
): Promise<void> {
  await pressAt(page, [await blockPoint(page, name)], {
    settle: nextFrames
  });
}
