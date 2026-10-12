// Import Internal Dependencies
import { EditorLaunch } from "./EditorLaunch.ts";

export type HistoryWrite = "push" | "replace";

export interface LaunchHistory {
  record(
    launch: EditorLaunch
  ): void;
  reload(
    launch: EditorLaunch
  ): void;
  follow(
    listener: (launch: EditorLaunch) => void,
    signal: AbortSignal
  ): void;
}

export class PageHistory implements LaunchHistory {
  readonly write: HistoryWrite;

  constructor(
    write: HistoryWrite
  ) {
    this.write = write;
  }

  record(
    launch: EditorLaunch
  ): void {
    const url = launch.toUrl(location.href);
    if (this.write === "push") {
      window.history.pushState(null, "", url);
    }
    else {
      window.history.replaceState(null, "", url);
    }
  }

  reload(
    launch: EditorLaunch
  ): void {
    location.assign(
      launch.toUrl(location.href)
    );
  }

  follow(
    listener: (launch: EditorLaunch) => void,
    signal: AbortSignal
  ): void {
    window.addEventListener("popstate", () => {
      const launch = EditorLaunch.fromUrl(
        new URL(location.href)
      );
      if (launch !== undefined) {
        listener(launch);
      }
    }, { signal });
  }
}
