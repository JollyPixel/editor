// Import Third-party Dependencies
import type {
  JSHandle,
  Page
} from "@playwright/test";
import type { Vector3Like } from "three";
import type { MaterialSurfaceJSON } from "@jolly-pixel/asset.voxel-model/client";

// Import Internal Dependencies
import type { VoxelModelEditor } from "#src/boot/VoxelModelEditor.ts";

export type SurfaceSource = "scene" | "document";

export interface BlockSummary {
  visible: boolean;
  position: Vector3Like;
  worldPosition: Vector3Like;
  rotation: Vector3Like;
  size: Vector3Like;
  scale: Vector3Like;
  pivotOffset: Vector3Like;
}

export function resolveEditor(
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
  const editor = await resolveEditor(page);

  return editor.evaluate(({ editing }) => {
    const { hierarchy } = editing;
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

export async function materialOutline(
  page: Page
): Promise<string[]> {
  const editor = await resolveEditor(page);

  return editor.evaluate(({ editing }) => {
    const { materials } = editing.document.tree;
    const lines: string[] = [];

    function visit(
      parentId: string | null,
      depth: number
    ): void {
      for (const entry of materials.listChildren(parentId)) {
        const suffix = entry.kind === "folder" ? "/" : "";
        lines.push(`${"  ".repeat(depth)}${entry.name}${suffix}`);
        visit(entry.id, depth + 1);
      }
    }
    visit(null, 0);

    return lines;
  });
}

export async function blockSurface(
  page: Page,
  name: string,
  source: SurfaceSource
): Promise<MaterialSurfaceJSON> {
  const editor = await resolveEditor(page);

  return editor.evaluate(({ editing }, query) => {
    function findSurface(): MaterialSurfaceJSON | null | undefined {
      if (query.source === "scene") {
        return [...editing.blocks.values()]
          .find((block) => block.name === query.name)?.surface;
      }

      const { tree } = editing.document;
      const node = [...tree.nodes.blocks()].find((block) => block.name === query.name);

      return node?.materialId === undefined ?
        undefined :
        tree.materials.material(node.materialId)?.surface;
    }

    const surface = findSurface();
    if (surface === null || surface === undefined) {
      throw new Error(`No material on the ${query.source} block "${query.name}".`);
    }

    return surface;
  }, { name, source });
}

export async function blockSummary(
  page: Page,
  name: string
): Promise<BlockSummary> {
  const editor = await resolveEditor(page);

  return editor.evaluate(({ editing }, blockName) => {
    const { blocks } = editing;
    const block = [...blocks.values()]
      .find((candidate) => candidate.name === blockName);
    if (block === undefined) {
      throw new Error(`No block named "${blockName}".`);
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
      visible: block.visible,
      position: rounded(block.position),
      worldPosition: rounded(block.worldPosition),
      rotation: rounded(block.rotation, 180 / Math.PI),
      size: rounded(block.size),
      scale: rounded(block.scale),
      pivotOffset: rounded(block.pivotOffset)
    };
  }, name);
}
