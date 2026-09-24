// Import Internal Dependencies
import { QueryParams } from "./QueryParams.ts";

// CONSTANTS
const kOfflineParam = "offline";
const kWorkspaceParam = "workspace";

export interface HostParams {
  maxFps: number | undefined;
  samples: number | undefined;
  username: string | undefined;
  offline: boolean;
  workspace: string | undefined;
}

export const HOST_PARAMS = new QueryParams<HostParams>((query) => {
  const maxFps = query.number("max-fps");
  const samples = query.number("samples");
  const username = query.string("username")?.trim();
  const workspace = query.string(kWorkspaceParam)?.trim();

  return {
    maxFps: maxFps !== undefined && maxFps > 0 ? maxFps : undefined,
    samples: samples !== undefined && Number.isInteger(samples) && samples >= 0 ?
      samples :
      undefined,
    username: username === "" ? undefined : username,
    offline: query.flag(kOfflineParam),
    workspace: workspace === "" ? undefined : workspace
  };
});

export function offlineWorkspaceQuery(
  workspace: string
): Record<string, string> {
  return {
    [kOfflineParam]: "",
    [kWorkspaceParam]: workspace
  };
}
