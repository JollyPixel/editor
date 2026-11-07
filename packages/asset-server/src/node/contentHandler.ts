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
  send,
  type ServoEntry
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
const kCacheControl = "private, max-age=31536000, immutable";
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

type ContentEncoding = "br" | "gzip";
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
      acceptedEncoding(request.headers["accept-encoding"]) :
      null;
    const body = encoding === null ?
      content.bytes :
      await encode(content.bytes, encoding);

    response.setHeader("Cache-Control", kCacheControl);
    await send(request, response, {
      entry: bytesEntry(
        encoding === null ? `"${hash}"` : `"${hash}-${encoding}"`,
        body
      ),
      contentType: "application/octet-stream",
      encoding: encoding ?? undefined,
      vary: compressible,
      lastModified: false
    });
  }

  return function contentHandler(
    request: IncomingMessage,
    response: ServerResponse,
    next: () => void
  ) {
    const pathname = URL.parse(
      request.url ?? "",
      "http://localhost"
    )?.pathname ?? "";
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

function acceptedEncoding(
  header: string | undefined
): ContentEncoding | null {
  const accepted = new Set<string>();
  for (const entry of (header ?? "").split(",")) {
    const [name, ...params] = entry.trim().toLowerCase().split(";");
    const refused = params.some((param) => /^\s*q\s*=\s*0(?:\.0*)?\s*$/.test(param));
    if (!refused) {
      accepted.add(name.trim());
    }
  }

  if (accepted.has("br")) {
    return "br";
  }

  return accepted.has("gzip") ? "gzip" : null;
}

function bytesEntry(
  etag: string,
  bytes: Uint8Array
): ServoEntry {
  return {
    size: bytes.byteLength,
    etag,
    body: (range) => (range === undefined ?
      bytes :
      bytes.subarray(range.start, range.end + 1)),
    [Symbol.asyncDispose]: () => Promise.resolve()
  };
}
