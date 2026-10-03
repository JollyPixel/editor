// Import Third-party Dependencies
import type {
  CommandConsole,
  RegistrationHandle
} from "@jolly-pixel/console";

// Import Internal Dependencies
import type { PreviewPane } from "./PreviewPane.ts";

export interface PreviewConsoleContext {
  preview: PreviewPane;
}

export function previewConsole(
  commands: CommandConsole,
  { preview }: PreviewConsoleContext
): RegistrationHandle {
  const namespace = commands.registerNamespace("preview", {
    description: "3D preview of the UV regions"
  });

  namespace.registerVariable("rotate", {
    type: "boolean",
    description: "Spin the preview shapes",
    get: () => preview.rotating,
    set: (rotating) => {
      preview.rotating = rotating;
    }
  });

  return namespace;
}
