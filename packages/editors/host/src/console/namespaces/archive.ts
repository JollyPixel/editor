// Import Third-party Dependencies
import type {
  CommandConsole,
  RegistrationHandle
} from "@jolly-pixel/console";

// Import Internal Dependencies
import type { EditorArchives } from "../../session/EditorArchives.ts";

export interface ArchiveConsoleContext {
  archives: Pick<
    EditorArchives,
    | "canImport"
    | "canReset"
    | "download"
    | "pickAndImport"
    | "reset"
  >;
}

export function archiveConsole(
  commands: CommandConsole,
  { archives }: ArchiveConsoleContext
): RegistrationHandle {
  const namespace = commands.registerNamespace("archive", {
    description: "Export and import .zip archives"
  });

  namespace.registerCommand("export", {
    description: "Download the open asset as a .zip archive",
    args: [],
    execute: () => archives.download()
  });
  if (archives.canImport) {
    namespace.registerCommand("import", {
      description: "Pick a .zip archive, import it and open its root asset",
      args: [],
      execute: () => archives.pickAndImport()
    });
  }
  if (archives.canReset) {
    namespace.registerCommand("reset", {
      description: "Delete what this browser stored, then reload",
      args: [],
      execute: () => archives.reset()
    });
  }

  return namespace;
}
