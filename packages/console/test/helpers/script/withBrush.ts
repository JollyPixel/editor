// Import Internal Dependencies
import { CommandConsole } from "#src/index.ts";

export interface Brush {
  theme: "dark" | "light";
  size: number;
  mode: "build" | "replace";
  ghost: boolean;
  label: string;
}

export interface BrushSetup {
  commands: CommandConsole;
  brush: Brush;
  writes: string[];
}

export function withBrush(): BrushSetup {
  const commands = new CommandConsole();
  const writes: string[] = [];
  const brush: Brush = {
    theme: "dark",
    size: 1,
    mode: "build",
    ghost: true,
    label: "main brush"
  };

  commands.registerVariable("theme", {
    type: "enum",
    description: "Ambient theme",
    enumValues: ["dark", "light"],
    get: () => brush.theme,
    set: (theme) => {
      writes.push(`theme=${theme}`);
      brush.theme = theme;
    }
  });
  commands.registerNamespace("audio").registerCommand("mute", {
    description: "",
    args: [],
    execute: () => undefined
  });

  const namespace = commands.registerNamespace("brush", {
    description: "Voxel brush"
  });
  namespace.registerVariable("size", {
    type: "number",
    description: "Brush size in voxels",
    get: () => brush.size,
    set: (size) => {
      if (size > 16) {
        return false;
      }
      writes.push(`size=${size}`);
      brush.size = size;

      return undefined;
    }
  });
  namespace.registerVariable("mode", {
    type: "enum",
    description: "",
    enumValues: ["build", "replace"],
    get: () => brush.mode,
    set: (mode) => {
      writes.push(`mode=${mode}`);
      brush.mode = mode;
    }
  });
  namespace.registerVariable("ghost", {
    type: "boolean",
    description: "Preview the block under the cursor",
    get: () => brush.ghost,
    set: (ghost) => {
      writes.push(`ghost=${ghost}`);
      brush.ghost = ghost;
    }
  });
  namespace.registerVariable("label", {
    type: "string",
    description: "Name shown in the toolbar",
    get: () => brush.label,
    set: async(label) => {
      await Promise.resolve();
      writes.push(`label=${label}`);
      brush.label = label;
    }
  });

  return {
    commands,
    brush,
    writes
  };
}
