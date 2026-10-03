// Import Internal Dependencies
import type { EditorFramesOptions } from "../../src/tabs/EditorFrames.ts";

export function idleShare(): EditorFramesOptions["share"] {
  return {
    serve: (connector) => () => connector.close()
  };
}
