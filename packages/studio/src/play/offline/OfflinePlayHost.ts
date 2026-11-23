// Import Third-party Dependencies
import {
  GAME_FAILURES,
  GAME_URL_PATH,
  GameArchive,
  PLAY_PAGE_PATHNAMES,
  PlayableGame,
  UnknownAssetError,
  parseGameRequest,
  type GameArtifact,
  type GameBackend,
  type GameExportAssets,
  type GameRequest,
  type PlayerBundle
} from "@jolly-pixel/server";

// Import Internal Dependencies
import type { OfflineGameSections } from "../../project/OfflineGameSettings.ts";
import {
  PLAY_ACCEPTED,
  PLAY_HEARTBEAT_MS,
  PLAY_RESPONSE,
  PLAY_ROOT,
  parsePlayRequest,
  playChannelName,
  type PlayReply,
  type PlayRequest,
  type PlayResponse
} from "./protocol.ts";

// CONSTANTS
const kNoStore = "no-store";
const kJson = "application/json";
const kHtml = "text/html; charset=utf-8";
const kZip = "application/zip";

export interface OfflinePlayHostOptions {
  backend: GameBackend;
  settings: OfflineGameSections;
  page: () => Promise<string>;
  player: () => Promise<PlayerBundle>;
}

export class OfflinePlayHost {
  #options: OfflinePlayHostOptions;

  constructor(
    options: OfflinePlayHostOptions
  ) {
    this.#options = options;
  }

  serve(
    offline: string
  ): () => void {
    const channel = new BroadcastChannel(playChannelName(offline));
    const closing = new AbortController();
    channel.addEventListener("message", (event) => {
      const request = parsePlayRequest(event.data);
      if (request !== undefined) {
        void this.#reply(channel, request, closing.signal);
      }
    });

    return () => {
      closing.abort();
      channel.close();
    };
  }

  async #reply(
    channel: BroadcastChannel,
    request: PlayRequest,
    closed: AbortSignal
  ): Promise<void> {
    const { id } = request;
    function accept(): void {
      channel.postMessage({
        type: PLAY_ACCEPTED,
        id
      } satisfies PlayReply);
    }
    accept();
    const heartbeat = setInterval(accept, PLAY_HEARTBEAT_MS);
    function stop(): void {
      clearInterval(heartbeat);
    }
    closed.addEventListener("abort", stop);
    try {
      const response = await this.#answer(new URL(request.path, PLAY_ROOT));
      if (!closed.aborted) {
        channel.postMessage({
          type: PLAY_RESPONSE,
          id,
          ...response
        } satisfies PlayReply);
      }
    }
    finally {
      stop();
      closed.removeEventListener("abort", stop);
    }
  }

  async #answer(
    url: URL
  ): Promise<PlayResponse> {
    try {
      if (PLAY_PAGE_PATHNAMES.has(url.pathname)) {
        return reply(
          kHtml,
          kNoStore,
          this.#game().playPage(await this.#options.page())
        );
      }

      return await this.#route(gameRequest(url));
    }
    catch (error) {
      return failure(error);
    }
  }

  async #route(
    request: GameRequest
  ): Promise<PlayResponse> {
    switch (request.route) {
      case "manifest":
        return reply(
          kJson,
          kNoStore,
          JSON.stringify(this.#game().manifest(request.query.start))
        );
      case "artifact":
        return built(await this.#game().artifact(
          request.params.assetId,
          request.params.revision
        ));
      case "module":
        return built(await this.#game().module(
          request.params["*"],
          request.query.revision
        ));
      case "export":
        return reply(kZip, kNoStore, await this.#export(request.query.assets));
      default:
        return request satisfies never;
    }
  }

  async #export(
    assets: GameExportAssets
  ): Promise<Uint8Array> {
    const { backend, settings } = this.#options;
    const archive = new GameArchive({
      backend,
      start: settings.game.start,
      physics: settings.physics
    });
    const chunks: Uint8Array[] = [];
    for await (const chunk of archive.zip(await this.#options.player(), assets)) {
      chunks.push(chunk);
    }

    return concat(chunks);
  }

  #game(): PlayableGame {
    const { backend, settings } = this.#options;

    return new PlayableGame({
      backend,
      physics: settings.physics,
      opens: () => true
    });
  }
}

function gameRequest(
  url: URL
): GameRequest {
  const { pathname, searchParams } = url;
  const request = pathname.startsWith(GAME_URL_PATH) ?
    parseGameRequest(pathname.slice(GAME_URL_PATH.length), searchParams) :
    null;
  if (request === null) {
    throw new UnknownAssetError(pathname);
  }

  return request;
}

function reply(
  contentType: string,
  cacheControl: string,
  body: string | Uint8Array
): PlayResponse {
  return {
    status: 200,
    contentType,
    cacheControl,
    body: typeof body === "string" ? new TextEncoder().encode(body) : body
  };
}

function built(
  artifact: GameArtifact
): PlayResponse {
  return reply(artifact.type, artifact.cacheControl, artifact.bytes);
}

function failure(
  error: unknown
): PlayResponse {
  const known = GAME_FAILURES.find(([type]) => error instanceof type);
  const failed = reply(kJson, kNoStore, JSON.stringify({
    code: known?.[2] ?? "unknown",
    message: error instanceof Error ? error.message : String(error)
  }));

  return {
    ...failed,
    status: known?.[1] ?? 500
  };
}

function concat(
  chunks: readonly Uint8Array[]
): Uint8Array {
  const bytes = new Uint8Array(
    chunks.reduce((total, chunk) => total + chunk.byteLength, 0)
  );
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return bytes;
}
