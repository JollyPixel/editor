// Import Internal Dependencies
import type { EditorHandle } from "#src/boot/EditorDefinition.ts";
import type { EditorSession } from "#src/session/EditorSession.ts";

export function editorHandle(
  session: EditorSession,
  ready: Promise<void> = Promise.resolve()
): EditorHandle {
  return {
    ready,
    session,
    runtime: null,
    dispose: () => undefined
  };
}
