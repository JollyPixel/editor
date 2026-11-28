// Import Third-party Dependencies
import type { FastifyInstance } from "fastify";
import * as z from "zod";

// CONSTANTS
export const BINARY_BODY_SCHEMA = z.instanceof(Uint8Array);

export async function binaryUpload(
  app: FastifyInstance,
  routes: (upload: FastifyInstance) => void
): Promise<void> {
  await app.register(async(upload) => {
    upload.addContentTypeParser(
      "*",
      {
        parseAs: "buffer"
      },
      (_request, body, done) => done(null, body)
    );
    routes(upload);
  });
}
