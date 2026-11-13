// Import Third-party Dependencies
import type { CallToolResult } from "@modelcontextprotocol/server";

// CONSTANTS
export const RESULT_MAX_LENGTH = 32_000;

export function jsonResult(
  value: unknown
): CallToolResult {
  const text = JSON.stringify(value) ?? "null";
  if (text.length <= RESULT_MAX_LENGTH) {
    return textResult(text);
  }

  return textResult(JSON.stringify({
    truncated: true,
    length: text.length,
    head: text.slice(0, RESULT_MAX_LENGTH)
  }));
}

export function textResult(
  text: string
): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text
      }
    ]
  };
}
