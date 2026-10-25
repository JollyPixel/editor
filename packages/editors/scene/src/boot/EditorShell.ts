// Import Third-party Dependencies
import {
  bindPresenceStack,
  Teardown,
  type EditorToolbarSources
} from "@jolly-pixel/editor.host";
import "@jolly-pixel/editor.host/ui";
import type { HistoryStepInfo } from "@jolly-pixel/history";
import { LogQueue } from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { SceneEditing } from "../editing/SceneEditing.ts";
import { skippedMessage } from "../features/history/sceneHistory.ts";

// CONSTANTS
const kAttachedTags = [
  "jolly-scene-hierarchy",
  "jolly-scene-inspector",
  "jolly-scene-environment",
  "jolly-scene-view-toolbar"
] as const satisfies readonly (keyof HTMLElementTagNameMap)[];

export interface EditorShellOptions {
  toolbar: EditorToolbarSources;
}

export class EditorShell {
  #teardown = new Teardown();

  constructor(
    options: EditorShellOptions
  ) {
    const editorToolbar = document.querySelector("jolly-editor-toolbar");
    if (editorToolbar !== null) {
      editorToolbar.sources = options.toolbar;
    }
  }

  adoptEditing(
    editing: SceneEditing
  ): void {
    for (const tag of kAttachedTags) {
      const element = document.querySelector(tag);
      if (element === null) {
        throw new Error(`EditorShell: "${tag}" is missing from the page.`);
      }
      element.attach(editing);
    }

    const presenceStack = document.querySelector("jolly-presence-stack");
    if (presenceStack !== null) {
      this.#teardown.defer(bindPresenceStack(
        presenceStack,
        editing.presence,
        (clientId) => editing.teleportToPeer(clientId)
      ));
    }

    const activityLog = document.querySelector("jolly-log");
    if (activityLog !== null) {
      this.#logSkippedSteps(editing, activityLog);
    }
  }

  #logSkippedSteps(
    editing: SceneEditing,
    activityLog: HTMLElementTagNameMap["jolly-log"]
  ): void {
    const log = new LogQueue();
    this.#teardown.defer(editing.history.subscribe(
      "skipped",
      (_scope: string, step: HistoryStepInfo) => log.push(skippedMessage(step))
    ));
    this.#teardown.defer(log.subscribe((entries) => {
      activityLog.entries = entries;
    }));
  }

  dispose(): void {
    this.#teardown.run();
  }
}
