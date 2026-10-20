// Import Internal Dependencies
import { QueryParams } from "./QueryParams.ts";

// CONSTANTS
const kOfflineParam = "offline";
const kRenderModes = ["continuous", "on-demand"] as const;

export type RenderMode = typeof kRenderModes[number];

export interface OfflineParam {
  name: string | undefined;
}

export interface HostParams {
  maxFps: number | undefined;
  samples: number | undefined;
  gpuTime: boolean;
  username: string | undefined;
  offline: OfflineParam | undefined;
  render: RenderMode | undefined;
}

export const HOST_PARAMS = new QueryParams<HostParams>((query) => {
  const maxFps = query.number("max-fps");
  const samples = query.number("samples");
  const username = query.string("username")?.trim();
  const offline = query.string(kOfflineParam)?.trim();
  const render = query.string("render")?.trim();

  return {
    maxFps: maxFps !== undefined && maxFps > 0 ? maxFps : undefined,
    samples: samples !== undefined && Number.isInteger(samples) && samples >= 0 ?
      samples :
      undefined,
    gpuTime: query.flag("gpu-time"),
    username: username === "" ? undefined : username,
    offline: offline === undefined ? undefined : {
      name: offline === "" ? undefined : offline
    },
    render: kRenderModes.find((mode) => mode === render)
  };
});

export function offlineQuery(
  name: string
): Record<string, string> {
  return {
    [kOfflineParam]: name
  };
}
