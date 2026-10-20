// Import Internal Dependencies
import type { AssetInlineContent } from "./AssetEvents.schema.ts";
import {
  decodeBase64,
  encodeBase64
} from "../../common/base64.ts";

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
  return decodeBase64(content.data);
}
