// Import Third-party Dependencies
import * as z from "zod";

// CONSTANTS
export const PROJECT_URL_PATH = "/api/project/";
export const PROJECT_ARCHIVE_PATH = "archive";

export const projectReplySchema = z.object({
  canExport: z.boolean()
});

export type ProjectReply = z.infer<typeof projectReplySchema>;
