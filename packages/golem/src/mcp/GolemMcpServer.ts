// Import Node.js Dependencies
import fs from "node:fs";
import path from "node:path";

// Import Third-party Dependencies
import {
  McpServer,
  type Transport
} from "@modelcontextprotocol/server";

// Import Internal Dependencies
import {
  golemTarget,
  type GolemConnectOptions
} from "../peer/GolemConnectOptions.ts";
import { GolemSession } from "./GolemSession.ts";
import { ScriptRunner } from "./ScriptRunner.ts";
import {
  PACKAGE_ROOT,
  registerResources
} from "./resources.ts";
import { registerAssetTools } from "./tools/asset.ts";
import { registerCatalogTools } from "./tools/catalog.ts";
import { registerChatTools } from "./tools/chat.ts";
import { registerPixelArtTools } from "./tools/pixelArt.ts";
import { registerPresenceTools } from "./tools/presence.ts";
import { registerScriptTools } from "./tools/script.ts";
import { registerSceneTools } from "./tools/scene.ts";
import { registerStudioTools } from "./tools/studio.ts";
import { registerTextTools } from "./tools/text.ts";
import { registerVoxelMapTools } from "./tools/voxelMap.ts";
import { registerVoxelModelTools } from "./tools/voxelModel.ts";

// CONSTANTS
const kManifest = path.join(PACKAGE_ROOT, "package.json");
const kInstructions = [
  "You are a peer in a running JollyPixel studio: people see your name, " +
  "your focus and your edits live.",
  "Read jollypixel://guide before your first edit.",
  "Find assets with catalog_list, open one with asset_open, then read the " +
  "command schema it names before calling asset_apply.",
  "Send related commands in one asset_apply batch. It answers once the " +
  "studio accepted them; report success only then.",
  "Call catalog_tag before a bulk edit, and catalog_restore if it goes wrong.",
  "Publish what you are doing with presence_activity during longer work.",
  "People talk to you in the golem chat: announce work with chat_say, " +
  "and call chat_next between steps and before saying you are done.",
  "For procedural or repetitive work (layouts, noise, hundreds of commands) " +
  "write a Node script with the @jolly-pixel/golem SDK and run it with " +
  "script_run instead of calling tools in a loop."
].join("\n");

export class GolemMcpServer {
  readonly mcp: McpServer;

  #session: GolemSession;

  constructor(
    options: GolemConnectOptions = {}
  ) {
    const { version } = JSON.parse(
      fs.readFileSync(kManifest, "utf-8")
    );
    const target = golemTarget(options);
    this.#session = new GolemSession(target);
    this.mcp = new McpServer(
      {
        name: "jollypixel",
        version
      },
      {
        instructions: kInstructions
      }
    );
    this.mcp.server.onclose = () => {
      void this.#session.dispose();
    };

    registerStudioTools(this.mcp, this.#session);
    registerCatalogTools(this.mcp, this.#session);
    registerAssetTools(this.mcp, this.#session);
    registerSceneTools(this.mcp, this.#session);
    registerTextTools(this.mcp, this.#session);
    registerVoxelMapTools(this.mcp, this.#session);
    registerVoxelModelTools(this.mcp, this.#session);
    registerPixelArtTools(this.mcp, this.#session);
    registerPresenceTools(this.mcp, this.#session);
    registerChatTools(this.mcp, this.#session);
    registerScriptTools(this.mcp, new ScriptRunner({
      target,
      scriptsDir: path.join(PACKAGE_ROOT, "local"),
      cwd: PACKAGE_ROOT
    }));
    registerResources(this.mcp);
  }

  connect(
    transport: Transport
  ): Promise<void> {
    return this.mcp.connect(transport);
  }

  async close(): Promise<void> {
    await this.mcp.close();
    await this.#session.dispose();
  }
}
