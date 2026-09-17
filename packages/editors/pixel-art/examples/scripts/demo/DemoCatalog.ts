// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network/client";
import {
  CatalogClient,
  catalogRoom
} from "@jolly-pixel/asset-server/catalog/client";
import { PIXEL_ART_KIND } from "@jolly-pixel/asset.pixel-art/network/client.ts";
import {
  createPixelArtDocument,
  encodePixelArtDocument,
  type PixelArtDocumentData
} from "@jolly-pixel/pixel-draw.renderer";

export interface CreatedPixelArtAsset {
  assetId: string;
  path: string;
}

export class DemoCatalog {
  readonly #catalog: CatalogClient;

  constructor(
    client: network.Client
  ) {
    this.#catalog = new CatalogClient(catalogRoom(client));
  }

  async createPixelArt(
    name: string,
    source: HTMLCanvasElement
  ): Promise<CreatedPixelArtAsset> {
    const path = `${name}.pixelart`;
    const assetId = await this.#catalog.create(
      path,
      encodePixelArtDocument(documentFromCanvas(source)),
      {
        kind: PIXEL_ART_KIND,
        onConflict: "suffix"
      }
    );

    return {
      assetId,
      path: this.#catalog.record(assetId)?.source ?? path
    };
  }
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
