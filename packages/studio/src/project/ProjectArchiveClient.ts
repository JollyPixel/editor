// Import Third-party Dependencies
import {
  AttachmentDisposition,
  GAME_ROUTES,
  PROJECT_ROUTES,
  type ApiRoute,
  type GameExportAssets
} from "@jolly-pixel/server";

// Import Internal Dependencies
import {
  ApiEndpoint,
  type ApiEndpointOptions,
  type ApiRequest
} from "../api/ApiEndpoint.ts";
import { FileDownload } from "../browser/FileDownload.ts";
import { DownloadStoppedError } from "./errors/DownloadStoppedError.ts";

// CONSTANTS
const kProjectDownload: ArchiveDownload = {
  route: PROJECT_ROUTES.archive,
  fallbackFileName: "project.zip",
  stopped: "The download stopped before its end."
};
const kGameDownload: ArchiveDownload = {
  route: GAME_ROUTES.export,
  fallbackFileName: "game.zip",
  stopped: "The export stopped before its end, most likely on an asset " +
    "that fails to build: Play the game to see which one."
};

interface ArchiveDownload {
  readonly route: ApiRoute;
  readonly fallbackFileName: string;
  readonly stopped: string;
}

export class ProjectArchiveClient {
  #project: ApiEndpoint;
  #game: ApiEndpoint;

  constructor(
    project: ApiEndpointOptions,
    game: ApiEndpointOptions
  ) {
    this.#project = new ApiEndpoint(project);
    this.#game = new ApiEndpoint(game);
  }

  download(): Promise<FileDownload> {
    return this.#download(this.#project, kProjectDownload);
  }

  downloadGame(
    assets: GameExportAssets
  ): Promise<FileDownload> {
    return this.#download(this.#game, kGameDownload, {
      query: { assets }
    });
  }

  async #download(
    endpoint: ApiEndpoint,
    download: ArchiveDownload,
    request: ApiRequest = {}
  ): Promise<FileDownload> {
    const response = await endpoint.send(download.route, request);
    const disposition = AttachmentDisposition.parse(
      response.headers.get("content-disposition")
    );
    const blob = await response.blob().catch((error: unknown) => {
      throw new DownloadStoppedError(download.stopped, { cause: error });
    });

    return new FileDownload(
      blob,
      disposition?.fileName ?? download.fallbackFileName
    );
  }
}
