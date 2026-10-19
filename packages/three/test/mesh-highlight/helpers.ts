// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import {
  MeshHighlight,
  type MeshHighlightAppearance,
  type MeshHighlightMode,
  type MeshHighlightOptions,
  type MeshHighlightRenderer,
  type MeshHighlightRendererContext,
  type ResolvedHighlightIndicator
} from "#src/index.ts";

export class TestHighlightRenderer implements MeshHighlightRenderer {
  snapshots: Array<readonly ResolvedHighlightIndicator[]> = [];
  appearances: MeshHighlightAppearance[] = [];
  renderCount = 0;
  disposeCount = 0;
  failSync = false;

  get latest(): readonly ResolvedHighlightIndicator[] {
    return this.snapshots.at(-1) ?? [];
  }

  sync(
    indicators: readonly ResolvedHighlightIndicator[],
    appearance: MeshHighlightAppearance
  ): void {
    if (this.failSync) {
      throw new Error("sync failed");
    }
    this.snapshots.push(indicators);
    this.appearances.push(appearance);
  }

  render(): void {
    this.renderCount += 1;
  }

  dispose(): void {
    this.disposeCount += 1;
  }
}

export interface HighlightHarness {
  highlight: MeshHighlight;
  contexts: MeshHighlightRendererContext[];
  presentations: TestHighlightRenderer[];
}

export function createRendererStub(): THREE.WebGPURenderer {
  return {
    render: () => void 0
  } as unknown as THREE.WebGPURenderer;
}

export function createHarness(
  options: {
    failingModes?: readonly MeshHighlightMode[];
  } & Partial<MeshHighlightOptions> = {}
): HighlightHarness {
  const { failingModes = [], ...highlightOptions } = options;
  const contexts: MeshHighlightRendererContext[] = [];
  const presentations: TestHighlightRenderer[] = [];
  const highlight = new MeshHighlight({
    renderer: createRendererStub(),
    scene: new THREE.Scene(),
    camera: new THREE.PerspectiveCamera(),
    visibility: false,
    rendererFactory: (context) => {
      const presentation = new TestHighlightRenderer();
      presentation.failSync = failingModes.includes(context.mode);
      contexts.push(context);
      presentations.push(presentation);

      return presentation;
    },
    ...highlightOptions
  });

  return { highlight, contexts, presentations };
}

export function createBoxMesh(
  size: [number, number, number] = [1, 1, 1]
): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(...size));
}
