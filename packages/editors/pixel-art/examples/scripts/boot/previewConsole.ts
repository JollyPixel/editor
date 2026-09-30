// Import Third-party Dependencies
import type {
  CommandConsole,
  RegistrationHandle
} from "@jolly-pixel/console";
import { LocalStorageAdapter } from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { DemoPreview } from "./DemoPreview.ts";
import { ROTATION_STORAGE_KEY } from "../config.ts";

// CONSTANTS
const kStorage = new LocalStorageAdapter();

export interface PreviewConsoleContext {
  preview: DemoPreview;
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
    get: () => preview.scene.rotating,
    set: (rotating) => {
      preview.scene.rotating = rotating;
      kStorage.set(ROTATION_STORAGE_KEY, String(rotating));
    }
  });

  return namespace;
}
