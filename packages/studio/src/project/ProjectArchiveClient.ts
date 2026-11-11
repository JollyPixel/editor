// Import Third-party Dependencies
import {
  AttachmentDisposition,
  PROJECT_ROUTES,
  type ApiRoute
} from "@jolly-pixel/server";

// Import Internal Dependencies
import {
  ApiEndpoint,
  type ApiEndpointOptions
} from "../api/ApiEndpoint.ts";
import { FileDownload } from "../browser/FileDownload.ts";

// CONSTANTS
const kFallbackFileName = "project.zip";
const kFallbackGameFileName = "game.zip";

export class ProjectArchiveClient {
  #endpoint: ApiEndpoint;

  constructor(
    options: ApiEndpointOptions
  ) {
    this.#endpoint = new ApiEndpoint(options);
  }

  download(): Promise<FileDownload> {
    return this.#download(PROJECT_ROUTES.archive, kFallbackFileName);
  }

  downloadGame(): Promise<FileDownload> {
    return this.#download(PROJECT_ROUTES.game, kFallbackGameFileName);
  }

  async #download(
    route: ApiRoute,
    fallbackFileName: string
  ): Promise<FileDownload> {
    const response = await this.#endpoint.send(route);
    const disposition = AttachmentDisposition.parse(
      response.headers.get("content-disposition")
    );

    return new FileDownload(
      await response.blob(),
      disposition?.fileName ?? fallbackFileName
    );
  }
}
