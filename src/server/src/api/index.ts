// Import Internal Dependencies
import { t, publicProcedure } from "../trpc.js";
import { discussionRouter } from "./discussions.js";

export const appRouter = t.router({
  greeting: publicProcedure.query(() => "hello tRPC v10!"),
  discussion: discussionRouter
});
