// Import Internal Dependencies
import { t } from "../trpc.js";

// CONSTANTS
const kDiscussionProcedure = t.procedure;

export const discussionRouter = t.router({
  join: kDiscussionProcedure.query(() => "join room")
});
