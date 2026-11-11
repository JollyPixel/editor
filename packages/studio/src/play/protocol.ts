// Import Third-party Dependencies
import * as z from "zod/mini";

// CONSTANTS
export const PLAY_WINDOW = "jolly-play";
export const PLAY_ERROR = "jolly-play-error";
export const PLAY_WARNING = "jolly-play-warning";

const kPlayReportSchema = z.object({
  type: z.enum([PLAY_ERROR, PLAY_WARNING]),
  message: z.string()
});

export type PlayReport = z.output<typeof kPlayReportSchema>;

export function parsePlayReport(
  data: unknown
): PlayReport | undefined {
  const parsed = kPlayReportSchema.safeParse(data);

  return parsed.success ? parsed.data : undefined;
}
