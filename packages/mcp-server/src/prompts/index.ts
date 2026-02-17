// Import Third-party Dependencies
import type {
  McpServer
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerPrompts(
  server: McpServer
): void {
  server.registerPrompt(
    "create-behavior",
    {
      description: "Generate a new Behavior class for an Actor",
      argsSchema: {
        name: z.string().describe("The behavior class name (e.g. 'PlayerMovement')"),
        description: z.string().describe("What this behavior should do")
      }
    },
    ({ name, description }) => {
      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: [
              `Create a Behavior class named "${name}" for the @jolly-pixel/engine.`,
              `Description: ${description}`,
              "",
              "Requirements:",
              "- Extend the Behavior class from @jolly-pixel/engine",
              "- Use @Signal() decorator for events",
              "- Use @SceneProperty() for configurable properties",
              "- Use @Input.listen() for input bindings",
              "- Implement update() for per-frame logic",
              "- Follow the project coding standards (ESM, double quotes, semicolons, async/await)"
            ].join("\n")
          }
        }]
      };
    }
  );

  server.registerPrompt(
    "create-actor-setup",
    {
      description: "Generate a complete Actor setup with components",
      argsSchema: {
        name: z.string().describe("The actor name"),
        components: z.string().describe("Comma-separated list of components to attach")
      }
    },
    ({ name, components }) => {
      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: [
              `Create an Actor named "${name}" with these components: ${components}.`,
              "",
              "Use @jolly-pixel/engine APIs:",
              "- new Actor(world, { name, parent? })",
              "- actor.addComponent(ComponentClass, options?)",
              "- Available renderers: ModelRenderer, SpriteRenderer, TextRenderer, TiledRenderer",
              "- Available controls: Input, CombinedInput",
              "- Follow the project coding standards"
            ].join("\n")
          }
        }]
      };
    }
  );
}
