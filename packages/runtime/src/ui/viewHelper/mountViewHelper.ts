// Import Third-party Dependencies
import type * as THREE from "three/webgpu";
import { ViewHelper } from "three/addons/helpers/ViewHelper.js";
import type { Systems } from "@jolly-pixel/engine";

// Import Internal Dependencies
import {
  resolveOverlayAlignment
} from "../overlay/resolveOverlayAnchor.ts";

// CONSTANTS
const kDefaultPosition = "bottom-right";
const kDefaultInset = 0;

export type ViewHelperPosition =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

export interface ViewHelperOptions {
  position?: ViewHelperPosition;
  inset?: number;
}

export interface MountedViewHelper {
  dispose(): void;
}

type ViewHelperLocation = ViewHelper["location"];
type ViewHelperRenderer = Parameters<ViewHelper["render"]>[0];

export interface ViewHelperHost extends Pick<
  Systems.Renderer<THREE.WebGPURenderer>,
  "canvas" | "renderComponents" | "off"
> {
  on(
    type: "draw",
    handler: Systems.RendererEvents<THREE.WebGPURenderer>["draw"]
  ): unknown;
}

export function mountViewHelper(
  renderer: ViewHelperHost,
  options: ViewHelperOptions = {}
): MountedViewHelper {
  const location = resolveViewHelperLocation(
    options.position ?? kDefaultPosition,
    options.inset ?? kDefaultInset
  );

  let helper: ViewHelper | null = null;
  let trackedCamera: THREE.Camera | null = null;

  function releaseHelper(): void {
    helper?.dispose();
    helper = null;
    trackedCamera = null;
  }

  function draw(
    event: { source: THREE.WebGPURenderer; }
  ): void {
    const camera = findViewHelperCamera(renderer.renderComponents);
    if (camera !== trackedCamera) {
      releaseHelper();
      if (camera !== null) {
        helper = new ViewHelper(camera, renderer.canvas);
        helper.location = { ...location };
        trackedCamera = camera;
      }
    }

    helper?.render(event.source as unknown as ViewHelperRenderer);
  }

  renderer.on("draw", draw);

  return {
    dispose() {
      renderer.off("draw", draw);
      releaseHelper();
    }
  };
}

function findViewHelperCamera(
  components: Iterable<Systems.RenderComponent>
): THREE.Camera | null {
  let primary: Systems.RenderComponent | null = null;
  for (const component of components) {
    if (primary === null || component.depth < primary.depth) {
      primary = component;
    }
  }

  return primary?.threeCamera ?? null;
}

function resolveViewHelperLocation(
  position: ViewHelperPosition,
  inset: number
): ViewHelperLocation {
  const [vertical, horizontal] = resolveOverlayAlignment(position);

  return {
    top: vertical === "start" ? inset : null,
    bottom: vertical === "end" ? inset : 0,
    left: horizontal === "start" ? inset : null,
    right: horizontal === "end" ? inset : 0
  };
}
