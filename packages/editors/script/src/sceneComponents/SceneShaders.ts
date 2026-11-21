// Import Third-party Dependencies
import type { AssetReferenceData } from "@jolly-pixel/asset";
import {
  SHADER_KIND,
  textDocumentKind,
  type ScriptDocument
} from "@jolly-pixel/asset.script/client";
import type { AssetLease } from "@jolly-pixel/editor.host";
import type {
  SceneAssetContext,
  SceneAssetResolver,
  SceneAssetUpdates
} from "@jolly-pixel/editor.host/scene";
import type { Shader } from "@jolly-pixel/engine";

// Import Internal Dependencies
import type { ShaderCompilation } from "../shader/ShaderCompilation.ts";

interface OpenShader {
  lease: AssetLease<ScriptDocument>;
  shader: Shader | null;
  compilation: ShaderCompilation | null;
}

// CONSTANTS
export const SHADER_DOCUMENT_KIND = textDocumentKind(SHADER_KIND);

export class SceneShaders implements SceneAssetResolver<Shader> {
  #session: SceneAssetContext;
  #updates: SceneAssetUpdates;
  #shaders = new Map<string, OpenShader>();
  #disposed = false;

  constructor(
    session: SceneAssetContext,
    updates: SceneAssetUpdates
  ) {
    this.#session = session;
    this.#updates = updates;
  }

  resolve(
    reference: AssetReferenceData
  ): Shader | null {
    return this.#open(reference.id).shader;
  }

  dispose(): void {
    this.#disposed = true;
    for (const { lease, compilation } of this.#shaders.values()) {
      compilation?.dispose();
      lease.release();
    }
    this.#shaders.clear();
  }

  #open(
    assetId: string
  ): OpenShader {
    let open = this.#shaders.get(assetId);
    if (open === undefined) {
      const lease = this.#session.assets.open(SHADER_DOCUMENT_KIND, assetId);
      const entry: OpenShader = {
        lease,
        shader: null,
        compilation: null
      };
      Promise.all([lease.ready, import("../shader/ShaderCompilation.ts")]).then(
        ([, { ShaderCompilation }]) => {
          if (this.#disposed) {
            return;
          }
          const path = () => this.#session.catalog.record(assetId)?.path ?? assetId;
          entry.compilation = new ShaderCompilation({
            document: lease.document,
            name: path,
            compiled: (shader) => {
              entry.shader = shader;
              this.#updates.loaded();
            },
            failed: (error) => {
              console.warn(`Shader "${path()}" kept its last working version`, error);
            }
          });
        },
        () => undefined
      );
      open = entry;
      this.#shaders.set(assetId, open);
    }

    return open;
  }
}
