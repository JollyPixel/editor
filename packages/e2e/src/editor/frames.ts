// Import Third-party Dependencies
import type { Page } from "@playwright/test";

interface EditorFrames {
  readonly runtime: {
    frames(count: number): Promise<void>;
  } | null;
}

export function nextFrames(
  page: Page,
  count = 2
): Promise<void> {
  return page.evaluate((frames) => {
    const editor: EditorFrames | undefined = Reflect.get(globalThis, "jollyEditor");
    if (editor === undefined) {
      throw new Error("window.jollyEditor is only exposed in dev builds.");
    }
    if (editor.runtime === null) {
      throw new Error("The editor runs without a runtime.");
    }

    return editor.runtime.frames(frames);
  }, count);
}
