// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network/client";
import {
  encodePixelArtDocument,
  PIXEL_ART_DOCUMENT_VERSION,
  type PixelArtDocumentData
} from "@jolly-pixel/pixel-draw.renderer";

// CONSTANTS
const kCatalogRoom = "asset-catalog";
const kPixelArtKind = "pixelart";
const kMaxPathAttempts = 50;
const kBase64Chunk = 0x8000;

interface CatalogCreateCommand {
  type: "catalog:create";
  requestId: string;
  path: string;
  kind: string;
  content: {
    type: "inline";
    encoding: "base64";
    data: string;
  };
}

type CatalogServerMessage =
  | {
    type: "catalog:snapshot" | "catalog:changed";
  }
  | {
    type: "catalog:applied";
    requestId?: string;
    command: string;
    assetId: string;
  }
  | {
    type: "catalog:rejected";
    requestId?: string;
    command: string;
    reason: string;
  };

type CreateResult =
  | { ok: true; assetId: string; }
  | { ok: false; reason: string; };

export interface CreatedPixelArtAsset {
  assetId: string;
  path: string;
}

export class DemoCatalog {
  readonly #room: network.Room<CatalogCreateCommand, CatalogServerMessage>;
  readonly #ready: Promise<void>;
  readonly #pending = new Map<string, (result: CreateResult) => void>();

  constructor(
    client: network.Client
  ) {
    const { promise, resolve } = Promise.withResolvers<void>();
    this.#ready = promise;
    this.#room = client.room<CatalogCreateCommand, CatalogServerMessage>(kCatalogRoom);
    this.#room.on("message", (message) => {
      if (message.type === "catalog:snapshot") {
        resolve();
      }
      else if (message.type === "catalog:applied" || message.type === "catalog:rejected") {
        this.#settle(message);
      }
    });
    this.#room.join();
  }

  async createPixelArt(
    name: string,
    source: HTMLCanvasElement
  ): Promise<CreatedPixelArtAsset> {
    await this.#ready;

    const data = bytesToBase64(
      encodePixelArtDocument(documentFromCanvas(source))
    );
    let reason = "";
    for (let attempt = 0; attempt < kMaxPathAttempts; attempt++) {
      const path = attempt === 0 ?
        `${name}.pixelart` :
        `${name}-${attempt + 1}.pixelart`;
      const result = await this.#create(path, data);
      if (result.ok) {
        return {
          assetId: result.assetId,
          path
        };
      }

      reason = result.reason;
      if (!reason.includes("already used")) {
        break;
      }
    }

    throw new Error(`Could not create "${name}": ${reason}`);
  }

  #create(
    path: string,
    data: string
  ): Promise<CreateResult> {
    const requestId = crypto.randomUUID();
    const { promise, resolve } = Promise.withResolvers<CreateResult>();
    this.#pending.set(requestId, resolve);
    this.#room.send({
      type: "catalog:create",
      requestId,
      path,
      kind: kPixelArtKind,
      content: {
        type: "inline",
        encoding: "base64",
        data
      }
    });

    return promise;
  }

  #settle(
    message: Extract<CatalogServerMessage, { requestId?: string; }>
  ): void {
    if (message.requestId === undefined) {
      return;
    }

    const resolve = this.#pending.get(message.requestId);
    if (resolve === undefined) {
      return;
    }

    this.#pending.delete(message.requestId);
    resolve(message.type === "catalog:applied" ?
      {
        ok: true,
        assetId: message.assetId
      } :
      {
        ok: false,
        reason: message.reason
      }
    );
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

  return {
    version: PIXEL_ART_DOCUMENT_VERSION,
    size: {
      x: source.width,
      y: source.height
    },
    pixels: bytesToBase64(new Uint8Array(data.buffer)),
    uvRegions: []
  };
}

function bytesToBase64(
  bytes: Uint8Array
): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += kBase64Chunk) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + kBase64Chunk));
  }

  return btoa(binary);
}
