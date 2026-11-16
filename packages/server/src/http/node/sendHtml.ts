// Import Node.js Dependencies
import type { ServerResponse } from "node:http";

// CONSTANTS
const kPageHeaders = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": "no-store",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff"
};

export function sendHtml(
  response: ServerResponse,
  status: number,
  html: string
): void {
  response.statusCode = status;
  for (const [name, value] of Object.entries(kPageHeaders)) {
    response.setHeader(name, value);
  }
  response.end(html);
}
