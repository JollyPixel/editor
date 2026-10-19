// Import Third-party Dependencies
import type {
  CommandConsole,
  RegistrationHandle
} from "@jolly-pixel/console";

// Import Internal Dependencies
import type { UvNetLibrary } from "./UvNetLibrary.ts";

export interface UvNetConsoleContext {
  uvNets: UvNetLibrary;
}

export function uvNetConsole(
  commands: CommandConsole,
  { uvNets }: UvNetConsoleContext
): RegistrationHandle {
  const namespace = commands.registerNamespace("pixelart.nets", {
    description: "UV nets used to unfold regions"
  });

  namespace.registerCommand("list", {
    description: "List the UV nets, marking the default one",
    args: [],
    execute: (_args, ctx) => {
      for (const preset of uvNets) {
        const tags = [
          uvNets.defaultId === preset.id ? "default" : "",
          preset.locked ? "locked" : ""
        ].filter((tag) => tag !== "");
        ctx.print(
          `${preset.id}  ${preset.name}${tags.length > 0 ? `  (${tags.join(", ")})` : ""}`
        );
      }
    }
  });

  namespace.registerCommand("default", {
    description: "Pick the net used when a region unfolds",
    args: [
      {
        name: "id",
        type: "string",
        required: true,
        autocomplete: () => [...uvNets].map((preset) => preset.id)
      }
    ],
    execute: ({ id }, ctx) => {
      const preset = uvNets.get(id);
      if (preset === undefined) {
        ctx.error(`Unknown UV net "${id}"`);

        return;
      }

      uvNets.defaultId = id;
      ctx.print(`Regions now unfold with ${preset.name}`);
    }
  });

  return namespace;
}
