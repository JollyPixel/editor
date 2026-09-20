// Import Third-party Dependencies
import { LAUNCH_ELEMENT_ID } from "@jolly-pixel/asset";

// Import Internal Dependencies
import { EditorLaunch } from "../EditorLaunch.ts";
import type { LaunchSource } from "./LaunchSource.ts";

export class InjectedLaunchSource implements LaunchSource {
  readonly elementId: string;

  constructor(
    elementId: string = LAUNCH_ELEMENT_ID
  ) {
    this.elementId = elementId;
  }

  read(): Promise<EditorLaunch | undefined> {
    return Promise.resolve(
      this.#parse(document.getElementById(this.elementId)?.textContent)
    );
  }

  #parse(
    text: string | null | undefined
  ): EditorLaunch | undefined {
    try {
      return EditorLaunch.parse(JSON.parse(text ?? "null"));
    }
    catch {
      return undefined;
    }
  }
}
