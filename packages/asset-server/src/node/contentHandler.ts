// Import Node.js Dependencies
import type {
  IncomingMessage,
  ServerResponse
} from "node:http";
import { promisify } from "node:util";
import zlib from "node:zlib";

// Import Third-party Dependencies
import {
  allowMethods,
  bytesEntry,
  negotiateEncoding,
  send,
  splitTarget
} from "@openally/servo";

// Import Internal Dependencies
import type {
  ContentRefs,
  ServedContent
} from "../live/ContentRefs.ts";
import {
  ASSET_CONTENT_URL_PATH,
  CONTENT_TICKET_HEADER
} from "../model/kinds/ContentRef.ts";

// CONSTANTS
const kPrefix = `${ASSET_CONTENT_URL_PATH}/`;
const kOneYear = 365 * 24 * 60 * 60;
const kEncodings = ["br", "gzip"] as const;
const kBrotli = promisify(zlib.brotliCompress);
const kGzip = promisify(zlib.gzip);
const kEncoders: Readonly<Record<ContentEncoding, Encoder>> = {
  br: (bytes) => kBrotli(bytes, {
    params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]: 5,
      [zlib.constants.BROTLI_PARAM_SIZE_HINT]: bytes.byteLength
    }
  }),
  gzip: (bytes) => kGzip(bytes, {
    level: 3
  })
};

type ContentEncoding = typeof kEncodings[number];
type Encoder = (bytes: Uint8Array) => Promise<Uint8Array>;

export type ContentHandler = (
  request: IncomingMessage,
  response: ServerResponse,
  next: () => void
) => void;

export interface ContentHandlerOptions {
  /**
   * Sends content whose ref asked for compression as brotli or gzip, as the
   * request accepts. Each encoding is computed once per content. It pays on
   * slow links and costs time on loopback.
   * @default false
   */
  compression?: boolean;
}

export function createContentHandler(
  refs: ContentRefs,
  options: ContentHandlerOptions = {}
): ContentHandler {
  const { compression = false } = options;
  const encoded = new WeakMap<
    Uint8Array,
    Map<ContentEncoding, Promise<Uint8Array>>
  >();

  function encode(
    bytes: Uint8Array,
    encoding: ContentEncoding
  ): Promise<Uint8Array> {
    const byEncoding = encoded.get(bytes) ?? new Map();
    encoded.set(bytes, byEncoding);

    let body = byEncoding.get(encoding);
    if (body === undefined) {
      body = kEncoders[encoding](bytes);
      byEncoding.set(encoding, body);
      body.catch(() => byEncoding.delete(encoding));
    }

    return body;
  }

  async function respond(
    request: IncomingMessage,
    response: ServerResponse,
    hash: string,
    content: ServedContent
  ): Promise<void> {
    const compressible = compression && content.compress;
    const encoding = compressible ?
      negotiateEncoding(request.headers["accept-encoding"], kEncodings) :
      null;
    const body = encoding === null ?
      content.bytes :
      await encode(content.bytes, encoding);

    await send(request, response, {
      entry: bytesEntry(body, {
        etag: encoding === null ? `"${hash}"` : `"${hash}-${encoding}"`
      }),
      contentType: "application/octet-stream",
      encoding: encoding ?? undefined,
      vary: compressible,
      lastModified: false,
      maxAge: kOneYear,
      immutable: true,
      private: true
    });
  }

  return function contentHandler(
    request: IncomingMessage,
    response: ServerResponse,
    next: () => void
  ) {
    const pathname = splitTarget(request.url ?? "/").path;
    if (!pathname.startsWith(kPrefix)) {
      next();

      return;
    }

    if (!allowMethods(request, response)) {
      return;
    }

    const hash = pathname.slice(kPrefix.length);
    const ticket = request.headers[CONTENT_TICKET_HEADER];
    const content = typeof ticket === "string" ?
      refs.read(hash, ticket) :
      null;
    if (content === null) {
      response.statusCode = 404;
      response.setHeader("Cache-Control", "no-store");
      response.end();

      return;
    }

    respond(request, response, hash, content)
      .catch(() => response.destroy());
  };
}
