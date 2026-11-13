// Import Third-party Dependencies
import type { ValidationError } from "@jolly-pixel/network";
import {
  decodeBase64,
  is
} from "@jolly-pixel/utils";
import {
  Err,
  Ok,
  type Result
} from "@openally/result";

export function upcastLegacyWriteData(
  data: unknown
): Result<unknown, ValidationError> {
  if (!is.plainObject(data)) {
    return Ok(data);
  }

  const content = upcastContent(data.content, "/content");
  if (!content.ok) {
    return content;
  }
  if (!is.plainObject(data.parts)) {
    return Ok({
      ...data,
      content: content.val
    });
  }

  const parts: Record<string, unknown> = {};
  for (const [partId, entry] of Object.entries(data.parts)) {
    if (!is.plainObject(entry) || !("content" in entry)) {
      parts[partId] = entry;
      continue;
    }

    const partContent = upcastContent(
      entry.content,
      `/parts/${partId}/content`
    );
    if (!partContent.ok) {
      return partContent;
    }
    parts[partId] = {
      ...entry,
      content: partContent.val
    };
  }

  return Ok({
    ...data,
    content: content.val,
    parts
  });
}

function upcastContent(
  content: unknown,
  instancePath: string
): Result<unknown, ValidationError> {
  if (
    !is.plainObject(content) ||
    content.encoding !== "base64" ||
    typeof content.data !== "string"
  ) {
    return Ok(content);
  }

  const data = decodeBase64(content.data);
  if (data === null) {
    return Err({
      instancePath: `${instancePath}/data`,
      message: "must be base64"
    });
  }

  const { encoding: _encoding, ...inline } = content;

  return Ok({
    ...inline,
    data
  });
}
