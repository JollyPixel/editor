// Import Third-party Dependencies
import type * as THREE from "three/webgpu";
import { ViewHelper } from "three/addons/helpers/ViewHelper.js";
import type { Systems } from "@jolly-pixel/ecs";

// Import Internal Dependencies
import type { ThreeRenderComponent } from "../../rendering/ThreeRenderComponent.ts";
import type {
  ViewHelperPosition,
  ViewHelperSettings
} from "./ViewHelperSettings.ts";

export interface MountedViewHelper {
  dispose(): void;
}

type ViewHelperLocation = ViewHelper["location"];
type ViewHelperRenderer = Parameters<ViewHelper["render"]>[0];

export interface ViewHelperHost extends Pick<
  Systems.Renderer<THREE.WebGPURenderer>,
  "canvas" | "off"
> {
  readonly renderComponents: readonly ThreeRenderComponent[];
  on(
    type: "draw",
    handler: Systems.RendererEvents<THREE.WebGPURenderer>["draw"]
  ): unknown;
}

export function mountViewHelper(
  renderer: ViewHelperHost,
  settings: Pick<ViewHelperSettings, "position" | "inset" | "hidden">
): MountedViewHelper {
  const location = resolveViewHelperLocation(
    settings.position,
    settings.inset
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
    if (settings.hidden) {
      return;
    }

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
  components: Iterable<ThreeRenderComponent>
): THREE.Camera | null {
  let primary: ThreeRenderComponent | null = null;
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
  const top = position.startsWith("top");
  const left = position.endsWith("left");

  return {
    top: top ? inset : null,
    bottom: top ? 0 : inset,
    left: left ? inset : null,
    right: left ? 0 : inset
  };
}
