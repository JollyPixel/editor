// Import Third-party Dependencies
import * as z from "zod/mini";

// CONSTANTS
export const PLAY_WINDOW = "jolly-play";
export const PLAY_ERROR = "jolly-play-error";

const kPlayErrorSchema = z.object({
  type: z.literal(PLAY_ERROR),
  message: z.string()
});

export type PlayError = z.output<typeof kPlayErrorSchema>;

export function parsePlayError(
  data: unknown
): PlayError | undefined {
  const parsed = kPlayErrorSchema.safeParse(data);

  return parsed.success ? parsed.data : undefined;
}
