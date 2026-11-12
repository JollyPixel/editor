// Import Third-party Dependencies
import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod";

// Import Internal Dependencies
import {
  SCRIPT_TIMEOUT_MS,
  type ScriptRunner
} from "../ScriptRunner.ts";
import { jsonResult } from "./results.ts";

// CONSTANTS
const kMaxTimeoutMs = 600_000;

export function registerScriptTools(
  server: McpServer,
  scripts: ScriptRunner
): void {
  server.registerTool(
    "script_run",
    {
      description: "Run a Node script written against the @jolly-pixel/golem " +
        `SDK. Write it in ${scripts.scriptsDir} first. It runs with ` +
        "JOLLY_STUDIO_URL and JOLLY_GOLEM_TOKEN set, so Golem.connect() " +
        "joins the studio under your name. Answers its exit code and the " +
        "end of its output.",
      inputSchema: z.object({
        script: z.string()
          .describe(`A path relative to ${scripts.scriptsDir}, such as "hill.ts".`),
        args: z.array(z.string()).optional(),
        timeoutMs: z.int()
          .min(1)
          .max(kMaxTimeoutMs)
          .optional()
          .describe(`Default ${SCRIPT_TIMEOUT_MS}.`)
      })
    },
    async({ script, args, timeoutMs }) => jsonResult(
      await scripts.run(script, { args, timeoutMs })
    )
  );
}
