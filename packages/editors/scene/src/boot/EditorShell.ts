// Import Third-party Dependencies
import {
  bindPresenceStack,
  Teardown,
  type EditorToolbarSources
} from "@jolly-pixel/editor.host";
import "@jolly-pixel/editor.host/ui";
import {
  describeSkippedStep,
  type HistoryStepInfo
} from "@jolly-pixel/history";
import { LogQueue } from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { SceneEditing } from "../editing/SceneEditing.ts";
import { SCENE_REFUSAL_WORDING } from "../features/history/sceneHistory.ts";

// CONSTANTS
const kAttachedTags = [
  "jolly-scene-hierarchy",
  "jolly-scene-inspector",
  "jolly-scene-environment",
  "jolly-scene-toolbar"
] as const satisfies readonly (keyof HTMLElementTagNameMap)[];

export interface EditorShellOptions {
  toolbar: EditorToolbarSources;
}

export class EditorShell {
  #log = new LogQueue();
  #teardown = new Teardown();

  constructor(
    options: EditorShellOptions
  ) {
    const editorToolbar = document.querySelector("jolly-editor-toolbar");
    if (editorToolbar !== null) {
      editorToolbar.sources = options.toolbar;
    }

    const activityLog = document.querySelector("jolly-log");
    if (activityLog !== null) {
      this.#teardown.defer(this.#log.subscribe((entries) => {
        activityLog.entries = entries;
      }));
    }
    this.#teardown.defer(() => this.#log.dispose());
  }

  get log(): Pick<LogQueue, "push"> {
    return this.#log;
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

    this.#teardown.defer(editing.history.subscribe(
      "skipped",
      (_scope: string, step: HistoryStepInfo) => this.#log.push(
        describeSkippedStep(step, SCENE_REFUSAL_WORDING)
      )
    ));
  }

  dispose(): void {
    this.#teardown.run();
  }
}
