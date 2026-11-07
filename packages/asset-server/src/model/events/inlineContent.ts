// Import Third-party Dependencies
import {
  decodeBase64,
  encodeBase64
} from "@jolly-pixel/utils";

// Import Internal Dependencies
import type { AssetInlineContent } from "./AssetEvents.schema.ts";

export function encodeContent(
  data: Uint8Array
): AssetInlineContent {
  return {
    type: "inline",
    encoding: "base64",
    data: encodeBase64(data)
  };
}

export function decodeContent(
  content: AssetInlineContent
): Uint8Array {
  const data = decodeBase64(content.data);
  if (data === null) {
    throw new TypeError("Inline content data is not valid base64.");
  }

  return data;
}
