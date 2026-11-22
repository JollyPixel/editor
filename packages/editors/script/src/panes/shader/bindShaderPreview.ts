// Import Third-party Dependencies
import type { ScriptDocument } from "@jolly-pixel/asset.script/client";
import {
  EditorRuntime,
  type EditorContext
} from "@jolly-pixel/editor.host";
import type { MeshGeometryKind } from "@jolly-pixel/backend.three";
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
import { ShaderCompilation } from "../../shader/ShaderCompilation.ts";
import "./ShaderOutput.ts";
import { ShaderPreviewScene } from "./ShaderPreviewScene.ts";

export interface ShaderPreviewOptions {
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
const kSizes: JollyOption<number>[] = [1, 2, 4, 8, 16].map((size) => {
  return {
    value: size,
    label: `×${size}`
  };
});

type PreviewSelect = HTMLElementTagNameMap["jolly-select"];

export async function bindShaderPreview(
  options: ShaderPreviewOptions
): Promise<() => void> {
  const { document, name, context } = options;
  const view = window.document.querySelector<HTMLElement>("#shader-preview");
  const canvas = view?.querySelector("canvas") ?? null;
  const output = view?.querySelector("jolly-shader-output") ?? null;
  const geometry = view?.querySelector<PreviewSelect>("jolly-select.preview-geometry") ?? null;
  const size = view?.querySelector<PreviewSelect>("jolly-select.preview-size") ?? null;
  if (
    view === null ||
    canvas === null ||
    output === null ||
    geometry === null ||
    size === null
  ) {
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
      geometry: "sphere"
    });
    await editorRuntime.load(scene);

    teardown.defer(
      bindSelect(geometry, kGeometries, "sphere", (kind) => scene.reshape(kind))
    );
    teardown.defer(
      bindSelect(size, kSizes, 1, (scale) => scene.rescale(scale))
    );

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
          message: errorMessage(error)
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

function bindSelect<TValue>(
  select: PreviewSelect,
  options: JollyOption<TValue>[],
  initial: TValue,
  apply: (value: TValue) => void
): () => void {
  function onChange(
    event: Event
  ): void {
    const detail = readDetail<JollyChangeDetail<TValue>>(event);
    if (detail !== null) {
      select.value = detail.value;
      apply(detail.value);
    }
  }

  select.options = options;
  select.value = initial;
  select.addEventListener("jolly-change", onChange);

  return () => select.removeEventListener("jolly-change", onChange);
}
