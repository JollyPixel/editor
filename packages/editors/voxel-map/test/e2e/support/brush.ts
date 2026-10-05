// Import Third-party Dependencies
import type { Page } from "@playwright/test";

export function brushState(
  page: Page
) {
  return page.evaluate(() => {
    const { brush } = window.voxelMapEditor!.workspace.state;

    return {
      blockId: brush.blockId,
      size: brush.size,
      mode: brush.mode,
      axis: brush.axis,
      pattern: brush.pattern
    };
  });
}

export function ghostState(
  page: Page
) {
  return page.evaluate(() => {
    const { localBrush } = window.voxelMapEditor!.workspace;
    const ghost = localBrush.actor.object3D.getObjectByName("ghost-block");

    return {
      visible: ghost?.visible ?? false,
      position: ghost?.position.toArray() ?? null
    };
  });
}

export async function setBrush(
  page: Page,
  patch: { blockId?: number; size?: number; }
): Promise<void> {
  await page.evaluate((values) => {
    const { brush } = window.voxelMapEditor!.workspace.state;
    if (values.blockId !== undefined) {
      brush.blockId = values.blockId;
    }
    if (values.size !== undefined) {
      brush.size = values.size;
    }
  }, patch);
}
