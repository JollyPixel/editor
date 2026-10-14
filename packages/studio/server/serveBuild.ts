// Import Node.js Dependencies
import type { ServerResponse } from "node:http";

// Import Third-party Dependencies
import {
  servo,
  type ServoHandler
} from "@openally/servo";

// CONSTANTS
const kHashedAsset = /^assets\/.+-[\w-]{8}\.\w+$/;
const kImmutableCacheControl = "public, max-age=31536000, immutable";

export function serveBuild(
  directory: string,
  prefix = "/"
): ServoHandler {
  return servo(directory, {
    prefix,
    dev: true,
    setHeaders: cacheHashedAssets
  });
}

function cacheHashedAssets(
  response: ServerResponse,
  filePath: string
): void {
  if (kHashedAsset.test(filePath)) {
    response.setHeader(
      "Cache-Control",
      kImmutableCacheControl
    );
  }
}
