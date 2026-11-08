// Import Third-party Dependencies
import type { ScriptDocument } from "@jolly-pixel/asset.script/client";
import {
  EditorRuntime,
  type EditorContext
} from "@jolly-pixel/editor.host";
import {
  MESH_GEOMETRY_DEFAULTS,
  type MeshGeometryKind
} from "@jolly-pixel/engine";
import {
  readDetail,
  type JollyChangeDetail,
  type JollyOption
} from "@jolly-pixel/ui";
import "@jolly-pixel/ui/elements/select";
import {
  Teardown,
  errorMessage
} from "@jolly-pixel/utils";

// Import Internal Dependencies
import { ShaderError } from "../../shader/errors/ShaderError.ts";
import { ShaderCompilation } from "../../shader/ShaderCompilation.ts";
import "./ShaderOutput.ts";
import { ShaderPreviewScene } from "./ShaderPreviewScene.ts";

export interface ShaderPreviewOptions {
  view: HTMLElement;
  document: ScriptDocument;
  name: string;
  context: Pick<EditorContext, "logger" | "preferences">;
}

// CONSTANTS
const kGeometries: JollyOption<MeshGeometryKind>[] = [
  {
    value: "sphere",
    label: "Sphere"
  },
  {
    value: "box",
    label: "Box"
  },
  {
    value: "plane",
    label: "Plane"
  },
  {
    value: "torus",
    label: "Torus"
  },
  {
    value: "cylinder",
    label: "Cylinder"
  },
  {
    value: "capsule",
    label: "Capsule"
  }
];

export async function bindShaderPreview(
  options: ShaderPreviewOptions
): Promise<() => void> {
  const { view, document, name, context } = options;
  const canvas = view.querySelector("canvas");
  const output = view.querySelector("jolly-shader-output");
  const geometry = view.querySelector("jolly-select");
  if (canvas === null || output === null || geometry === null) {
    throw new Error("bindShaderPreview: the page is missing a shader preview pane.");
  }

  const teardown = new Teardown();
  try {
    view.hidden = false;
    teardown.defer(() => {
      view.hidden = true;
    });

    const editorRuntime = await EditorRuntime.create(canvas, {
      focusCanvas: false,
      logger: context.logger
    });
    teardown.defer(() => editorRuntime.dispose());
    const scene = new ShaderPreviewScene({
      preferences: context.preferences,
      geometry: MESH_GEOMETRY_DEFAULTS.sphere
    });
    await editorRuntime.load(scene);

    const reshape = reshapeOnChange(scene);
    geometry.options = kGeometries;
    geometry.value = "sphere";
    geometry.addEventListener("jolly-change", reshape);
    teardown.defer(() => geometry.removeEventListener("jolly-change", reshape));

    const compilation = new ShaderCompilation({
      document,
      name: () => name,
      compiled: async(shader, signal) => {
        const build = await scene.build(shader);
        if (!signal.aborted) {
          scene.show(shader);
          output.state = {
            kind: "built",
            ...build
          };
        }
      },
      failed: (error) => {
        output.state = {
          kind: "failed",
          message: errorMessage(error),
          position: error instanceof ShaderError ? error.position : null
        };
      }
    });
    teardown.defer(() => compilation.dispose());

    return () => teardown.run();
  }
  catch (error) {
    throw teardown.unwind(error);
  }
}

function reshapeOnChange(
  scene: ShaderPreviewScene
): (event: Event) => void {
  return (event) => {
    const detail = readDetail<JollyChangeDetail<MeshGeometryKind>>(event);
    if (detail !== null) {
      scene.reshape(MESH_GEOMETRY_DEFAULTS[detail.value]);
    }
  };
}
