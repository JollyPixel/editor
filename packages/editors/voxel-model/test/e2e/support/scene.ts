// Import Third-party Dependencies
import type { Page } from "@playwright/test";
import type {
  Mesh,
  Vector3Like
} from "three";

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

export function nextFrames(
  page: Page,
  count = 2
): Promise<void> {
  return page.evaluate(async(frames) => {
    const { world } = window.voxelModelEditor!.runtime;
    for (let index = 0; index < frames; index++) {
      await new Promise<void>((resolve) => {
        world.once("afterUpdate", () => resolve());
      });
    }
  }, count);
}

export function outline(
  page: Page
): Promise<string[]> {
  return page.evaluate(async() => {
    const { hierarchy } = await window.voxelModelEditor!.scene.ready;
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

export function selectedBlock(
  page: Page
): Promise<string | null> {
  return page.evaluate(async() => {
    const { document } = await window.voxelModelEditor!.scene.ready;

    return document.blocks.selected?.name ?? null;
  });
}

export function blockSummary(
  page: Page,
  name: string
): Promise<BlockSummary | null> {
  return page.evaluate(async(blockName) => {
    const { document } = await window.voxelModelEditor!.scene.ready;
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

export function blockPoint(
  page: Page,
  name: string
): Promise<ScreenPoint> {
  return page.evaluate(async(blockName) => {
    const editor = window.voxelModelEditor!;
    const { document, gizmo } = await editor.scene.ready;
    const block = [...document.blocks.values()]
      .find((candidate) => candidate.name === blockName)!;
    const { camera } = gizmo.controls;
    const bounds = editor.runtime.world.renderer.canvas.getBoundingClientRect();

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
  await page.waitForFunction(async() => {
    const { gizmo } = await window.voxelModelEditor!.scene.ready;

    return gizmo.controls.target !== null;
  });
  await nextFrames(page);

  return page.evaluate(async(axisName) => {
    const kDragRatio = 3;
    const editor = window.voxelModelEditor!;
    const { gizmo } = await editor.scene.ready;
    const { controls } = gizmo;
    const { camera, helper } = controls;
    const bounds = editor.runtime.world.renderer.canvas.getBoundingClientRect();
    const handleName = [
      "transform-handle",
      controls.mode,
      axisName.toLowerCase(),
      "positive"
    ].join("-");
    const picker = helper
      .getObjectByName(handleName)!
      .getObjectByName("transform-handle-picker") as Mesh;

    camera.updateMatrixWorld(true);
    helper.updateMatrixWorld(true);
    const origin = helper.position.clone()
      .setFromMatrixPosition(helper.matrixWorld);
    picker.geometry.computeBoundingBox();
    const grab = picker.localToWorld(
      picker.geometry.boundingBox!.getCenter(picker.position.clone())
    );
    const reach = grab.sub(origin);

    return [1, kDragRatio].map((ratio) => {
      const point = origin.clone()
        .addScaledVector(reach, ratio)
        .project(camera);

      return {
        x: bounds.left + ((point.x + 1) / 2 * bounds.width),
        y: bounds.top + ((1 - point.y) / 2 * bounds.height)
      };
    }) as [{ x: number; y: number; }, { x: number; y: number; }];
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
