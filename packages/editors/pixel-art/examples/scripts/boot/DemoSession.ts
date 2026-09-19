// Import Third-party Dependencies
import * as network from "@jolly-pixel/network/client";
import {
  AssetCatalog,
  type AssetRecord
} from "@jolly-pixel/asset";
import {
  CatalogClient,
  catalogRoom
} from "@jolly-pixel/asset-server/catalog/client";
import {
  PIXEL_ART_KIND,
  createPixelArtAsset,
  pixelArtRoom,
  type PixelArtRoom
} from "@jolly-pixel/asset.pixel-art/network/client.ts";
import {
  createPixelArtDocument,
  type PixelArtDocumentData
} from "@jolly-pixel/pixel-draw.renderer";
import { promptPeerIdentity } from "@jolly-pixel/ui";
import { toPeerMetadata } from "@jolly-pixel/ui/network";

// CONSTANTS
const kIdentityPrompt = {
  title: "Join pixel-draw demo",
  storageKey: "pixel-draw-demo:username"
};

export interface CreatedPixelArtAsset {
  assetId: string;
  path: string;
}

export class DemoSession {
  static async open(
    assetPath: string
  ): Promise<DemoSession> {
    const [identity, asset] = await Promise.all([
      promptPeerIdentity(kIdentityPrompt),
      resolveCanvasAsset(assetPath)
    ]);
    const client = new network.Client({
      profile: toPeerMetadata(identity)
    });

    return new DemoSession(client, asset);
  }

  #client: network.Client;

  readonly asset: AssetRecord;
  readonly catalog: CatalogClient;

  constructor(
    client: network.Client,
    asset: AssetRecord
  ) {
    this.#client = client;
    this.asset = asset;
    this.catalog = new CatalogClient(catalogRoom(client));
  }

  textureRoom(
    assetId: string
  ): PixelArtRoom {
    return pixelArtRoom(this.#client, assetId);
  }

  async createPixelArt(
    name: string,
    source: HTMLCanvasElement
  ): Promise<CreatedPixelArtAsset> {
    const path = `${name}.pixelart`;
    const assetId = await createPixelArtAsset(
      this.catalog,
      path,
      documentFromCanvas(source)
    );

    return {
      assetId,
      path: this.catalog.record(assetId)?.source ?? path
    };
  }

  dispose(): void {
    this.catalog.dispose();
    this.#client.destroy();
  }
}

async function resolveCanvasAsset(
  assetPath: string
): Promise<AssetRecord> {
  const catalog = await AssetCatalog.fetch();
  const record = Array.from(catalog.byKind(PIXEL_ART_KIND)).find(
    (entry) => entry.source === assetPath
  );
  if (record === undefined) {
    throw new Error(`No pixel-art asset at "${assetPath}".`);
  }

  return record;
}

function documentFromCanvas(
  source: HTMLCanvasElement
): PixelArtDocumentData {
  const context = source.getContext("2d", { willReadFrequently: true });
  if (context === null) {
    throw new Error("Could not read the imported image");
  }

  const { data } = context.getImageData(0, 0, source.width, source.height);

  return createPixelArtDocument(
    {
      x: source.width,
      y: source.height
    },
    data
  );
}
