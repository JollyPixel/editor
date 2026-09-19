// Import Third-party Dependencies
import { LAUNCH_ELEMENT_ID } from "@jolly-pixel/asset";

// Import Internal Dependencies
import { EditorLaunch } from "./EditorLaunch.ts";
import type { LaunchSource } from "./LaunchSource.ts";

export class InjectedLaunchSource implements LaunchSource {
  readonly elementId: string;

  constructor(
    elementId: string = LAUNCH_ELEMENT_ID
  ) {
    this.elementId = elementId;
  }

  read(): Promise<EditorLaunch | undefined> {
    const text = document.getElementById(
      this.elementId
    )?.textContent;
    if (
      text === undefined ||
      text === null
    ) {
      return Promise.resolve(undefined);
    }

    try {
      return Promise.resolve(
        EditorLaunch.parse(JSON.parse(text))
      );
    }
    catch {
      return Promise.resolve(undefined);
    }
  }
}
