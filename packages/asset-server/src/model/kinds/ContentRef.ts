// Import Third-party Dependencies
import type { Infer } from "@jolly-pixel/network";
import * as z from "zod/mini";

// CONSTANTS
export const ASSET_CONTENT_URL_PATH = "/__jollypixel/content";
export const CONTENT_TICKET_HEADER = "x-jolly-content-ticket";

export const contentRefSchema = z.strictObject({
  type: z.literal("ref"),
  hash: z.string().check(z.regex(/^[0-9a-f]{64}$/)),
  size: z.int().check(z.minimum(0)),
  ticket: z.string()
});

export type ContentRef = Infer<typeof contentRefSchema>;

export interface ContentRefOptions {
  /**
   * Lets the content route gzip the bytes, for content that shrinks.
   * @default false
   */
  readonly compress?: boolean;
}

export function contentRefUrl(
  hash: string
): string {
  return `${ASSET_CONTENT_URL_PATH}/${hash}`;
}
