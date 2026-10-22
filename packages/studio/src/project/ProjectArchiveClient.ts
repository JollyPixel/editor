// Import Internal Dependencies
import {
  ApiEndpoint,
  type ApiEndpointOptions
} from "../api/ApiEndpoint.ts";
import { FileDownload } from "../browser/FileDownload.ts";
import { AttachmentDisposition } from "../../shared/AttachmentDisposition.ts";
import { PROJECT_ARCHIVE_PATH } from "../../shared/api/project.ts";

// CONSTANTS
const kFallbackFileName = "project.zip";

export class ProjectArchiveClient {
  #endpoint: ApiEndpoint;

  constructor(
    options: ApiEndpointOptions
  ) {
    this.#endpoint = new ApiEndpoint(options);
  }

  async download(): Promise<FileDownload> {
    const response = await this.#endpoint.send(PROJECT_ARCHIVE_PATH);
    const disposition = AttachmentDisposition.parse(
      response.headers.get("content-disposition")
    );

    return new FileDownload(
      await response.blob(),
      disposition?.fileName ?? kFallbackFileName
    );
  }
}
