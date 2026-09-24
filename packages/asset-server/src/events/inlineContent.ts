// Import Third-party Dependencies
import {
  fromUint8Array,
  toUint8Array
} from "js-base64";

// Import Internal Dependencies
import type { AssetInlineContent } from "./AssetEvents.schema.ts";

export function encodeContent(
  data: Uint8Array
): AssetInlineContent {
  return {
    type: "inline",
    encoding: "base64",
    data: fromUint8Array(data)
  };
}

export function decodeContent(
  content: AssetInlineContent
): Uint8Array {
  return toUint8Array(content.data);
}
