// Import Node.js Dependencies
import type { Readable } from "node:stream";

// Import Third-party Dependencies
import type {
  FastifyInstance,
  FastifyRequest,
  FastifySchema
} from "fastify";
import { ARCHIVE_MIME_TYPE } from "@jolly-pixel/asset-server/client";

// Import Internal Dependencies
import { AttachmentDisposition } from "../AttachmentDisposition.ts";
import type { ApiRoute } from "../api.ts";

interface QueryRoute<TQuery> {
  Querystring: TQuery;
}

interface DownloadRoute<TQuery> {
  route: ApiRoute;
  fileName(
    request: FastifyRequest<QueryRoute<TQuery>>
  ): string;
  schema?: FastifySchema;
  body(
    request: FastifyRequest<QueryRoute<TQuery>>
  ): Promise<Uint8Array | Readable>;
}

export function downloadRoute<TQuery = unknown>(
  app: FastifyInstance,
  download: DownloadRoute<TQuery>
): void {
  app.route<QueryRoute<TQuery>>({
    method: download.route.method,
    url: download.route.path,
    schema: download.schema,
    handler: async(request, reply) => reply
      .type(ARCHIVE_MIME_TYPE)
      .header(
        "content-disposition",
        new AttachmentDisposition(download.fileName(request)).toString()
      )
      .send(await download.body(request))
  });
}
