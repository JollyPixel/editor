// Import Third-party Dependencies
import {
  PixelCollaboration,
  createPixelArtAsset,
  PIXEL_ART_EXTENSION,
  type PixelServerMessage,
  type PixelWireCommand
} from "@jolly-pixel/asset.pixel-art/client";
import {
  createPixelArtDocument,
  UVMap,
  type PixelArtCanvas,
  type PixelArtDocumentData,
  type PixelDocument
} from "@jolly-pixel/pixel-draw.renderer";
import type {
  AssetLease,
  EditorSession
} from "@jolly-pixel/editor.host";
import {
  peerProfileColor,
  readUsername
} from "@jolly-pixel/ui/network";

// Import Internal Dependencies
import type {
  PixelDrawPanel,
  TextureAddRequestDetail,
  TextureCloseRequestDetail
} from "../../src/index.ts";
import {
  TEXTURE_DOCUMENT_KIND
} from "../../src/textures/textureDocumentKind.ts";

export type TextureLease = AssetLease<
  PixelDocument,
  PixelWireCommand,
  PixelServerMessage
>;

export interface TextureTabsOptions {
  panel: PixelDrawPanel;
  session: EditorSession;
  addDelay: number;
}

interface BoundTab {
  texture: TextureLease;
  collaboration: PixelCollaboration;
}

export class TextureTabs {
  readonly #panel: PixelDrawPanel;
  readonly #session: EditorSession;
  readonly #addDelay: number;
  readonly #bound = new Map<string, BoundTab>();
  readonly #synced = new Set<string>();

  constructor(
    options: TextureTabsOptions
  ) {
    this.#panel = options.panel;
    this.#session = options.session;
    this.#addDelay = options.addDelay;

    this.#panel.addEventListener("texture-add-request", this.#onAddRequest);
    this.#panel.addEventListener("texture-close-request", this.#onCloseRequest);
  }

  isSynced(
    textureId: string
  ): boolean {
    return this.#synced.has(textureId);
  }

  attach(
    texture: TextureLease,
    canvas: PixelArtCanvas
  ): Promise<void> {
    const textureId = texture.record.id;
    this.#bound.set(textureId, {
      texture,
      collaboration: new PixelCollaboration({
        room: texture.room,
        canvas,
        label: (_clientId, profile) => readUsername(profile),
        color: peerProfileColor
      })
    });

    return texture.ready.then(() => {
      if (this.#bound.has(textureId)) {
        this.#synced.add(textureId);
      }
    });
  }

  dispose(): void {
    this.#panel.removeEventListener("texture-add-request", this.#onAddRequest);
    this.#panel.removeEventListener("texture-close-request", this.#onCloseRequest);
    for (const textureId of [...this.#bound.keys()]) {
      this.#detach(textureId);
    }
  }

  readonly #onAddRequest = (
    event: CustomEvent<TextureAddRequestDetail>
  ): void => {
    event.detail.respondWith(this.#add(event.detail));
  };

  readonly #onCloseRequest = (
    event: CustomEvent<TextureCloseRequestDetail>
  ): void => {
    this.#detach(event.detail.id);
    this.#panel.removeTexture(event.detail.id);
  };

  async #add(
    detail: TextureAddRequestDetail
  ): Promise<void> {
    const { name, source, uvSize } = detail;
    try {
      await delay(this.#addDelay);
      const { catalog } = this.#session;
      const assetId = await createPixelArtAsset(
        catalog,
        `${name}${PIXEL_ART_EXTENSION}`,
        documentFromCanvas(source, uvSize)
      );
      const lease = this.#session.assets.open(TEXTURE_DOCUMENT_KIND, assetId);
      lease.document.buffer.loadTexture(source);
      const canvas = this.#panel.addTexture({
        id: assetId,
        name,
        tooltip: catalog.record(assetId)?.source ?? `${name}${PIXEL_ART_EXTENSION}`,
        document: lease.document
      });
      await this.attach(lease, canvas);
      const [region] = canvas.uv.regions;
      if (region !== undefined) {
        canvas.uv.select(region.id);
      }
    }
    catch (error) {
      console.error("[pixel-sync] could not add texture", error);
    }
  }

  #detach(
    textureId: string
  ): void {
    const bound = this.#bound.get(textureId);
    if (bound === undefined) {
      return;
    }

    bound.collaboration.destroy();
    bound.texture.release();
    this.#bound.delete(textureId);
    this.#synced.delete(textureId);
  }
}

function documentFromCanvas(
  source: HTMLCanvasElement,
  uvSize: number | null
): PixelArtDocumentData {
  const context = source.getContext("2d", { willReadFrequently: true });
  if (context === null) {
    throw new Error("Could not read the imported image");
  }

  const size = {
    x: source.width,
    y: source.height
  };
  const { data } = context.getImageData(0, 0, size.x, size.y);
  const document = createPixelArtDocument(size, data);
  if (uvSize === null) {
    return document;
  }

  const region = new UVMap({ getCanvasSize: () => size }).create({
    name: "cube 0",
    width: uvSize,
    height: uvSize
  });

  return {
    ...document,
    uvRegions: [region.toJSON()]
  };
}

function delay(
  milliseconds: number
): Promise<void> {
  if (milliseconds <= 0) {
    return Promise.resolve();
  }

  const { promise, resolve } = Promise.withResolvers<void>();
  window.setTimeout(resolve, milliseconds);

  return promise;
}
