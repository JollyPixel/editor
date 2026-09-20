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

// Import Internal Dependencies
import type { VoxelModelEditor } from "#src/boot/VoxelModelEditor.ts";

export type Axis = "X" | "Y" | "Z";

export interface ScreenPoint {
  x: number;
  y: number;
}

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

export async function nextFrames(
  page: Page,
  count = 2
): Promise<void> {
  const editor = await editorOf(page);

  return editor.evaluate(async({ runtime }, frames) => {
    const { world } = runtime;
    for (let index = 0; index < frames; index++) {
      await new Promise<void>((resolve) => {
        world.once("afterUpdate", () => resolve());
      });
    }
  }, count);
}

export async function outline(
  page: Page
): Promise<string[]> {
  const editor = await editorOf(page);

  return editor.evaluate(async({ scene }) => {
    const { hierarchy } = await scene.ready;
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

  return editor.evaluate(async({ scene }) => {
    const { document } = await scene.ready;

    return document.blocks.selected?.name ?? null;
  });
}

export async function blockSummary(
  page: Page,
  name: string
): Promise<BlockSummary | null> {
  const editor = await editorOf(page);

  return editor.evaluate(async({ scene }, blockName) => {
    const { document } = await scene.ready;
    const block = [...document.blocks.values()]
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

  return editor.evaluate(async({ scene, runtime }, blockName) => {
    const { document, gizmo } = await scene.ready;
    const block = [...document.blocks.values()]
      .find((candidate) => candidate.name === blockName);
    if (block === undefined) {
      throw new Error(`No block named '${blockName}'.`);
    }

    const { camera } = gizmo.controls;
    const bounds = runtime.world.renderer.canvas.getBoundingClientRect();

    block.mesh.updateWorldMatrix(true, false);
    camera.updateMatrixWorld(true);
    const point = block.mesh.getWorldPosition(block.position).project(camera);

    return {
      x: bounds.left + ((point.x + 1) / 2 * bounds.width),
      y: bounds.top + ((1 - point.y) / 2 * bounds.height)
    };
  }, name);
}

export async function gizmoHandlePoints(
  page: Page,
  axis: Axis
): Promise<[ScreenPoint, ScreenPoint]> {
  const editor = await editorOf(page);
  await page.waitForFunction(async({ scene }) => {
    const { gizmo } = await scene.ready;

    return gizmo.controls.target !== null;
  }, editor);
  await nextFrames(page);

  return editor.evaluate(async({ scene, runtime }, axisName) => {
    const kDragRatio = 3;
    const { gizmo } = await scene.ready;
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

    function screenPointAt(
      ratio: number
    ): ScreenPoint {
      const point = origin.clone()
        .addScaledVector(reach, ratio)
        .project(camera);

      return {
        x: bounds.left + ((point.x + 1) / 2 * bounds.width),
        y: bounds.top + ((1 - point.y) / 2 * bounds.height)
      };
    }
    const points: [ScreenPoint, ScreenPoint] = [
      screenPointAt(1),
      screenPointAt(kDragRatio)
    ];

    return points;
  }, axis);
}

export async function pressAt(
  page: Page,
  points: ScreenPoint[]
): Promise<void> {
  const [first, ...rest] = points;
  await page.mouse.move(first.x, first.y);
  await nextFrames(page);
  await page.mouse.down();
  await nextFrames(page);
  for (const point of rest) {
    await page.mouse.move(point.x, point.y, { steps: 4 });
    await nextFrames(page);
  }
  await page.mouse.up();
  await nextFrames(page);
}

export async function clickBlock(
  page: Page,
  name: string
): Promise<void> {
  await pressAt(page, [await blockPoint(page, name)]);
}
