// Import Internal Dependencies
import { QueryParams } from "./QueryParams.ts";

export interface HostParams {
  maxFps: number | undefined;
  samples: number | undefined;
  username: string | undefined;
}

export const HOST_PARAMS = new QueryParams<HostParams>((query) => {
  const maxFps = query.number("max-fps");
  const samples = query.number("samples");
  const username = query.string("username")?.trim();

  return {
    maxFps: maxFps !== undefined && maxFps > 0 ? maxFps : undefined,
    samples: samples !== undefined && Number.isInteger(samples) && samples >= 0 ?
      samples :
      undefined,
    username: username === "" ? undefined : username
  };
});
