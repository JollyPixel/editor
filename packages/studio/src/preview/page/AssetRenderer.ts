// Import Third-party Dependencies
import type { AssetReferenceData } from "@jolly-pixel/asset";
import {
  EditorRuntime,
  type SessionConnection
} from "@jolly-pixel/editor.host";
import type { SceneAssetResolver } from "@jolly-pixel/editor.host/scene";
import { Systems } from "@jolly-pixel/engine";

// Import Internal Dependencies
import { PreviewCapture } from "./PreviewCapture.ts";
import type {
  PreviewKind,
  PreviewKinds
} from "./PreviewKinds.ts";
import { PreviewScene } from "./PreviewScene.ts";

// CONSTANTS
const kReadyTimeoutMs = 15_000;
const kMaxSettleFrames = 120;

type PreviewRuntime = EditorRuntime["runtime"];

export interface AssetRendererOptions {
  canvas: string;
  kinds: PreviewKinds;
  session: SessionConnection;
}

export class AssetRenderer {
  static async create(
    options: AssetRendererOptions
  ): Promise<AssetRenderer> {
    void Systems.BakedRoomEnvironment.load();
    const editorRuntime = await EditorRuntime.create(options.canvas, {
      framed: true,
      focusCanvas: false
    });
    await editorRuntime.load(new PreviewScene());

    return new AssetRenderer(editorRuntime.runtime, options);
  }

  readonly #runtime: PreviewRuntime;
  readonly #kinds: PreviewKinds;
  readonly #session: SessionConnection;
  readonly #capture: PreviewCapture;

  private constructor(
    runtime: PreviewRuntime,
    options: AssetRendererOptions
  ) {
    this.#runtime = runtime;
    this.#kinds = options.kinds;
    this.#session = options.session;
    this.#capture = new PreviewCapture({
      renderer: runtime.renderer,
      scene: runtime.world.sceneManager.graph.scene
    });
  }

  async render(
    assetId: string,
    size: number
  ): Promise<Uint8Array<ArrayBuffer>> {
    const session = this.#session;
    const record = session.catalog.record(assetId);
    if (record === undefined) {
      throw new Error(`No asset "${assetId}" in the catalog.`);
    }
    const kind = this.#kinds.find(record.kind);
    if (kind === undefined) {
      throw new Error(`No scene component shows "${record.kind}" assets.`);
    }

    const resolver = kind.source.open(
      {
        assets: session.assets,
        catalog: session.catalog
      },
      {
        loaded: () => undefined
      }
    );
    try {
      if (resolver.ready === undefined) {
        throw new Error(`"${record.kind}" assets never say they are ready.`);
      }
      const reference: AssetReferenceData = {
        id: assetId,
        kind: record.kind
      };
      await withTimeout(
        resolver.ready(reference),
        kReadyTimeoutMs,
        `"${assetId}" did not load in time.`
      );

      return await this.#show(kind, reference, resolver, size);
    }
    finally {
      resolver.dispose();
    }
  }

  async #show(
    kind: PreviewKind,
    reference: AssetReferenceData,
    resolver: SceneAssetResolver,
    size: number
  ): Promise<Uint8Array<ArrayBuffer>> {
    const actor = this.#runtime.world.createActor("asset-preview");
    try {
      const { definition, initialData = {} } = kind.component;
      const component = definition.create(
        actor,
        definition.parse(initialData),
        {
          mode: "edit",
          assets: new Systems.ComponentAssets(
            definition.assets ?? {},
            {
              [kind.slot]: reference
            },
            {
              resolve: <TValue>(asset: AssetReferenceData) => (
                resolver.resolve(asset) as TValue | null
              )
            }
          )
        }
      );
      if (component === null) {
        throw new Error(`The "${definition.type}" component built nothing.`);
      }
      await this.#runtime.compiledFrame();
      for (
        let frame = 0;
        frame < kMaxSettleFrames && this.#runtime.world.animating;
        frame++
      ) {
        await this.#runtime.nextFrame();
      }

      return await this.#capture.capture(actor.node.object3D, size);
    }
    finally {
      actor.destroy();
    }
  }
}

async function withTimeout(
  promise: Promise<void>,
  timeoutMs: number,
  message: string
): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  try {
    await Promise.race([promise, timeout]);
  }
  finally {
    clearTimeout(timer);
  }
}
